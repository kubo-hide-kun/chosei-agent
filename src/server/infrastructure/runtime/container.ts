import path from 'node:path';
import type { EventRepository } from '@/server/repositories/eventRepository';
import { SqliteEventRepository } from '@/server/infrastructure/repositories/sqliteEventRepository';

/**
 * 依存の合成点(composition root)。
 * application 層はポート(repositories)にのみ依存し、実装の解決はここに集約する。
 */
let eventRepository: EventRepository | null = null;

export function getEventRepository(): EventRepository {
  if (!eventRepository) {
    const dataDir = process.env.CHOSEI_DATA_DIR ?? path.join(process.cwd(), 'data');
    eventRepository = new SqliteEventRepository(dataDir);
  }
  return eventRepository;
}
