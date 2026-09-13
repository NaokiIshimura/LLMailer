/**
 * 作成・返信ウィンドウの大きさ。
 *
 * 長いプロンプトを書くと固定サイズでは窮屈なため、利用者が広げられるようにする。
 * 選んだ大きさはサーバーに持つ必要のないブラウザごとの好みなので localStorage に残す。
 */
export interface ComposeSize {
  /** ウィンドウの幅（px） */
  readonly width: number;
  /** ウィンドウの高さ（px） */
  readonly height: number;
}

/** 選んだ大きさの保存先 */
export const COMPOSE_SIZE_STORAGE_KEY = 'llmailer.composeSize';

/** 初めて開いたときの大きさ。指示は横に長くなりがちなので、幅はやや広めにとる */
export const DEFAULT_COMPOSE_SIZE: ComposeSize = { width: 720, height: 640 };

/** 宛先・件名・本文がそれぞれ読める下限 */
export const MIN_COMPOSE_SIZE: ComposeSize = { width: 360, height: 320 };

/** 画面の縁との隙間（px）。右下の固定位置と、広げたときに上左へ残す余白 */
export const COMPOSE_MARGIN = 24;

/** 下限と、画面に収まる上限のあいだへ丸める */
const limit = (value: number, min: number, max: number): number =>
  Math.round(Math.min(Math.max(value, min), max));

/**
 * 画面からはみ出さない大きさに収める。
 * 画面が下限より狭いときは、下限より上限を優先して画面幅いっぱいにする。
 */
export const clampComposeSize = (
  size: ComposeSize,
  viewport: ComposeSize
): ComposeSize => ({
  width: limit(
    size.width,
    MIN_COMPOSE_SIZE.width,
    Math.max(viewport.width - COMPOSE_MARGIN * 2, 0)
  ),
  height: limit(
    size.height,
    MIN_COMPOSE_SIZE.height,
    Math.max(viewport.height - COMPOSE_MARGIN * 2, 0)
  ),
});

const isValidLength = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

/** 保存された大きさを読む。未設定や壊れた値のときは既定に戻す */
export const readStoredComposeSize = (): ComposeSize => {
  try {
    const stored = window.localStorage.getItem(COMPOSE_SIZE_STORAGE_KEY);
    if (!stored) {
      return DEFAULT_COMPOSE_SIZE;
    }
    const parsed: unknown = JSON.parse(stored);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      isValidLength((parsed as ComposeSize).width) &&
      isValidLength((parsed as ComposeSize).height)
    ) {
      return {
        width: (parsed as ComposeSize).width,
        height: (parsed as ComposeSize).height,
      };
    }
    return DEFAULT_COMPOSE_SIZE;
  } catch {
    return DEFAULT_COMPOSE_SIZE;
  }
};

/** 次回も同じ大きさで開けるよう残す。保存できたかを返す */
export const storeComposeSize = (size: ComposeSize): boolean => {
  try {
    window.localStorage.setItem(COMPOSE_SIZE_STORAGE_KEY, JSON.stringify(size));
    return true;
  } catch {
    return false;
  }
};
