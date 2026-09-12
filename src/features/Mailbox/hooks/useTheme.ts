'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  applyTheme,
  DARK_MEDIA_QUERY,
  DEFAULT_THEME,
  readStoredTheme,
  resolveTheme,
  storeTheme,
  type ThemePreference,
} from '@/lib/theme';

export interface UseThemeResult {
  /** 設定で選ばれているテーマ */
  readonly theme: ThemePreference;
  readonly selectTheme: (theme: ThemePreference) => void;
}

/** 保存先（localStorage）の変化を React へ伝えるための控え */
const listeners = new Set<() => void>();

/** localStorage に保存できない環境でも、このセッションのあいだは選択を保てるようにする */
let unsavedTheme: ThemePreference | null = null;

const currentTheme = (): ThemePreference => unsavedTheme ?? readStoredTheme();

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

/** サーバーには設定が無いため、初回描画は既定のまま（描画前スクリプトが配色を当てる） */
const serverTheme = (): ThemePreference => DEFAULT_THEME;

/**
 * 画面の配色を持つ。
 *
 * 選んだテーマは localStorage に残し、次の読み込みでは
 * 最初の描画より前に当たる（layout の THEME_INIT_SCRIPT）。
 */
export const useTheme = (): UseThemeResult => {
  const theme = useSyncExternalStore(subscribe, currentTheme, serverTheme);

  // 'system' のあいだは OS の設定の切り替わりにも追従する
  useEffect(() => {
    applyTheme(resolveTheme(theme));

    if (theme !== 'system') {
      return;
    }

    const media = window.matchMedia(DARK_MEDIA_QUERY);
    const sync = () => {
      applyTheme(resolveTheme('system'));
    };

    media.addEventListener('change', sync);
    return () => {
      media.removeEventListener('change', sync);
    };
  }, [theme]);

  const selectTheme = useCallback((next: ThemePreference) => {
    unsavedTheme = storeTheme(next) ? null : next;
    notify();
  }, []);

  return { theme, selectTheme };
};
