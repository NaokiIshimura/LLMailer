/** 実際に画面へ適用する配色 */
export type ResolvedTheme = 'light' | 'dark';

/**
 * 直前に適用した配色の控え。
 *
 * テーマの設定値そのものは Next.js DevTools が持っているが、
 * それはページ読み込みの後に届くため、最初の描画にはこの控えを使う。
 */
export const THEME_CACHE_KEY = 'llmailer.theme';

export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

export const systemTheme = (): ResolvedTheme =>
  window.matchMedia(DARK_MEDIA_QUERY).matches ? 'dark' : 'light';

/**
 * 配色を html 要素に持たせる。
 * アプリ全体の CSS 変数は :root[data-theme] で切り替わるため、
 * ここを書き換えるだけで画面全体に反映される。
 */
export const applyTheme = (resolved: ResolvedTheme): void => {
  document.documentElement.dataset.theme = resolved;
};

/** 次回の初回描画に備えて配色を控えておく */
export const cacheTheme = (resolved: ResolvedTheme): void => {
  try {
    window.localStorage.setItem(THEME_CACHE_KEY, resolved);
  } catch {
    // 保存できなくても、このセッションの表示は切り替わっている
  }
};

/**
 * 最初の描画より前にテーマを当てるスクリプト。
 * React のマウントを待つと、ダーク表示でも一瞬ライトで表示されてしまう。
 */
export const THEME_INIT_SCRIPT = `(function(){try{var c=localStorage.getItem('${THEME_CACHE_KEY}');var t=(c==='light'||c==='dark')?c:(window.matchMedia('${DARK_MEDIA_QUERY}').matches?'dark':'light');document.documentElement.dataset.theme=t;}catch(e){}})();`;
