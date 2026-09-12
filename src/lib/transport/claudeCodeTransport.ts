import { randomUUID } from 'node:crypto';
import { buildPrompt, buildRolePrompt } from '@/lib/claudeCode/prompt';
import { ClaudeCodeError, runClaudeCode } from '@/lib/claudeCode/runClaudeCode';
import type { ClaudeCodeResult } from '@/lib/claudeCode/types';
import type { MessageUsage, RunInfo } from '@/types/mail';
import {
  DeliveryError,
  type DeliverInput,
  type DeliverResult,
  type Transport,
} from './types';

const toUsage = (result: ClaudeCodeResult): MessageUsage | undefined => {
  const usage = result.usage;
  if (!usage) {
    return undefined;
  }
  return {
    inputTokens:
      (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0),
    outputTokens: usage.output_tokens ?? 0,
  };
};

const toRunInfo = (result: ClaudeCodeResult): RunInfo => {
  const deniedTools = (result.permission_denials ?? [])
    .map((denial) => denial.tool_name)
    .filter((name): name is string => Boolean(name));

  return {
    costUsd: result.total_cost_usd,
    durationMs: result.duration_ms,
    numTurns: result.num_turns,
    deniedTools: deniedTools.length > 0 ? [...new Set(deniedTools)] : undefined,
  };
};

/** ローカルの Claude Code へメッセージを配信する Transport 実装 */
export const claudeCodeTransport: Transport = {
  async deliver(input: DeliverInput): Promise<DeliverResult> {
    const { agent, subject, newMessages, isFirstTurn, resumeSessionId, agentNames } =
      input;

    const prompt = buildPrompt({
      newMessages,
      subject,
      isFirstTurn,
      agentNames,
    }).trim();

    if (!prompt) {
      throw new DeliveryError('配信できる本文がありません。');
    }

    const newSessionId = randomUUID();

    try {
      const result = await runClaudeCode({
        agent,
        prompt,
        rolePrompt: buildRolePrompt(agent, subject),
        resumeSessionId,
        newSessionId,
      });

      const body = (result.result ?? '').trim();
      if (!body) {
        throw new DeliveryError('応答が空でした。');
      }

      return {
        body,
        usage: toUsage(result),
        sessionId: result.session_id ?? resumeSessionId ?? newSessionId,
        run: toRunInfo(result),
      };
    } catch (error) {
      if (error instanceof DeliveryError) {
        throw error;
      }
      if (error instanceof ClaudeCodeError) {
        throw new DeliveryError(error.message, { cause: error });
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new DeliveryError(message, { cause: error });
    }
  },
};
