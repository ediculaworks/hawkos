/**
 * Google Calendar Sync
 * Imports events from Google Calendar and optionally pushes local events back.
 * Uses the calendar_sync_config table to store OAuth tokens and sync state.
 */

import { db } from '@hawk/db';

interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  status?: string;
  organizer?: { email?: string };
}

interface GoogleEventListResponse {
  items?: GoogleEvent[];
  nextSyncToken?: string;
  nextPageToken?: string;
}

interface SyncConfig {
  id: string;
  calendar_id: string;
  google_calendar_id: string;
  access_token: string;
  refresh_token: string | null;
  token_expiry: string | null;
  metadata: Record<string, unknown>;
}

export interface SyncResult {
  imported: number;
  updated: number;
  skipped: number;
  syncToken: string | null;
}

/** Load the Google sync config for the current tenant. */
export async function getGoogleSyncConfig(): Promise<SyncConfig | null> {
  const { data } = await db
    .from('calendar_sync_config')
    .select(
      'id, calendar_id, google_calendar_id, access_token, refresh_token, token_expiry, metadata',
    )
    .ilike('calendar_id', 'google:%')
    .eq('sync_enabled', true)
    .limit(1)
    .single();

  return data as SyncConfig | null;
}

/** Refresh the access token if expired. Updates calendar_sync_config in place. */
async function getValidAccessToken(config: SyncConfig): Promise<string | null> {
  if (!config.token_expiry) return config.access_token;

  const expiresAt = new Date(config.token_expiry).getTime();
  const bufferMs = 60 * 1000; // 60s buffer

  if (Date.now() + bufferMs < expiresAt) {
    return config.access_token; // Still valid
  }

  if (!config.refresh_token) {
    console.warn('[google-sync] Token expired and no refresh_token available');
    return null;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: config.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    console.error('[google-sync] Token refresh failed:', res.status);
    return null;
  }

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!data.access_token) return null;

  const newExpiry = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString();

  await db
    .from('calendar_sync_config')
    .update({ access_token: data.access_token, token_expiry: newExpiry })
    .eq('id', config.id);

  config.access_token = data.access_token;
  config.token_expiry = newExpiry;

  return data.access_token;
}

/** Import Google Calendar events into calendar_events. Returns sync result. */
export async function importGoogleEvents(config: SyncConfig): Promise<SyncResult> {
  const accessToken = await getValidAccessToken(config);
  if (!accessToken) return { imported: 0, updated: 0, skipped: 0, syncToken: null };

  const calendarId = encodeURIComponent(config.google_calendar_id);
  const syncToken = (config.metadata?.sync_token as string) ?? null;

  const params = new URLSearchParams({ maxResults: '250', singleEvents: 'true' });

  if (syncToken) {
    params.set('syncToken', syncToken);
  } else {
    // Initial sync: fetch 90 days past + all future
    const timeMin = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    params.set('timeMin', timeMin);
    params.set('orderBy', 'startTime');
  }

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let newSyncToken: string | null = null;
  let pageToken: string | undefined;

  do {
    if (pageToken) params.set('pageToken', pageToken);

    const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 410) {
      // Sync token expired — reset and do full sync
      await db
        .from('calendar_sync_config')
        .update({ metadata: { ...config.metadata, sync_token: null } })
        .eq('id', config.id);
      return importGoogleEvents({ ...config, metadata: { ...config.metadata, sync_token: null } });
    }

    if (!res.ok) {
      console.error('[google-sync] Calendar API error:', res.status);
      break;
    }

    const body = (await res.json()) as GoogleEventListResponse;
    newSyncToken = body.nextSyncToken ?? null;
    pageToken = body.nextPageToken;

    for (const gEvent of body.items ?? []) {
      if (!gEvent.id || !gEvent.summary) {
        skipped++;
        continue;
      }

      const startAt = gEvent.start?.dateTime ?? gEvent.start?.date;
      const endAt = gEvent.end?.dateTime ?? gEvent.end?.date;
      if (!startAt || !endAt) {
        skipped++;
        continue;
      }

      const isAllDay = !gEvent.start?.dateTime;
      const isCancelled = gEvent.status === 'cancelled';

      // Check if event already exists by google_event_id
      const { data: existing } = await db
        .from('calendar_events')
        .select('id, status')
        .eq('google_event_id', gEvent.id)
        .maybeSingle();

      if (existing) {
        if (isCancelled) {
          await db
            .from('calendar_events')
            .update({ status: 'cancelled' })
            .eq('google_event_id', gEvent.id);
        } else {
          await db
            .from('calendar_events')
            .update({
              title: gEvent.summary,
              description: gEvent.description ?? null,
              location: gEvent.location ?? null,
              start_at: startAt,
              end_at: endAt,
              all_day: isAllDay,
              status: 'confirmed',
              organizer_email: gEvent.organizer?.email ?? null,
            })
            .eq('google_event_id', gEvent.id);
        }
        updated++;
      } else if (!isCancelled) {
        await db.from('calendar_events').insert({
          google_event_id: gEvent.id,
          title: gEvent.summary,
          description: gEvent.description ?? null,
          location: gEvent.location ?? null,
          start_at: startAt,
          end_at: endAt,
          all_day: isAllDay,
          status: 'confirmed',
          organizer_email: gEvent.organizer?.email ?? null,
          is_recurring: false,
        });
        imported++;
      }
    }
  } while (pageToken);

  // Persist new sync token
  if (newSyncToken) {
    await db
      .from('calendar_sync_config')
      .update({
        metadata: { ...config.metadata, sync_token: newSyncToken },
        last_sync_at: new Date().toISOString(),
      })
      .eq('id', config.id);
  }

  return { imported, updated, skipped, syncToken: newSyncToken };
}

/** Push a local event to Google Calendar. Returns the Google event ID. */
export async function pushEventToGoogle(
  config: SyncConfig,
  event: {
    title: string;
    description?: string | null;
    location?: string | null;
    start_at: string;
    end_at: string;
    all_day: boolean;
  },
): Promise<string | null> {
  const accessToken = await getValidAccessToken(config);
  if (!accessToken) return null;

  const calendarId = encodeURIComponent(config.google_calendar_id);

  const body = {
    summary: event.title,
    description: event.description ?? undefined,
    location: event.location ?? undefined,
    start: event.all_day ? { date: event.start_at.split('T')[0] } : { dateTime: event.start_at },
    end: event.all_day ? { date: event.end_at.split('T')[0] } : { dateTime: event.end_at },
  };

  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error('[google-sync] Push event failed:', res.status);
    return null;
  }

  const data = (await res.json()) as { id?: string };
  return data.id ?? null;
}
