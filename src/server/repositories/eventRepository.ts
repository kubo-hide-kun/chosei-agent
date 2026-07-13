import type { EventImport, Mark, NormalizedCandidate, ResponseInput } from '@/server/domain/event';

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

/** イベント・回答の永続化ポート。実装は infrastructure/repositories に置く */
export interface EventRepository {
  createEvent(input: EventImport): { id: string };
  getEvent(id: string): EventDetail | null;
  /**
   * title・description・candidates を丸ごと置き換える。
   * candidates は (date, start, end) が一致する既存候補の id を再利用して回答を保持し、
   * 一致しない既存候補は削除する(紐づく回答も cascade で消える)。
   */
  updateEvent(id: string, input: EventImport): void;
  addResponse(eventId: string, input: ResponseInput): { id: string };
}

export class NotFoundError extends Error {}
export class ValidationError extends Error {}
