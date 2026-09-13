import { randomUUID } from 'node:crypto';
import { after, NextResponse, type NextRequest } from 'next/server';
import { errorResponse, unexpectedErrorResponse } from '@/lib/api/response';
import { listAgents } from '@/lib/store/agentRepository';
import { isSafeThreadId } from '@/lib/store/threadFiles';
import {
  DELIVERY_PROCESS_ID,
  deleteMessage,
  listThreadMessages,
  saveMessage,
  saveMessages,
} from '@/lib/store/messageRepository';
import { claudeCodeTransport } from '@/lib/transport/claudeCodeTransport';
import { DeliveryError } from '@/lib/transport/types';
import {
  isOutgoingMessage,
  NO_SUBJECT,
  type Agent,
  type Message,
  type SendMessageRequest,
} from '@/types/mail';

/**
 * Claude Code はツールを使って作業するため、応答まで長くかかることがある。
 * 配信は after() で応答後に行うので、その実行時間の上限にもなる。
 */
export const maxDuration = 600;

const isSendMessageRequest = (value: unknown): value is SendMessageRequest => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const body = value as Record<string, unknown>;
  return (
    Array.isArray(body.agentIds) &&
    body.agentIds.every((id) => typeof id === 'string') &&
    typeof body.body === 'string'
  );
};

/**
 * 応答待ちのプレースホルダを作る。
 *
 * 配信を始める前に保存しておくことで、ブラウザのメモリに頼らず
 * 「対応中…」を表示できる（リロードしても消えない）。
 */
const createPendingMessage = (agent: Agent, sent: Message): Message => ({
  id: randomUUID(),
  threadId: sent.threadId,
  agentIds: [agent.id],
  subject: sent.subject,
  body: '',
  status: 'pending',
  createdAt: new Date().toISOString(),
  inReplyTo: sent.id,
  // まだ読むものが無いため、未読としては数えない
  read: true,
  deliveryProcessId: DELIVERY_PROCESS_ID,
});

/**
 * 1 件の宛先へ配信し、受信または配信失敗のメッセージを作る。
 *
 * そのエージェントが前回応答したときのセッションを --resume で継続し、
 * 前回以降に増えたメッセージ（自分の発言と他エージェントの回答）だけを渡す。
 */
const deliverTo = async (
  agent: Agent,
  sent: Message,
  pending: Message,
  history: readonly Message[],
  agentNames: ReadonlyMap<string, string>
): Promise<Message> => {
  const isFromThisAgent = (message: Message): boolean =>
    !isOutgoingMessage(message) && message.agentIds[0] === agent.id;

  const lastReply = [...history]
    .reverse()
    .find((message) => message.status === 'received' && isFromThisAgent(message));

  const newMessages = history.filter(
    (message) =>
      (message.status === 'sent' || message.status === 'received') &&
      !isFromThisAgent(message) &&
      (!lastReply || message.createdAt > lastReply.createdAt)
  );

  const base = {
    // プレースホルダと同じ ID で保存し、「対応中」の 1 通を結果へ差し替える
    id: pending.id,
    threadId: sent.threadId,
    agentIds: [agent.id],
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
        : '原因不明のエラーで失敗しました。';
    console.error('[llmailer] deliver failed', agent.id, error);

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
    if (payload.agentIds.length === 0) {
      return errorResponse('宛先を 1 件以上指定してください。', 400);
    }
    // スレッド ID はそのまま保存先のファイル名になるため、扱えない値は受け付けない
    if (payload.threadId && !isSafeThreadId(payload.threadId)) {
      return errorResponse('スレッドの指定が正しくありません。', 400);
    }

    const agents = await listAgents();
    const recipients = payload.agentIds.map((id) =>
      agents.find((agent) => agent.id === id)
    );
    if (recipients.some((agent) => agent === undefined)) {
      return errorResponse('宛先のエージェントが見つかりません。', 400);
    }
    const knownRecipients = recipients as readonly Agent[];
    const agentNames = new Map(agents.map((agent) => [agent.id, agent.name]));

    const threadId = payload.threadId ?? randomUUID();
    const previous = payload.threadId
      ? await listThreadMessages(payload.threadId)
      : [];
    const subject =
      previous[0]?.subject ?? (payload.subject.trim() || NO_SUBJECT);

    const sent: Message = {
      id: randomUUID(),
      threadId,
      agentIds: payload.agentIds,
      subject,
      body,
      status: 'sent',
      createdAt: new Date().toISOString(),
      inReplyTo: payload.inReplyTo,
      read: true,
    };

    // 送信と「対応中」を先に保存してから配信する。
    // こうすると、配信の途中でブラウザを閉じても状態が残る
    const pending = knownRecipients.map((agent) =>
      createPendingMessage(agent, sent)
    );
    await saveMessages([sent, ...pending]);

    if (payload.draftId) {
      await deleteMessage(payload.draftId);
    }

    const history = [...previous.filter((m) => m.status !== 'draft'), sent];

    // 配信の完了は待たずに応答を返す。返信は届き次第プレースホルダへ上書きする
    after(async () => {
      // 宛先ごとに並行配信し、届いた順に保存する（1 件の遅れが他を待たせない）
      await Promise.all(
        knownRecipients.map(async (agent, index) => {
          try {
            const reply = await deliverTo(
              agent,
              sent,
              pending[index],
              history,
              agentNames
            );
            await saveMessage(reply);
          } catch (error) {
            console.error('[llmailer] 配信結果の保存に失敗しました', agent.id, error);
          }
        })
      );
    });

    return NextResponse.json({ sent, pending });
  } catch (error) {
    return unexpectedErrorResponse('POST /api/messages', error);
  }
};
