'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/**
 * 利用者が触ったとみなすイベント。
 *
 * scroll は入れない。返信が増えて本文の高さが変わったときにもブラウザが出すため、
 * 触っていないのに既読になってしまう。
 * 代わりに、スクロールのきっかけになる操作（ホイール・スクロールバーのつまみ・
 * キー・指の動き）を拾えば、実際に読もうとしたときだけ既読にできる。
 */
const INTERACTION_EVENTS = [
  'pointerdown',
  'keydown',
  'wheel',
  'touchmove',
] as const;

export interface UseMarkReadOnInteractionResult {
  /** 操作を見張る範囲。スレッド本文の外枠に付ける */
  readonly interactionRef: RefObject<HTMLElement | null>;
  /** 操作を待たずに既読にする（知らせの中のボタン用） */
  readonly markRead: () => void;
}

/**
 * 知らせが出ているあいだ、範囲内の操作を既読の合図として受け取る。
 *
 * 届いた返信に気づいて読み始めたのなら、わざわざボタンを押させる必要はない。
 * 知らせが出ていないあいだ（active が false）は何もしない。
 *
 * 1 回の知らせにつき既読にするのは 1 度だけ。続けて操作しても送り直さない。
 */
export const useMarkReadOnInteraction = (
  active: boolean,
  onMarkRead: () => void
): UseMarkReadOnInteractionResult => {
  const interactionRef = useRef<HTMLElement>(null);

  // onMarkRead の参照が変わるたびに見張り直さないよう、ref 経由で呼ぶ
  const onMarkReadRef = useRef(onMarkRead);
  useEffect(() => {
    onMarkReadRef.current = onMarkRead;
  }, [onMarkRead]);

  /** この知らせぶんの既読化を済ませたか */
  const markedRef = useRef(false);
  useEffect(() => {
    if (!active) {
      markedRef.current = false;
    }
  }, [active]);

  const markRead = useCallback((): void => {
    if (markedRef.current) {
      return;
    }
    markedRef.current = true;
    onMarkReadRef.current();
  }, []);

  useEffect(() => {
    const element = interactionRef.current;
    if (!active || element === null) {
      return;
    }

    const handleInteraction = (): void => {
      markRead();
    };

    for (const type of INTERACTION_EVENTS) {
      element.addEventListener(type, handleInteraction);
    }

    return () => {
      for (const type of INTERACTION_EVENTS) {
        element.removeEventListener(type, handleInteraction);
      }
    };
  }, [active, markRead]);

  return { interactionRef, markRead };
};
