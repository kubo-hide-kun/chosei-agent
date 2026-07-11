import { NextRequest, NextResponse } from 'next/server';
import { getEvent } from '@/server/application/useCases/events';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = getEvent(id);
  if (!event) {
    return NextResponse.json({ error: 'イベントが見つかりません' }, { status: 404 });
  }
  return NextResponse.json(event);
}
