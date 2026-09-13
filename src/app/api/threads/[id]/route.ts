import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse, unexpectedErrorResponse } from '@/lib/api/response';
import {
  failStalePendingMessages,
  listThreadMessages,
  markThreadAsRead,
} from '@/lib/store/messageRepository';
import {
  listArchivedAt,
  setThreadArchived,
} from '@/lib/store/threadStateRepository';
import { buildThread, collectArchivedThreadIds } from '@/lib/thread';
import type { Message, Thread, UpdateThreadRequest } from '@/types/mail';

interface RouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

/** スレッド本文として返すメッセージ（下書きはスレッドに含めない） */
const readThreadMessages = async (
  id: string
): Promise<readonly Message[]> =>
  (await listThreadMessages(id)).filter(
    (message) => message.status !== 'draft'
  );

/** 保存済みのアーカイブ状態を反映してスレッドを組み立てる */
const buildStoredThread = async (
  id: string,
  messages: readonly Message[]
): Promise<Thread> => {
  const archivedThreadIds = collectArchivedThreadIds(
    messages,
    await listArchivedAt()
  );
  return buildThread(id, messages, archivedThreadIds.has(id));
};

/** ボディ無しの PATCH（既読化）も受け付けるため、読めなければ空として扱う */
const parseUpdate = async (
  request: NextRequest
): Promise<UpdateThreadRequest> => {
  try {
    const body: unknown = await request.json();
    return typeof body === 'object' && body !== null
      ? (body as UpdateThreadRequest)
      : {};
  } catch {
    return {};
  }
};

export const GET = async (
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> => {
  try {
    const { id } = await context.params;
    // 前のプロセスが残した対応中は返信が届かないため、読み出す前に失敗へ倒す
    await failStalePendingMessages();
    const messages = await readThreadMessages(id);

    if (messages.length === 0) {
      return errorResponse('スレッドが見つかりません。', 404);
    }

    return NextResponse.json({
      thread: await buildStoredThread(id, messages),
      messages,
    });
  } catch (error) {
    return unexpectedErrorResponse('GET /api/threads/[id]', error);
  }
};

/**
 * スレッドの状態を更新する。
 *
 * `{ archived }` を指定するとアーカイブの切り替え、
 * それ以外（ボディ無しや `{ read: true }`）は既読化として扱う。
 */
export const PATCH = async (
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> => {
  try {
    const { id } = await context.params;
    const { archived } = await parseUpdate(request);

    // 無いスレッドの状態を書き込まないよう、先に見つかるかどうかを確かめる
    if ((await readThreadMessages(id)).length === 0) {
      return errorResponse('スレッドが見つかりません。', 404);
    }

    let updatedCount = 0;
    if (typeof archived === 'boolean') {
      await setThreadArchived(id, archived);
    } else {
      updatedCount = await markThreadAsRead(id);
    }

    const messages = await readThreadMessages(id);
    return NextResponse.json({
      thread: await buildStoredThread(id, messages),
      updatedCount,
    });
  } catch (error) {
    return unexpectedErrorResponse('PATCH /api/threads/[id]', error);
  }
};
