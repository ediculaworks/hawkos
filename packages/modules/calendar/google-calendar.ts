import { db } from '@hawk/db';
// @ts-expect-error optional dependency
import { type calendar_v3, google } from 'googleapis';
import type { CalendarEvent } from './types';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CALENDAR_CLIENT_ID,
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
  process.env.GOOGLE_CALENDAR_REDIRECT_URI,
);

const googleCalendar = google.calendar({
  version: 'v3',
  auth: oauth2Client,
});

/**
 * Gerar URL de autorização para Google Calendar
 */
export function getAuthorizationUrl(): string {
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.readonly',
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  });
}

/**
 * Processar código de autorização e obter tokens
 */
export async function handleAuthorizationCode(code: string): Promise<void> {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Salvar tokens no banco
    const { error } = await db
      .from('calendar_sync_config')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: new Date(tokens.expiry_date || Date.now() + 3600 * 1000).toISOString(),
      })
      .eq('calendar_id', 'personal');

    if (error) {
      process.emitWarning(`Failed to update tokens: ${error.message}`);
    }
  } catch (_error) {
    process.emitWarning(`Failed to refresh token: ${_error}`);
  }
}

/**
 * Sincronizar eventos do Google Calendar para o banco local
 */
export async function syncFromGoogleCalendar(): Promise<number> {
  try {
    // Restaurar credenciais do banco
    const { data: config, error: configError } = await db
      .from('calendar_sync_config')
      .select('access_token, refresh_token')
      .eq('calendar_id', 'personal')
      .single();

    if (configError || !config) {
      return 0;
    }

    oauth2Client.setCredentials({
      access_token: config.access_token,
      refresh_token: config.refresh_token,
    });

    // Buscar eventos dos últimos 30 dias até 90 dias no futuro
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const response = await googleCalendar.events.list({
      calendarId: 'primary',
      timeMin: startOfMonth.toISOString(),
      timeMax: endDate.toISOString(),
      maxResults: 100,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];
    let syncedCount = 0;

    for (const event of events) {
      if (!event.id || !event.summary) continue;

      const startTime = event.start?.dateTime || event.start?.date || new Date().toISOString();
      const endTime = event.end?.dateTime || event.end?.date || startTime;

      const { error: upsertError } = await db.from('calendar_events').upsert(
        {
          google_event_id: event.id,
          title: event.summary,
          description: event.description,
          location: event.location,
          start_at: startTime,
          end_at: endTime,
          all_day: !event.start?.dateTime,
          status: event.status as 'confirmed' | 'cancelled' | 'tentative',
          organizer_email: event.organizer?.email,
          is_recurring: !!event.recurringEventId,
          recurrence_rule: event.recurrence?.[0],
        },
        { onConflict: 'google_event_id' },
      );

      if (!upsertError) syncedCount++;
    }

    // Atualizar last_sync_at
    await db
      .from('calendar_sync_config')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('calendar_id', 'personal');

    return syncedCount;
  } catch (_error) {
    return 0;
  }
}

/**
 * Criar evento no Google Calendar (sincronização de volta)
 */
export async function pushToGoogleCalendar(event: CalendarEvent): Promise<string | null> {
  try {
    const { data: config } = await db
      .from('calendar_sync_config')
      .select('access_token, refresh_token, google_calendar_id')
      .eq('calendar_id', 'personal')
      .single();

    if (!config?.access_token) {
      return null;
    }

    oauth2Client.setCredentials({
      access_token: config.access_token,
      refresh_token: config.refresh_token,
    });

    const googleEvent: calendar_v3.Schema$Event = {
      summary: event.title,
      description: event.description,
      location: event.location,
      start: {
        dateTime: event.start_at,
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: event.end_at,
        timeZone: 'America/Sao_Paulo',
      },
    };

    const response = await googleCalendar.events.insert({
      calendarId: config.google_calendar_id || 'primary',
      requestBody: googleEvent,
    });

    if (response.data.id) {
      // Atualizar banco com google_event_id
      await db
        .from('calendar_events')
        .update({ google_event_id: response.data.id })
        .eq('id', event.id);
    }

    return response.data.id || null;
  } catch (_error) {
    return null;
  }
}

/**
 * Agendador de sincronização automática
 * Executar a cada 30 minutos
 */
export async function scheduleSyncJob(): Promise<void> {
  setInterval(
    async () => {
      const synced = await syncFromGoogleCalendar();
      if (synced > 0) {
      }
    },
    30 * 60 * 1000,
  ); // 30 minutos
}
