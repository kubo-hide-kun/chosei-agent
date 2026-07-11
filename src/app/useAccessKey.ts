'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'chosei-access-key';

/** 合言葉(アクセスキー)をローカルに記憶して使い回すためのフック */
export function useAccessKey(): [string, (value: string) => void] {
  const [accessKey, setAccessKeyState] = useState('');

  useEffect(() => {
    try {
      setAccessKeyState(localStorage.getItem(STORAGE_KEY) ?? '');
    } catch {
      /* localStorage 無効環境では毎回入力してもらう */
    }
  }, []);

  function setAccessKey(value: string) {
    setAccessKeyState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* noop */
    }
  }

  return [accessKey, setAccessKey];
}
