'use client';

import { useCallback, useState } from 'react';
import type { AnimationEvent } from 'react';

export interface UseExitTransitionResult {
  /** 表示を残すか（閉じたあとも、消えるアニメーションのあいだは残す） */
  readonly visible: boolean;
  /** 消えるアニメーションの最中か（クラスの出し分けに使う） */
  readonly exiting: boolean;
  /** アニメーションの終わりを受け取る。表示する要素の onAnimationEnd に渡す */
  readonly handleAnimationEnd: (event: AnimationEvent<HTMLElement>) => void;
}

/**
 * 消えるアニメーションが終わるまで表示を残す。
 *
 * 条件が偽になった時点で消してしまうと、瞬時に消えて動きを付けられない。
 * 待つ長さを決め打ちにすると CSS 側とずれるため、アニメーションの終わりを合図にする。
 */
export const useExitTransition = (open: boolean): UseExitTransitionResult => {
  const [exiting, setExiting] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);

  // 開閉が変わった描画でそのまま state を合わせる（effect で合わせると 1 描画ぶん遅れる）
  if (wasOpen !== open) {
    setWasOpen(open);
    // 開いていたものが閉じたときだけ、消えるアニメーションを始める
    setExiting(!open);
  }

  const handleAnimationEnd = useCallback(
    (event: AnimationEvent<HTMLElement>): void => {
      // 中の要素のアニメーションも上がってくるため、自分のぶんだけを見る
      if (event.target === event.currentTarget) {
        setExiting(false);
      }
    },
    []
  );

  return { visible: open || exiting, exiting, handleAnimationEnd };
};
