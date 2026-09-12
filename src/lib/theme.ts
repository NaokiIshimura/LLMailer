/** 設定で選べるテーマ。'system' は OS の設定に従う */
export type ThemePreference = 'system' | 'light' | 'dark';

/** 実際に画面へ適用する配色 */
export type ResolvedTheme = 'light' | 'dark';

export const THEME_PREFERENCES: readonly ThemePreference[] = [
  'system',
  'light',
  'dark',
];

export const THEME_LABELS: Readonly<Record<ThemePreference, string>> = {
  system: 'システム',
  light: 'ライト',
  dark: 'ダーク',
};

export const DEFAULT_THEME: ThemePreference = 'system';

/**
 * 選んだテーマの保存先。
 *
 * React のマウントより前に読み出したいので、サーバーではなく localStorage に置く。
 */
export const THEME_STORAGE_KEY = 'llmailer.theme';

export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

export const systemTheme = (): ResolvedTheme =>
  window.matchMedia(DARK_MEDIA_QUERY).matches ? 'dark' : 'light';

/** 設定値から、実際に当てる配色を決める */
export const resolveTheme = (theme: ThemePreference): ResolvedTheme =>
  theme === 'system' ? systemTheme() : theme;

/** 保存された設定値を読む。未設定や壊れた値のときは既定に戻す */
export const readStoredTheme = (): ThemePreference => {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_PREFERENCES.includes(stored as ThemePreference)
      ? (stored as ThemePreference)
      : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
};

/** 次回の初回描画にも同じテーマが出るよう、設定値を残す。保存できたかを返す */
export const storeTheme = (theme: ThemePreference): boolean => {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    return true;
  } catch {
    return false;
  }
};

/**
 * 配色を html 要素に持たせる。
 * アプリ全体の CSS 変数は :root[data-theme] で切り替わるため、
 * ここを書き換えるだけで画面全体に反映される。
 */
export const applyTheme = (resolved: ResolvedTheme): void => {
  document.documentElement.dataset.theme = resolved;
};

/**
 * 最初の描画より前にテーマを当てるスクリプト。
 * React のマウントを待つと、ダーク表示でも一瞬ライトで表示されてしまう。
 */
export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('${THEME_STORAGE_KEY}');var t=(s==='light'||s==='dark')?s:(window.matchMedia('${DARK_MEDIA_QUERY}').matches?'dark':'light');document.documentElement.dataset.theme=t;}catch(e){}})();`;
