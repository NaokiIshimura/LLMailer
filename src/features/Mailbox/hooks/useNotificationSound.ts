'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  DEFAULT_NOTIFICATION_SOUND_ENABLED,
  playNotificationSound,
  readStoredNotificationSound,
  storeNotificationSound,
} from '@/lib/notificationSound';

export interface UseNotificationSoundResult {
  /** 返信が届いたときに通知音を鳴らすか */
  readonly enabled: boolean;
  readonly setEnabled: (enabled: boolean) => void;
  /** 設定が有効なときだけ鳴らす */
  readonly play: () => void;
  /** 設定に関わらず鳴らす（設定画面の試聴に使う） */
  readonly preview: () => void;
}

/** 保存先（localStorage）の変化を React へ伝えるための控え */
const listeners = new Set<() => void>();

/** localStorage に保存できない環境でも、このセッションのあいだは選択を保てるようにする */
let unsavedEnabled: boolean | null = null;

const currentEnabled = (): boolean =>
  unsavedEnabled ?? readStoredNotificationSound();

const notify = (): void => {
  listeners.forEach((listener) => listener());
};

/** 同じタブでの変更は notify、別タブでの変更は storage イベントで受け取る */
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
};

/** サーバーには設定が無いため、初回描画は既定のまま */
const serverEnabled = (): boolean => DEFAULT_NOTIFICATION_SOUND_ENABLED;

/**
 * 返信が届いたときの通知音の設定を持つ。
 *
 * テーマと同じく、選んだ設定は localStorage に残して次の読み込みへ引き継ぐ。
 */
export const useNotificationSound = (): UseNotificationSoundResult => {
  const enabled = useSyncExternalStore(
    subscribe,
    currentEnabled,
    serverEnabled
  );

  const setEnabled = useCallback((next: boolean) => {
    unsavedEnabled = storeNotificationSound(next) ? null : next;
    notify();
  }, []);

  // enabled を依存に入れると参照が変わるため、鳴らす直前に設定を読む
  const play = useCallback(() => {
    if (!currentEnabled()) {
      return;
    }
    playNotificationSound();
  }, []);

  return {
    enabled,
    setEnabled,
    play,
    preview: playNotificationSound,
  };
};
