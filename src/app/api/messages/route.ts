import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse, unexpectedErrorResponse } from '@/lib/api/response';
import { listAgents } from '@/lib/store/agentRepository';
import {
  deleteMessage,
  listThreadMessages,
  saveMessage,
  saveMessages,
} from '@/lib/store/messageRepository';
import { claudeCodeTransport } from '@/lib/transport/claudeCodeTransport';
import { DeliveryError } from '@/lib/transport/types';
import {
  ME_ADDRESS,
  NO_SUBJECT,
  type Agent,
  type Message,
  type SendMessageRequest,
} from '@/types/mail';

/** Claude Code はツールを使って作業するため、応答まで長くかかることがある */
export const maxDuration = 600;

const isSendMessageRequest = (value: unknown): value is SendMessageRequest => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const body = value as Record<string, unknown>;
  return (
    Array.isArray(body.to) &&
    body.to.every((to) => typeof to === 'string') &&
    typeof body.body === 'string'
  );
};

/**
 * 1 件の宛先へ配信し、受信または配信失敗のメッセージを作る。
 *
 * そのエージェントが前回応答したときのセッションを --resume で継続し、
 * 前回以降に増えたメッセージ（自分の発言と他エージェントの回答）だけを渡す。
 */
const deliverTo = async (
  agent: Agent,
  sent: Message,
  history: readonly Message[],
  agentNames: ReadonlyMap<string, string>
): Promise<Message> => {
  const lastReply = [...history]
    .reverse()
    .find(
      (message) =>
        message.from === agent.address && message.status === 'received'
    );

  const newMessages = history.filter(
    (message) =>
      (message.status === 'sent' || message.status === 'received') &&
      message.from !== agent.address &&
      (!lastReply || message.createdAt > lastReply.createdAt)
  );

  const base = {
    id: randomUUID(),
    threadId: sent.threadId,
    from: agent.address,
    to: [ME_ADDRESS],
    subject: sent.subject,
    inReplyTo: sent.id,
    read: false,
  } as const;

  try {
    const result = await claudeCodeTransport.deliver({
      agent,
      subject: sent.subject,
      newMessages,
      isFirstTurn: lastReply === undefined,
      resumeSessionId: lastReply?.sessionId,
      agentNames,
    });

    return {
      ...base,
      body: result.body,
      status: 'received',
      createdAt: new Date().toISOString(),
      usage: result.usage,
      sessionId: result.sessionId,
      run: result.run,
    };
  } catch (error) {
    const message =
      error instanceof DeliveryError
        ? error.message
        : '原因不明のエラーで配信に失敗しました。';
    console.error('[llmailer] deliver failed', agent.address, error);

    return {
      ...base,
      body: '',
      status: 'failed',
      createdAt: new Date().toISOString(),
      error: message,
    };
  }
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const payload: unknown = await request.json();
    if (!isSendMessageRequest(payload)) {
      return errorResponse('リクエストの形式が正しくありません。', 400);
    }

    const body = payload.body.trim();
    if (!body) {
      return errorResponse('本文を入力してください。', 400);
    }
    if (payload.to.length === 0) {
      return errorResponse('宛先を 1 件以上指定してください。', 400);
    }

    const agents = await listAgents();
    const recipients = payload.to.map((address) =>
      agents.find((agent) => agent.address === address)
    );
    const unknownIndex = recipients.findIndex((agent) => agent === undefined);
    if (unknownIndex >= 0) {
      return errorResponse(
        `宛先が見つかりません: ${payload.to[unknownIndex]}`,
        400
      );
    }
    const knownRecipients = recipients as readonly Agent[];
    const agentNames = new Map(agents.map((agent) => [agent.address, agent.name]));

    const threadId = payload.threadId ?? randomUUID();
    const previous = payload.threadId
      ? await listThreadMessages(payload.threadId)
      : [];
    const subject =
      previous[0]?.subject ?? (payload.subject.trim() || NO_SUBJECT);

    const sent: Message = {
      id: randomUUID(),
      threadId,
      from: ME_ADDRESS,
      to: payload.to,
      subject,
      body,
      status: 'sent',
      createdAt: new Date().toISOString(),
      inReplyTo: payload.inReplyTo,
      read: true,
    };
    await saveMessage(sent);

    if (payload.draftId) {
      await deleteMessage(payload.draftId);
    }

    const history = [...previous.filter((m) => m.status !== 'draft'), sent];

    // 宛先ごとに並行配信する。1 件の失敗が他の宛先に影響しないようにする
    const replies = await Promise.all(
      knownRecipients.map((agent) =>
        deliverTo(agent, sent, history, agentNames)
      )
    );
    await saveMessages(replies);

    return NextResponse.json({ sent, replies });
  } catch (error) {
    return unexpectedErrorResponse('POST /api/messages', error);
  }
};
