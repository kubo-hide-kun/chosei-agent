import { nanoid } from 'nanoid';
import { getDb } from './db';
import {
  eventImportSchema,
  normalizeCandidate,
  type EventImport,
  type Mark,
  type NormalizedCandidate,
  type ResponseInput,
} from './schema';

export interface CandidateRow extends NormalizedCandidate {
  id: string;
  sort: number;
}

export interface EventDetail {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  candidates: CandidateRow[];
  responses: {
    id: string;
    name: string;
    comment: string;
    answers: Record<string, Mark>;
  }[];
}

export function createEvent(input: EventImport): { id: string } {
  const parsed = eventImportSchema.parse(input);
  const db = getDb();
  const eventId = nanoid(12);
  const insertEvent = db.prepare(
    'INSERT INTO events (id, title, description) VALUES (?, ?, ?)',
  );
  const insertCandidate = db.prepare(
    'INSERT INTO candidates (id, event_id, date, start, end, label, sort) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  db.transaction(() => {
    insertEvent.run(eventId, parsed.title, parsed.description ?? '');
    parsed.candidates.forEach((raw, i) => {
      const c = normalizeCandidate(raw);
      insertCandidate.run(nanoid(10), eventId, c.date, c.start, c.end, c.label, i);
    });
  })();
  return { id: eventId };
}

export function getEvent(id: string): EventDetail | null {
  const db = getDb();
  const event = db
    .prepare('SELECT id, title, description, created_at AS createdAt FROM events WHERE id = ?')
    .get(id) as { id: string; title: string; description: string; createdAt: string } | undefined;
  if (!event) return null;

  const candidates = db
    .prepare(
      'SELECT id, date, start, end, label, sort FROM candidates WHERE event_id = ? ORDER BY sort',
    )
    .all(id) as CandidateRow[];

  const responseRows = db
    .prepare(
      'SELECT id, name, comment FROM responses WHERE event_id = ? ORDER BY created_at, id',
    )
    .all(id) as { id: string; name: string; comment: string }[];

  const answerRows = db
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

export function addResponse(eventId: string, input: ResponseInput): { id: string } {
  const db = getDb();
  const event = db.prepare('SELECT id FROM events WHERE id = ?').get(eventId);
  if (!event) throw new NotFoundError('イベントが見つかりません');

  const candidateIds = new Set(
    (db.prepare('SELECT id FROM candidates WHERE event_id = ?').all(eventId) as { id: string }[]).map(
      (c) => c.id,
    ),
  );
  for (const candidateId of Object.keys(input.answers)) {
    if (!candidateIds.has(candidateId)) {
      throw new ValidationError(`不明な候補IDです: ${candidateId}`);
    }
  }

  const responseId = nanoid(10);
  const insertResponse = db.prepare(
    'INSERT INTO responses (id, event_id, name, comment) VALUES (?, ?, ?, ?)',
  );
  const insertAnswer = db.prepare(
    'INSERT INTO answers (response_id, candidate_id, mark) VALUES (?, ?, ?)',
  );
  db.transaction(() => {
    insertResponse.run(responseId, eventId, input.name, input.comment ?? '');
    for (const [candidateId, mark] of Object.entries(input.answers)) {
      insertAnswer.run(responseId, candidateId, mark);
    }
  })();
  return { id: responseId };
}

export class NotFoundError extends Error {}
export class ValidationError extends Error {}
