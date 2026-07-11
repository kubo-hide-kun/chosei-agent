import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import fs from 'node:fs';
import path from 'node:path';
import {
  eventImportSchema,
  normalizeCandidate,
  type EventImport,
  type Mark,
  type ResponseInput,
} from '@/server/domain/event';
import {
  NotFoundError,
  ValidationError,
  type CandidateRow,
  type EventDetail,
  type EventRepository,
} from '@/server/repositories/eventRepository';

export class SqliteEventRepository implements EventRepository {
  private readonly db: Database.Database;

  constructor(dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.db = new Database(path.join(dataDir, 'chosei.db'));
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS candidates (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        start TEXT,
        end TEXT,
        label TEXT NOT NULL,
        sort INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS responses (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        comment TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS answers (
        response_id TEXT NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
        candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
        mark TEXT NOT NULL CHECK (mark IN ('ok', 'maybe', 'ng')),
        PRIMARY KEY (response_id, candidate_id)
      );
      CREATE INDEX IF NOT EXISTS idx_candidates_event ON candidates(event_id);
      CREATE INDEX IF NOT EXISTS idx_responses_event ON responses(event_id);
    `);
  }

  createEvent(input: EventImport): { id: string } {
    const parsed = eventImportSchema.parse(input);
    const eventId = nanoid(12);
    const insertEvent = this.db.prepare(
      'INSERT INTO events (id, title, description) VALUES (?, ?, ?)',
    );
    const insertCandidate = this.db.prepare(
      'INSERT INTO candidates (id, event_id, date, start, end, label, sort) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    this.db.transaction(() => {
      insertEvent.run(eventId, parsed.title, parsed.description ?? '');
      parsed.candidates.forEach((raw, i) => {
        const c = normalizeCandidate(raw);
        insertCandidate.run(nanoid(10), eventId, c.date, c.start, c.end, c.label, i);
      });
    })();
    return { id: eventId };
  }

  getEvent(id: string): EventDetail | null {
    const event = this.db
      .prepare('SELECT id, title, description, created_at AS createdAt FROM events WHERE id = ?')
      .get(id) as { id: string; title: string; description: string; createdAt: string } | undefined;
    if (!event) return null;

    const candidates = this.db
      .prepare(
        'SELECT id, date, start, end, label, sort FROM candidates WHERE event_id = ? ORDER BY sort',
      )
      .all(id) as CandidateRow[];

    const responseRows = this.db
      .prepare(
        'SELECT id, name, comment FROM responses WHERE event_id = ? ORDER BY created_at, id',
      )
      .all(id) as { id: string; name: string; comment: string }[];

    const answerRows = this.db
      .prepare(
        `SELECT a.response_id AS responseId, a.candidate_id AS candidateId, a.mark
         FROM answers a JOIN responses r ON r.id = a.response_id
         WHERE r.event_id = ?`,
      )
      .all(id) as { responseId: string; candidateId: string; mark: Mark }[];

    const answersByResponse = new Map<string, Record<string, Mark>>();
    for (const row of answerRows) {
      const bucket = answersByResponse.get(row.responseId) ?? {};
      bucket[row.candidateId] = row.mark;
      answersByResponse.set(row.responseId, bucket);
    }

    return {
      ...event,
      candidates,
      responses: responseRows.map((r) => ({
        ...r,
        answers: answersByResponse.get(r.id) ?? {},
      })),
    };
  }

  addResponse(eventId: string, input: ResponseInput): { id: string } {
    const event = this.db.prepare('SELECT id FROM events WHERE id = ?').get(eventId);
    if (!event) throw new NotFoundError('イベントが見つかりません');

    const candidateIds = new Set(
      (
        this.db.prepare('SELECT id FROM candidates WHERE event_id = ?').all(eventId) as {
          id: string;
        }[]
      ).map((c) => c.id),
    );
    for (const candidateId of Object.keys(input.answers)) {
      if (!candidateIds.has(candidateId)) {
        throw new ValidationError(`不明な候補IDです: ${candidateId}`);
      }
    }

    const responseId = nanoid(10);
    const insertResponse = this.db.prepare(
      'INSERT INTO responses (id, event_id, name, comment) VALUES (?, ?, ?, ?)',
    );
    const insertAnswer = this.db.prepare(
      'INSERT INTO answers (response_id, candidate_id, mark) VALUES (?, ?, ?)',
    );
    this.db.transaction(() => {
      insertResponse.run(responseId, eventId, input.name, input.comment ?? '');
      for (const [candidateId, mark] of Object.entries(input.answers)) {
        insertAnswer.run(responseId, candidateId, mark);
      }
    })();
    return { id: responseId };
  }
}
