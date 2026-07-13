'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { EventDetail } from '@/server/repositories/eventRepository';
import type { Mark } from '@/server/domain/event';
import AccessKeyInput from '../../AccessKeyInput';
import { checkJsonSyntax } from '../../jsonStatus';
import { useAccessKey } from '../../useAccessKey';

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
  // 初期値は「未選択」。既定で ◯ を付けると、確認せず送信したときに
  // 行けない日へ ◯ が付く事故になるため、参加者の明示的な選択だけを記録する
  const [answers, setAnswers] = useState<Record<string, Mark>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [accessKey, setAccessKey] = useAccessKey();
  const [aiAnswerText, setAiAnswerText] = useState('');
  const [aiAnswerNote, setAiAnswerNote] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lastSubmitWasUpdate, setLastSubmitWasUpdate] = useState(false);
  const [allowDiagnosticLogging, setAllowDiagnosticLogging] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState('');
  const [editError, setEditError] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [editSaved, setEditSaved] = useState(false);

  useEffect(() => {
    setShareUrl(`${window.location.origin}/events/${event.id}`);
  }, [event.id]);

  const editStatus = useMemo(() => checkJsonSyntax(editText), [editText]);

  function openEdit() {
    setEditText(
      JSON.stringify(
        {
          title: event.title,
          description: event.description,
          candidates: event.candidates.map((c) => ({
            date: c.date,
            ...(c.start ? { start: c.start } : {}),
            ...(c.end ? { end: c.end } : {}),
            label: c.label,
          })),
        },
        null,
        2,
      ),
    );
    setEditError('');
    setEditSaved(false);
    setEditOpen(true);
  }

  async function handleEditSubmit() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(editText);
    } catch (e) {
      setEditError(`JSON の構文が不正です: ${(e as Error).message}`);
      return;
    }
    setEditBusy(true);
    setEditError('');
    setEditSaved(false);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = Array.isArray(data.issues)
          ? '\n' + data.issues.map((i: { path: string; message: string }) => `- ${i.path}: ${i.message}`).join('\n')
          : '';
        setEditError((data.error ?? 'イベントの更新に失敗しました') + detail);
        return;
      }
      setEditSaved(true);
      setEditOpen(false);
      router.refresh();
    } catch {
      setEditError('通信に失敗しました。時間をおいて再度お試しください。');
    } finally {
      setEditBusy(false);
    }
  }

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

  // 同じ名前(前後の空白を除去して完全一致)の既存回答があれば上書き対象として案内する(ADR 0012)
  const matchedResponse = useMemo(
    () => event.responses.find((r) => r.name === name.trim()) ?? null,
    [event.responses, name],
  );

  function loadMatchedResponse() {
    if (!matchedResponse) return;
    setComment(matchedResponse.comment);
    setAnswers({ ...matchedResponse.answers });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSubmitted(false);
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
      setAnswers({});
      setAiAnswerText('');
      setAiAnswerNote('');
      setSubmitted(true);
      setLastSubmitWasUpdate(Boolean(data.updated));
      router.refresh();
    } catch {
      setError('通信に失敗しました。時間をおいて再度お試しください。');
    } finally {
      setBusy(false);
    }
  }

  async function handleAiAnswer() {
    setAiBusy(true);
    setError('');
    setAiAnswerNote('');
    try {
      const res = await fetch(`/api/events/${event.id}/agent/parse-answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-access-key': accessKey },
        body: JSON.stringify({ text: aiAnswerText, allowDiagnosticLogging }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? '回答の解析に失敗しました');
        return;
      }
      const parsed: Record<string, Mark> = data.answers ?? {};
      setAnswers((prev) => ({ ...prev, ...parsed }));
      if (data.name && !name) setName(data.name);
      if (data.comment && !comment) setComment(data.comment);
      const count = Object.keys(parsed).length;
      setAiAnswerNote(
        `${count} 件の候補に回答を反映しました(エンジン: ${data.engine === 'claude' ? 'Claude' : 'ルールベース'})。` +
          (count < event.candidates.length
            ? ' 読み取れなかった候補は下の表で選択してから送信してください。'
            : ' 内容を確認して送信してください。'),
      );
    } catch {
      setError('通信に失敗しました。時間をおいて再度お試しください。');
    } finally {
      setAiBusy(false);
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
      <p className="sp-back">
        <Link href="/">← 新しいイベントを作成する</Link>
      </p>
      <section className="sp-card">
        <div className="sp-label-row">
          <h1 className="sp-heading-1">{event.title}</h1>
          <button
            type="button"
            className="sp-textbtn"
            onClick={() => (editOpen ? setEditOpen(false) : openEdit())}
          >
            {editOpen ? '編集をやめる' : 'イベント内容を編集'}
          </button>
        </div>
        {event.description && <p className="sp-text-sub">{event.description}</p>}
        {justCreated && (
          <div className="sp-note">
            イベントを作成しました。<strong>次にすること:</strong> 以下の URL
            をコピーして、参加者にチャットやメールで共有してください。
          </div>
        )}
        {editSaved && !editOpen && (
          <div className="sp-note" role="status">
            変更を保存しました。
          </div>
        )}
        {editOpen && (
          <div className="sp-field">
            <p className="sp-help">
              タイトル・説明・候補日時を JSON で編集できます。この URL を知っている人は誰でも編集できます。
              日付・開始・終了が変わらない候補はそのまま残り、既存の回答も保持されます。
              候補を削除すると、その候補への回答は破棄されます。
            </p>
            <label className="sp-label" htmlFor="edit-json">
              編集する内容(JSON)
            </label>
            <textarea
              id="edit-json"
              className="sp-textarea"
              rows={12}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              aria-describedby="edit-json-status"
            />
            <p
              id="edit-json-status"
              className={editStatus.state === 'valid' ? 'sp-valid' : 'sp-invalid'}
              aria-live="polite"
            >
              {editStatus.message}
            </p>
            {editError && (
              <p className="sp-error" role="alert">
                {editError}
              </p>
            )}
            <div className="sp-share">
              <button
                type="button"
                className="sp-button sp-button--contained"
                onClick={() => void handleEditSubmit()}
                disabled={editBusy || editStatus.state !== 'valid'}
              >
                {editBusy ? '保存中…' : '変更を保存 →'}
              </button>
              <button
                type="button"
                className="sp-button sp-button--outlined"
                onClick={() => setEditOpen(false)}
                disabled={editBusy}
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
        <div className="sp-share">
          <input className="sp-input" value={shareUrl} readOnly aria-label="共有URL" />
          <button
            type="button"
            className={`sp-button ${justCreated ? 'sp-button--contained' : 'sp-button--outlined'}`}
            onClick={copyShareUrl}
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            {copied ? 'コピーしました ✓' : 'URL をコピー'}
          </button>
        </div>
      </section>

      <section className="sp-card">
        <h2 className="sp-heading-2">
          回答状況
          <span className="sp-count">{event.responses.length} 人が回答済み</span>
        </h2>
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
          選択しなかった候補は「回答なし(-)」として記録されます。
          すでに回答した名前と同じ名前で再送信すると、別行を追加せずその回答を上書き修正します。
        </p>

        <div className="sp-ai-answer">
          <div className="sp-label-row">
            <label className="sp-label" htmlFor="ai-answer-text">
              AI エージェントで回答(自然文から ◯/△/✕ を自動入力)
            </label>
            <button
              type="button"
              className="sp-textbtn"
              onClick={() =>
                setAiAnswerText(
                  `${event.candidates[0]?.label ?? ''} は行けます、それ以外は微妙です`,
                )
              }
            >
              例文を入れる
            </button>
          </div>
          <textarea
            id="ai-answer-text"
            className="sp-textarea sp-textarea--plain"
            rows={3}
            placeholder="例: 田中です。火曜は行けます、金曜は無理、土曜は微妙。遅れるかもです"
            value={aiAnswerText}
            onChange={(e) => setAiAnswerText(e.target.value)}
          />
          <div className="sp-ai-answer-controls">
            <AccessKeyInput
              id="answer-access-key"
              value={accessKey}
              onChange={setAccessKey}
              placeholder="合言葉(設定されている場合)"
              ariaLabel="合言葉(アクセスキー)"
            />
            <button
              type="button"
              className="sp-button sp-button--outlined"
              onClick={handleAiAnswer}
              disabled={aiBusy || aiAnswerText.trim().length === 0}
            >
              {aiBusy ? '解析中…' : 'AI に読み取らせる'}
            </button>
          </div>
          <div className="sp-field sp-field--checkbox">
            <label className="sp-checkbox-label" htmlFor="allow-diagnostic-logging-answer">
              <input
                id="allow-diagnostic-logging-answer"
                type="checkbox"
                checked={allowDiagnosticLogging}
                onChange={(e) => setAllowDiagnosticLogging(e.target.checked)}
              />
              AI の解析に失敗した場合、原因調査のため入力内容と AI の応答を運営のログに一時的に記録することに同意する
            </label>
            <p className="sp-help">
              通常は入力内容をログに残しません。同意した場合のみ、解析に失敗したときに限り、
              上の入力文と AI の応答がサーバーのログ(運営者のみ閲覧可能)に記録されます。
              任意項目です。チェックしなくても AI 解析・回答送信は利用できます。
            </p>
          </div>
          <p className="sp-help">
            読み取り結果は下の表に反映されるだけで、まだ送信されません。内容を確認・修正してから「回答を送信」を押してください。
          </p>
          {aiAnswerNote && <div className="sp-note">{aiAnswerNote}</div>}
        </div>

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
          {matchedResponse && (
            <div className="sp-note" role="status">
              「{matchedResponse.name}」はすでに回答済みです。このまま送信すると内容が上書きされます。
              <button type="button" className="sp-textbtn" onClick={loadMatchedResponse}>
                登録済みの回答を読み込んで編集
              </button>
            </div>
          )}
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
          {submitted && (
            <div className="sp-note" role="status">
              {lastSubmitWasUpdate
                ? '回答を修正しました。上の集計表に反映されています。'
                : '回答を送信しました。上の集計表に反映されています。ありがとうございました!'}
            </div>
          )}
          <button
            type="submit"
            className="sp-button sp-button--contained"
            disabled={busy || name.trim().length === 0 || Object.keys(answers).length === 0}
          >
            {busy ? '送信中…' : '回答を送信 →'}
          </button>
        </form>
      </section>
    </>
  );
}
