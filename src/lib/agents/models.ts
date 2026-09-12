/** モデルの選択肢 1 件 */
export interface ModelOption {
  /** claude コマンドの --model に渡す値 */
  readonly value: string;
  readonly label: string;
}

/**
 * プルダウンに出すモデルの候補。
 *
 * エイリアス（'opus' など）は常に最新世代を指すため、既定はこちらを使う。
 * 特定バージョンに固定したいときのために、フル名の自由入力も残してある。
 */
export const MODEL_OPTIONS: readonly ModelOption[] = [
  { value: 'opus', label: 'opus（最も高性能）' },
  { value: 'sonnet', label: 'sonnet（バランス型）' },
  { value: 'haiku', label: 'haiku（軽量・高速）' },
  { value: 'fable', label: 'fable' },
];

/** 候補に無いモデル名か（フル名を直接指定しているか） */
export const isCustomModel = (model: string): boolean =>
  !MODEL_OPTIONS.some((option) => option.value === model);
