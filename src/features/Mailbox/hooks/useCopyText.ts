'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** コピーしたことを伝える表示を残す長さ */
const FEEDBACK_MS = 2000;

export interface UseCopyTextResult {
  /** 直前のコピーが成功したか（しばらくすると戻る） */
  readonly copied: boolean;
  /** コピーできなかったか（手で選べるよう、呼び出し側で文字列を出す） */
  readonly failed: boolean;
  readonly copy: (text: string) => Promise<void>;
}

/** 文字列をクリップボードへ写す（押したことが分かるよう、結果をしばらく残す） */
export const useCopyText = (): UseCopyTextResult => {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // 表示が戻る前にスレッドを閉じても、タイマーだけ残らないようにする
  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
    },
    []
  );

  const copy = useCallback(async (text: string): Promise<void> => {
    clearTimeout(timerRef.current);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setFailed(false);
      timerRef.current = setTimeout(() => setCopied(false), FEEDBACK_MS);
    } catch {
      // localhost 以外などクリップボードを触れない場合。手で選べる形へ切り替える
      setCopied(false);
      setFailed(true);
    }
  }, []);

  return { copied, failed, copy };
};
