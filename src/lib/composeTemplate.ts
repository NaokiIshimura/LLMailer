/** テンプレートを差し込んだあとの本文とカーソル位置 */
export interface TemplateInsertion {
  readonly body: string;
  /** 差し込んだ定型文の末尾（続きをそのまま書き始められる位置） */
  readonly caret: number;
}

/**
 * 本文のカーソル位置へ定型文を差し込む（選択範囲があれば置き換える）。
 *
 * 行の途中に差し込むと定型文の見出しが前の行にくっついてしまうため、
 * 足りない改行だけをここで補う。既に改行があるところには足さない。
 */
export const insertTemplateBody = (
  body: string,
  selectionStart: number,
  selectionEnd: number,
  templateBody: string
): TemplateInsertion => {
  const before = body.slice(0, selectionStart);
  const after = body.slice(selectionEnd);

  const leading = before === '' || before.endsWith('\n') ? '' : '\n';
  const trailing =
    after === '' || after.startsWith('\n') || templateBody.endsWith('\n')
      ? ''
      : '\n';

  return {
    body: `${before}${leading}${templateBody}${trailing}${after}`,
    caret: before.length + leading.length + templateBody.length + trailing.length,
  };
};
