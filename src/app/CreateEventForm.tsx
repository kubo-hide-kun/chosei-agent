'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAccessKey } from './useAccessKey';

const JSON_PLACEHOLDER = `{
  "title": "新年会",
  "description": "会場は渋谷を予定しています",
  "candidates": [
    { "date": "2026-07-21", "start": "19:00", "end": "21:00" },
    { "date": "2026-07-22", "start": "19:00", "end": "21:00" },
    "2026-07-24 19:00-21:00"
  ]
}`;

const AI_PLACEHOLDER = `例: チームの暑気払い。来週の火曜と木曜の夜、あと 7/24 の 19時から21時 でお願いします`;

interface PreviewEvent {
  title: string;
  description?: string;
  candidates: unknown[];
}

type Tab = 'ai' | 'json';

export default function CreateEventForm() {
  const router = useRouter();
  const [accessKey, setAccessKey] = useAccessKey();
  const [tab, setTab] = useState<Tab>('ai');
  const [aiText, setAiText] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [preview, setPreview] = useState<{ event: PreviewEvent; engine?: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function switchTab(next: Tab) {
    setTab(next);
    setPreview(null);
    setError('');
  }

  async function handleAiParse() {
    setBusy(true);
    setError('');
    setPreview(null);
    try {
      const res = await fetch('/api/agent/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-access-key': accessKey },
        body: JSON.stringify({ text: aiText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? '解析に失敗しました');
        return;
      }
      setPreview({ event: data.event, engine: data.engine });
    } catch {
      setError('通信に失敗しました。時間をおいて再度お試しください。');
    } finally {
      setBusy(false);
    }
  }

  async function createEvent(payload: unknown) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-access-key': accessKey },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = Array.isArray(data.issues)
          ? '\n' + data.issues.map((i: { path: string; message: string }) => `- ${i.path}: ${i.message}`).join('\n')
          : '';
        setError((data.error ?? 'イベントの作成に失敗しました') + detail);
        return;
      }
      router.push(data.url + '?created=1');
    } catch {
      setError('通信に失敗しました。時間をおいて再度お試しください。');
    } finally {
      setBusy(false);
    }
  }

  function handleJsonSubmit() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      setError(`JSON の構文が不正です: ${(e as Error).message}`);
      return;
    }
    void createEvent(parsed);
  }

  return (
    <section className="sp-card">
      <h2 className="sp-heading-2">イベントを作成</h2>
      <div className="sp-field">
        <label className="sp-label" htmlFor="access-key">
          合言葉(アクセスキー)
        </label>
        <input
          id="access-key"
          className="sp-input"
          type="password"
          value={accessKey}
          onChange={(e) => setAccessKey(e.target.value)}
          autoComplete="off"
          placeholder="管理者から共有された合言葉"
        />
        <p className="sp-help">
          管理者が合言葉を設定している場合、イベント作成と AI 解析に必要です(この端末に記憶されます)。
          未設定の環境では空欄のまま利用できます。
        </p>
      </div>
      <div className="sp-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'ai'}
          className="sp-tab"
          onClick={() => switchTab('ai')}
        >
          AI エージェントで入稿
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'json'}
          className="sp-tab"
          onClick={() => switchTab('json')}
        >
          JSON で入稿
        </button>
      </div>

      {tab === 'ai' && (
        <div>
          <div className="sp-field">
            <label className="sp-label" htmlFor="ai-text">
              イベントの内容と候補日程を自然文で
            </label>
            <textarea
              id="ai-text"
              className="sp-textarea sp-textarea--plain"
              placeholder={AI_PLACEHOLDER}
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
            />
            <p className="sp-help">
              「来週の◯曜」「平日」「週末」「7/24」「19時から21時」などの表現が使えます。
              「夜」は 19:00〜21:00、「昼」は 12:00〜13:00 と解釈されます。
              解析結果は作成前にプレビューで編集できます。
            </p>
          </div>
          <button
            type="button"
            className="sp-button sp-button--outlined"
            onClick={handleAiParse}
            disabled={busy || aiText.trim().length === 0}
          >
            {busy && !preview ? '解析中…' : '候補日時を組み立てる'}
          </button>

          {preview && (
            <div>
              <div className="sp-note">
                エージェントが候補を組み立てました(エンジン: {preview.engine === 'claude' ? 'Claude' : 'ルールベース'})。
                内容は JSON として直接編集できます。
              </div>
              <div className="sp-field">
                <label className="sp-label" htmlFor="preview-json">
                  入稿内容(編集可)
                </label>
                <textarea
                  id="preview-json"
                  className="sp-textarea"
                  value={JSON.stringify(preview.event, null, 2)}
                  onChange={(e) => {
                    try {
                      setPreview({ ...preview, event: JSON.parse(e.target.value) });
                      setError('');
                    } catch {
                      setError('編集中の JSON が不正です(修正されるまで作成できません)');
                    }
                  }}
                  rows={12}
                />
              </div>
              <button
                type="button"
                className="sp-button sp-button--contained"
                onClick={() => void createEvent(preview.event)}
                disabled={busy}
              >
                この内容でイベントを作成
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'json' && (
        <div>
          <div className="sp-field">
            <label className="sp-label" htmlFor="json-text">
              入稿 JSON(<code className="sp-code">title</code> と{' '}
              <code className="sp-code">candidates</code> が必須)
            </label>
            <textarea
              id="json-text"
              className="sp-textarea"
              placeholder={JSON_PLACEHOLDER}
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              rows={14}
            />
          </div>
          <details className="sp-details">
            <summary>入稿 JSON の書き方(クリックで開く)</summary>
            <div className="sp-details-body">
              <p>
                <code className="sp-code">title</code>(イベント名)と{' '}
                <code className="sp-code">candidates</code>(候補日時、最大 100 件)が必須です。
                <code className="sp-code">description</code>(補足説明)は任意です。
              </p>
              <p>candidates の各要素は、次の 2 形式を混在して指定できます。</p>
              <ul>
                <li>
                  オブジェクト形式:{' '}
                  <code className="sp-code">
                    {'{ "date": "2026-07-21", "start": "19:00", "end": "21:00" }'}
                  </code>
                  (<code className="sp-code">start</code> / <code className="sp-code">end</code>{' '}
                  は省略可。<code className="sp-code">label</code> で表示名も指定可)
                </li>
                <li>
                  文字列形式: <code className="sp-code">&quot;2026-07-25&quot;</code> /{' '}
                  <code className="sp-code">&quot;2026-07-25 19:00&quot;</code> /{' '}
                  <code className="sp-code">&quot;2026-07-25 19:00-21:00&quot;</code>
                </li>
              </ul>
              <p>
                日付は <code className="sp-code">YYYY-MM-DD</code>、時刻は{' '}
                <code className="sp-code">HH:mm</code>(24 時間表記)で指定してください。
                形式に誤りがある場合は、どのフィールドが問題かをエラーで表示します。
              </p>
            </div>
          </details>
          <button
            type="button"
            className="sp-button sp-button--contained"
            onClick={handleJsonSubmit}
            disabled={busy || jsonText.trim().length === 0}
          >
            イベントを作成
          </button>
        </div>
      )}

      {error && (
        <p className="sp-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
