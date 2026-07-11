import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { eventImportSchema } from '@/lib/schema';
import { createEvent } from '@/lib/store';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON の構文が不正です' }, { status: 400 });
  }
  try {
    const input = eventImportSchema.parse(body);
    const { id } = createEvent(input);
    return NextResponse.json({ id, url: `/events/${id}` }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: '入稿 JSON がスキーマに一致しません',
          issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
        { status: 422 },
      );
    }
    throw err;
  }
}
