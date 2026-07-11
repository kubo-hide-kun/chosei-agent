'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 入力途中の下書きを localStorage に自動保存するフック。
 * リロードや誤操作で入力が消えないようにする。
 */
export function useDraft(storageKey: string): [string, (value: string) => void] {
  const [value, setValue] = useState('');
  const restored = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setValue(saved);
    } catch {
      /* localStorage 無効環境では下書き保存なしで動く */
    }
    restored.current = true;
  }, [storageKey]);

  useEffect(() => {
    if (!restored.current) return;
    try {
      if (value) localStorage.setItem(storageKey, value);
      else localStorage.removeItem(storageKey);
    } catch {
      /* noop */
    }
  }, [storageKey, value]);

  return [value, setValue];
}
