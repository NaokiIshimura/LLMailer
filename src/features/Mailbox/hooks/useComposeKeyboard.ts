'use client';

import { useCallback, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import { readSendShortcutLabel } from '@/lib/composeShortcut';

export interface UseComposeKeyboardResult {
  /** 送信ボタン。本文からの Tab の移動先にする */
  readonly sendButtonRef: RefObject<HTMLButtonElement | null>;
  /** 画面に出す送信ショートカットの表記（⌘ + Enter / Ctrl + Enter） */
  readonly sendShortcut: string;
  /** 本文の keydown に渡すハンドラ */
  readonly handleBodyKeyDown: (
    event: ReactKeyboardEvent<HTMLTextAreaElement>
  ) => void;
}

/**
 * 作成ウィンドウの本文で使うキー操作。
 *
 * Tab はテンプレートの選択ボタンではなく送信ボタンへ移す（書き終えたらそのまま送れるように）。
 * 送信は ⌘+Enter・Ctrl+Enter のどちらでも受ける（OS を見分けずに済ませる）。
 */
export const useComposeKeyboard = (
  onSend: () => void,
  canSend: boolean
): UseComposeKeyboardResult => {
  const sendButtonRef = useRef<HTMLButtonElement>(null);
  // 使っているキーボードは変わらないため、最初に見分けたものを持ち続ける
  const [sendShortcut] = useState(readSendShortcutLabel);

  const handleBodyKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>): void => {
      // 変換中の Enter は確定、Tab は候補の操作なので、どちらも横取りしない
      if (event.nativeEvent.isComposing) {
        return;
      }

      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        // 送れない状態では改行などの元の動きをそのまま残す
        if (!canSend) {
          return;
        }
        event.preventDefault();
        onSend();
        return;
      }

      // Shift+Tab は件名・宛先へ戻るため、進む向きだけ送信ボタンへ寄せる
      if (event.key !== 'Tab' || event.shiftKey) {
        return;
      }

      const sendButton = sendButtonRef.current;
      // 送信できない状態のボタンはフォーカスを受け取れないため、既定の移動に任せる
      if (!sendButton || sendButton.disabled) {
        return;
      }

      event.preventDefault();
      sendButton.focus();
    },
    [canSend, onSend]
  );

  return { sendButtonRef, sendShortcut, handleBodyKeyDown };
};
