/** Apple のキーボード（⌘ を持つ）かどうかを見分けるための目印 */
const APPLE_PLATFORM = /Mac|iPhone|iPad|iPod/;

/**
 * 送信ショートカットの表記を、使っているキーボードに合わせて返す。
 *
 * 送信自体は ⌘・Ctrl のどちらでも受けるが、表記まで並べると読みにくいため
 * 手元で押すほうだけを見せる。判定できない場合（サーバー側）は Ctrl 表記にする。
 */
export const readSendShortcutLabel = (): string =>
  typeof navigator !== 'undefined' && APPLE_PLATFORM.test(navigator.userAgent)
    ? '⌘ + Enter'
    : 'Ctrl + Enter';
