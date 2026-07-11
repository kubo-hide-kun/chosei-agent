import { notFound } from 'next/navigation';
import { getEvent } from '@/server/application/useCases/events';
import EventView from './EventView';

export const dynamic = 'force-dynamic';

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = getEvent(id);
  if (!event) notFound();
  return <EventView event={event} />;
}
