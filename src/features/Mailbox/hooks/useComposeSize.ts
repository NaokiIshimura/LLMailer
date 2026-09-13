'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  clampComposeSize,
  DEFAULT_COMPOSE_SIZE,
  readStoredComposeSize,
  storeComposeSize,
  type ComposeSize,
} from '@/lib/composeSize';

/** 掴んだ場所から、どの向きに広げるか */
export type ResizeAxis = 'both' | 'x' | 'y';

export interface UseComposeSizeResult {
  /** 最大化していないときのウィンドウの大きさ */
  readonly size: ComposeSize;
  readonly maximized: boolean;
  /** つまみをドラッグ中か（本文などの選択を抑えるために使う） */
  readonly resizing: boolean;
  readonly toggleMaximized: () => void;
  /** つまみの pointerdown に渡すハンドラを作る */
  readonly startResize: (
    axis: ResizeAxis
  ) => (event: ReactPointerEvent<HTMLElement>) => void;
}

const viewportSize = (): ComposeSize => ({
  width: window.innerWidth,
  height: window.innerHeight,
});

/** 保存先（localStorage）と画面幅の変化を React へ伝えるための控え */
const listeners = new Set<() => void>();

/**
 * 今の大きさ。
 *
 * ドラッグ中は毎フレーム変わるため localStorage ではなくここを正とし、
 * 指を離したときだけ保存する。
 */
let currentSize: ComposeSize | null = null;

const notify = (): void => {
  listeners.forEach((listener) => listener());
};

/** 同じ参照を返し続けられるよう、値が変わったときだけ差し替える */
const setCurrentSize = (next: ComposeSize): void => {
  const size = currentSize;
  if (size && size.width === next.width && size.height === next.height) {
    return;
  }
  currentSize = next;
  notify();
};

const currentOrStoredSize = (): ComposeSize => {
  currentSize ??= clampComposeSize(readStoredComposeSize(), viewportSize());
  return currentSize;
};

/** 画面が狭くなったときに、はみ出したままにならないよう収め直す */
const handleViewportResize = (): void => {
  setCurrentSize(clampComposeSize(currentOrStoredSize(), viewportSize()));
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  window.addEventListener('resize', handleViewportResize);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener('resize', handleViewportResize);
    }
  };
};

/** サーバーには保存した大きさが無いため、初回描画は既定のまま */
const serverSize = (): ComposeSize => DEFAULT_COMPOSE_SIZE;

/**
 * 作成・返信ウィンドウの大きさを扱う。
 *
 * ウィンドウは右下に固定されているため、つまみは左上に置き、
 * 左・上へドラッグした分だけ広がるようにしている。
 * 選んだ大きさは、テーマや通知音と同じく localStorage に残して次の読み込みへ引き継ぐ。
 */
export const useComposeSize = (): UseComposeSizeResult => {
  const size = useSyncExternalStore(subscribe, currentOrStoredSize, serverSize);
  const [maximized, setMaximized] = useState(false);
  const [resizing, setResizing] = useState(false);

  const toggleMaximized = useCallback(() => {
    setMaximized((current) => !current);
  }, []);

  const startResize = useCallback(
    (axis: ResizeAxis) => (event: ReactPointerEvent<HTMLElement>) => {
      // ドラッグの始まりで本文などが選択されてしまうのを防ぐ
      event.preventDefault();
      const origin = { x: event.clientX, y: event.clientY };
      const base = currentOrStoredSize();
      setMaximized(false);
      setResizing(true);

      const handleMove = (moveEvent: PointerEvent) => {
        setCurrentSize(
          clampComposeSize(
            {
              width:
                axis === 'y'
                  ? base.width
                  : base.width + (origin.x - moveEvent.clientX),
              height:
                axis === 'x'
                  ? base.height
                  : base.height + (origin.y - moveEvent.clientY),
            },
            viewportSize()
          )
        );
      };

      const handleUp = () => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
        window.removeEventListener('pointercancel', handleUp);
        setResizing(false);
        storeComposeSize(currentOrStoredSize());
      };

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
      window.addEventListener('pointercancel', handleUp);
    },
    []
  );

  return { size, maximized, resizing, toggleMaximized, startResize };
};
