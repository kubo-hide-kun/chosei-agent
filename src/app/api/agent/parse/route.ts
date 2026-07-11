import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { parseScheduleText } from '@/server/application/useCases/parseScheduleText';

const requestSchema = z.object({
  text: z.string().min(1, 'text は必須です').max(4000),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON の構文が不正です' }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 });
  }
  const result = await parseScheduleText(parsed.data.text);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, engine: result.engine }, { status: 422 });
  }
  return NextResponse.json({ event: result.event, engine: result.engine });
}
