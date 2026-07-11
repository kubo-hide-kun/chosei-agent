import { NextResponse } from 'next/server';
import { getEvent } from '@/server/application/useCases/events';
import { withApiLogging } from '@/server/infrastructure/logging/withApiLogging';

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApiLogging<Ctx>('/api/events/[id]', async (_req, ctx) => {
  const { id } = await ctx.params;
  const event = getEvent(id);
  if (!event) {
    return NextResponse.json({ error: 'イベントが見つかりません' }, { status: 404 });
  }
  return NextResponse.json(event);
});
