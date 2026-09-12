import type { Agent, Message, MessageUsage, RunInfo } from '@/types/mail';

export interface DeliverInput {
  /** 配信先のエージェント */
  readonly agent: Agent;
  /** スレッドの件名 */
  readonly subject: string;
  /**
   * 前回このエージェントが応答して以降に増えたメッセージ（時刻順）。
   * それ以前の履歴は配信先のセッションが保持している。
   */
  readonly newMessages: readonly Message[];
  /** このエージェントにとってスレッド初回か */
  readonly isFirstTurn: boolean;
  /** 継続するセッション ID（初回は undefined） */
  readonly resumeSessionId?: string;
  /** 同席している他エージェントの表示名（アドレス → 名前） */
  readonly agentNames: ReadonlyMap<string, string>;
}

export interface DeliverResult {
  readonly body: string;
  readonly usage?: MessageUsage;
  /** 次回の継続に使うセッション ID */
  readonly sessionId?: string;
  readonly run?: RunInfo;
}

/**
 * 「宛先へメッセージを配信し、返信を得る」抽象。
 * 既定実装はローカルの Claude Code だが、同じ形で実メール（SMTP/IMAP）へ差し替えられる。
 */
export interface Transport {
  deliver(input: DeliverInput): Promise<DeliverResult>;
}

/** 配信に失敗したことを表すエラー（利用者向けの日本語メッセージを持つ） */
export class DeliveryError extends Error {
  constructor(message: string, options?: { readonly cause?: unknown }) {
    super(message, options);
    this.name = 'DeliveryError';
  }
}
