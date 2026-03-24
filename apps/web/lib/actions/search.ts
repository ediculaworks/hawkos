'use server';

import { db } from '@hawk/db';
import { searchAccounts } from '@hawk/module-finances/queries';
import { searchBooks, searchNotes } from '@hawk/module-knowledge/queries';
import { searchMemories } from '@hawk/module-memory/queries';
import { searchObjectives, searchTasks } from '@hawk/module-objectives/queries';
import { withTenant } from '../supabase/with-tenant';

export type EntityType = 'person' | 'objective' | 'task' | 'account' | 'note' | 'book' | 'memory';

export type EntitySearchResult = {
  id: string;
  type: EntityType;
  label: string;
  sublabel?: string;
  moduleId: string;
};

export async function searchEntities(
  query: string,
  types?: EntityType[],
): Promise<EntitySearchResult[]> {
  return withTenant(async () => {
    if (!query || query.length < 2) return [];

    const typesToSearch = types ?? [
      'person',
      'objective',
      'task',
      'account',
      'note',
      'book',
      'memory',
    ];
    const results: EntitySearchResult[] = [];

    const searches = typesToSearch.map(async (type) => {
      switch (type) {
        case 'person': {
          const { data } = await db
            .from('people')
            .select('id, name, relationship')
            .ilike('name', `%${query}%`)
            .limit(5);
          for (const p of data ?? []) {
            results.push({
              id: p.id,
              type: 'person',
              label: p.name,
              sublabel: p.relationship ?? undefined,
              moduleId: 'people',
            });
          }
          break;
        }
        case 'objective': {
          const objectives = await searchObjectives(query, 5);
          for (const o of objectives) {
            results.push({
              id: o.id,
              type: 'objective',
              label: o.title,
              sublabel: `${o.progress}%`,
              moduleId: 'objectives',
            });
          }
          break;
        }
        case 'task': {
          const tasks = await searchTasks(query, 5);
          for (const t of tasks) {
            results.push({
              id: t.id,
              type: 'task',
              label: t.title,
              sublabel: t.status,
              moduleId: 'objectives',
            });
          }
          break;
        }
        case 'account': {
          const accounts = await searchAccounts(query, 5);
          for (const a of accounts) {
            results.push({
              id: a.id,
              type: 'account',
              label: a.name,
              sublabel: a.type,
              moduleId: 'finances',
            });
          }
          break;
        }
        case 'note': {
          const notes = await searchNotes(query, 5);
          for (const n of notes) {
            results.push({
              id: n.id,
              type: 'note',
              label: n.title ?? n.content.slice(0, 50),
              sublabel: n.type,
              moduleId: 'knowledge',
            });
          }
          break;
        }
        case 'book': {
          const books = await searchBooks(query, 5);
          for (const b of books) {
            results.push({
              id: b.id,
              type: 'book',
              label: b.title,
              sublabel: b.author ?? b.status,
              moduleId: 'knowledge',
            });
          }
          break;
        }
        case 'memory': {
          const memories = await searchMemories(query, 5);
          for (const m of memories) {
            results.push({
              id: m.id,
              type: 'memory',
              label: m.content.slice(0, 60),
              sublabel: m.category,
              moduleId: 'memory',
            });
          }
          break;
        }
      }
    });

    await Promise.all(searches);
    return results;
  });
}
