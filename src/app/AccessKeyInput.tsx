'use client';

import { useState } from 'react';

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}

/** 合言葉入力(鍵アイコン + 表示/非表示トグル付き) */
export default function AccessKeyInput({ id, value, onChange, placeholder, ariaLabel }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="sp-key-field">
      <svg
        className="sp-key-icon"
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
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <input
        id={id}
        className="sp-input sp-key-input"
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
      <button
        type="button"
        className="sp-textbtn"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? '合言葉を隠す' : '合言葉を表示'}
      >
        {visible ? '隠す' : '表示'}
      </button>
    </div>
  );
}
