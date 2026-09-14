/** モデルの選択肢 1 件 */
export interface ModelOption {
  /** claude コマンドの --model に渡す値（空なら --model 自体を渡さない） */
  readonly value: string;
  readonly label: string;
}

/** モデル未指定のときに画面へ出す表記 */
export const DEFAULT_MODEL_LABEL = 'Claude Code のデフォルト';

/**
 * プルダウンに出すモデルの候補。
 *
 * 空文字は「指定しない」を表し、--model を渡さず Claude Code のデフォルトに任せる。
 * エイリアス（'opus' など）は常に最新世代を指すため、固定するならこちらを使う。
 * 特定バージョンに固定したいときのために、フル名の自由入力も残してある。
 */
export const MODEL_OPTIONS: readonly ModelOption[] = [
  { value: '', label: `${DEFAULT_MODEL_LABEL}に任せる` },
  { value: 'opus', label: 'opus（最も高性能）' },
  { value: 'sonnet', label: 'sonnet（バランス型）' },
  { value: 'haiku', label: 'haiku（軽量・高速）' },
  { value: 'fable', label: 'fable' },
];

/** 候補に無いモデル名か（フル名を直接指定しているか） */
export const isCustomModel = (model: string): boolean =>
  !MODEL_OPTIONS.some((option) => option.value === model);

/** 画面に出すモデル名（未指定なら Claude Code のデフォルトと分かるようにする） */
export const formatModel = (model: string | undefined): string =>
  model || DEFAULT_MODEL_LABEL;
