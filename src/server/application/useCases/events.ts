import type { EventImport, ResponseInput } from '@/server/domain/event';
import type { EventDetail, EventRepository } from '@/server/repositories/eventRepository';
import { getEventRepository } from '@/server/infrastructure/runtime/container';

export function createEvent(
  input: EventImport,
  repo: EventRepository = getEventRepository(),
): { id: string } {
  return repo.createEvent(input);
}

export function getEvent(
  id: string,
  repo: EventRepository = getEventRepository(),
): EventDetail | null {
  return repo.getEvent(id);
}

export function addResponse(
  eventId: string,
  input: ResponseInput,
  repo: EventRepository = getEventRepository(),
): { id: string } {
  return repo.addResponse(eventId, input);
}
