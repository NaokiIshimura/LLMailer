/** `claude -p --output-format json` の usage 部分（必要なものだけ） */
export interface ClaudeCodeUsage {
  readonly input_tokens?: number;
  readonly output_tokens?: number;
  readonly cache_read_input_tokens?: number;
  readonly cache_creation_input_tokens?: number;
}

/** 権限により拒否されたツールの記録 */
export interface PermissionDenial {
  readonly tool_name?: string;
}

/** `claude -p --output-format json` の出力 */
export interface ClaudeCodeResult {
  readonly type?: string;
  readonly subtype?: string;
  readonly is_error?: boolean;
  readonly result?: string;
  readonly session_id?: string;
  readonly num_turns?: number;
  readonly duration_ms?: number;
  readonly total_cost_usd?: number;
  readonly stop_reason?: string;
  readonly permission_denials?: readonly PermissionDenial[];
  readonly usage?: ClaudeCodeUsage;
}

export const isClaudeCodeResult = (
  value: unknown
): value is ClaudeCodeResult =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
