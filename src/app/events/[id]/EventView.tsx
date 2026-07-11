'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { EventDetail } from '@/server/repositories/eventRepository';
import type { Mark } from '@/server/domain/event';

const MARK_LABEL: Record<Mark, string> = { ok: '◯', maybe: '△', ng: '✕' };
const MARKS: Mark[] = ['ok', 'maybe', 'ng'];

export default function EventView({ event }: { event: EventDetail }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justCreated = searchParams.get('created') === '1';

  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [answers, setAnswers] = useState<Record<string, Mark>>(() =>
    Object.fromEntries(event.candidates.map((c) => [c.id, 'ok' as Mark])),
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setShareUrl(`${window.location.origin}/events/${event.id}`);
  }, [event.id]);

  const scores = useMemo(() => {
    const map = new Map<string, { ok: number; maybe: number; score: number }>();
    for (const c of event.candidates) {
      let ok = 0;
      let maybe = 0;
      for (const r of event.responses) {
        if (r.answers[c.id] === 'ok') ok++;
        if (r.answers[c.id] === 'maybe') maybe++;
      }
      map.set(c.id, { ok, maybe, score: ok * 2 + maybe });
    }
    return map;
  }, [event]);

  const bestScore = Math.max(0, ...[...scores.values()].map((s) => s.score));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/events/${event.id}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, comment, answers }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? '回答の送信に失敗しました');
        return;
      }
      setName('');
      setComment('');
      router.refresh();
    } catch {
      setError('通信に失敗しました。時間をおいて再度お試しください。');
    } finally {
      setBusy(false);
    }
  }

  async function copyShareUrl() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* クリップボード未対応環境では入力欄から手動コピーしてもらう */
    }
  }

  return (
    <>
      <section className="sp-card">
        <h1 className="sp-heading-1">{event.title}</h1>
        {event.description && <p className="sp-text-sub">{event.description}</p>}
        {justCreated && (
          <div className="sp-note">
            イベントを作成しました。以下の URL を参加者に共有してください。
          </div>
        )}
        <div className="sp-share">
          <input className="sp-input" value={shareUrl} readOnly aria-label="共有URL" />
          <button type="button" className="sp-button sp-button--outlined" onClick={copyShareUrl}>
            {copied ? 'コピーしました' : 'URL をコピー'}
          </button>
        </div>
      </section>

      <section className="sp-card">
        <h2 className="sp-heading-2">回答状況</h2>
        <p className="sp-help">
          ◯ = 参加できる / △ = 調整すれば参加できる / ✕ = 参加できない。
          ★ が付いた行は現時点の最有力候補です(◯ = 2 点、△ = 1 点で採点した最高得点の候補)。
        </p>
        <div className="sp-table-wrap">
          <table className="sp-table">
            <thead>
              <tr>
                <th scope="col">候補日時</th>
                <th scope="col">◯</th>
                <th scope="col">△</th>
                {event.responses.map((r) => (
                  <th scope="col" key={r.id}>
                    {r.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {event.candidates.map((c) => {
                const s = scores.get(c.id)!;
                const isBest = event.responses.length > 0 && s.score === bestScore && bestScore > 0;
                return (
                  <tr key={c.id} className={isBest ? 'is-best' : undefined}>
                    <th scope="row">{c.label}</th>
                    <td>{s.ok}</td>
                    <td>{s.maybe}</td>
                    {event.responses.map((r) => {
                      const mark = r.answers[c.id];
                      return (
                        <td key={r.id}>
                          {mark ? (
                            <span className={`sp-mark sp-mark--${mark}`}>{MARK_LABEL[mark]}</span>
                          ) : (
                            <span className="sp-text-sub">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {event.responses.some((r) => r.comment) && (
          <div>
            <h3 className="sp-heading-2" style={{ marginTop: 16 }}>
              コメント
            </h3>
            <ul>
              {event.responses
                .filter((r) => r.comment)
                .map((r) => (
                  <li key={r.id}>
                    <strong>{r.name}</strong>: {r.comment}
                  </li>
                ))}
            </ul>
          </div>
        )}
      </section>

      <section className="sp-card">
        <h2 className="sp-heading-2">出欠を回答する</h2>
        <p className="sp-help">
          名前を入力し、候補ごとに ◯ / △ / ✕ を選んで送信してください。送信するとすぐ上の集計表に反映されます。
          回答の修正は未対応のため、間違えた場合は幹事に連絡してください。
        </p>
        <form onSubmit={handleSubmit}>
          <div className="sp-field">
            <label className="sp-label" htmlFor="respondent-name">
              名前
            </label>
            <input
              id="respondent-name"
              className="sp-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={50}
            />
          </div>
          <div className="sp-table-wrap">
            <table className="sp-table">
              <tbody>
                {event.candidates.map((c) => (
                  <tr key={c.id}>
                    <th scope="row">{c.label}</th>
                    <td>
                      <div
                        className="sp-radio-group"
                        role="radiogroup"
                        aria-label={`${c.label} の出欠`}
                      >
                        {MARKS.map((mark) => {
                          const inputId = `answer-${c.id}-${mark}`;
                          return (
                            <span key={mark}>
                              <input
                                type="radio"
                                id={inputId}
                                name={`answer-${c.id}`}
                                checked={answers[c.id] === mark}
                                onChange={() => setAnswers({ ...answers, [c.id]: mark })}
                              />
                              <label htmlFor={inputId}>{MARK_LABEL[mark]}</label>
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="sp-field" style={{ marginTop: 16 }}>
            <label className="sp-label" htmlFor="respondent-comment">
              コメント(任意)
            </label>
            <textarea
              id="respondent-comment"
              className="sp-textarea sp-textarea--plain"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>
          {error && (
            <p className="sp-error" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="sp-button sp-button--contained"
            disabled={busy || name.trim().length === 0}
          >
            回答を送信
          </button>
        </form>
      </section>
    </>
  );
}
