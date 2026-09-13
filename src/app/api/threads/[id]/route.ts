import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse, unexpectedErrorResponse } from '@/lib/api/response';
import { parseThreadUpdate } from '@/lib/api/threadInput';
import {
  failStalePendingMessages,
  markThreadAsRead,
} from '@/lib/store/messageRepository';
import {
  readThread,
  setThreadArchived,
  setThreadSubject,
} from '@/lib/store/threadRepository';
import type { ThreadRecord } from '@/lib/store/threadRecord';
import { buildThread, collectArchivedThreadIds } from '@/lib/thread';
import {
  THREAD_SUBJECT_MAX_LENGTH,
  type Thread,
  type UpdateThreadRequest,
} from '@/types/mail';

interface RouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

/** 保存済みのアーカイブ状態を反映してスレッドを組み立てる */
const toThread = (record: ThreadRecord): Thread =>
  buildThread(record, collectArchivedThreadIds([record]).has(record.id));

/** ボディ無しの PATCH（既読化）も受け付けるため、読めなければ空として扱う */
const parseUpdate = async (
  request: NextRequest
): Promise<UpdateThreadRequest | null> => {
  try {
    return parseThreadUpdate(await request.json());
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
    const record = await readThread(id);

    if (record.messages.length === 0) {
      return errorResponse('スレッドが見つかりません。', 404);
    }

    return NextResponse.json({
      thread: toThread(record),
      messages: record.messages,
    });
  } catch (error) {
    return unexpectedErrorResponse('GET /api/threads/[id]', error);
  }
};

/**
 * スレッドを更新する。
 *
 * `{ subject }` でお題の変更、`{ archived }` でアーカイブの切り替え。
 * どちらも指定が無ければ（ボディ無しや `{ read: true }`）既読化として扱う。
 */
export const PATCH = async (
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> => {
  try {
    const { id } = await context.params;
    const update = await parseUpdate(request);
    if (!update) {
      return errorResponse(
        `スレッドの件名は 1 文字以上 ${THREAD_SUBJECT_MAX_LENGTH} 文字以内で入力してください。`,
        400
      );
    }

    // 無いスレッドの状態を書き込まないよう、先に見つかるかどうかを確かめる
    if ((await readThread(id)).messages.length === 0) {
      return errorResponse('スレッドが見つかりません。', 404);
    }

    const { subject, archived } = update;
    if (subject !== undefined) {
      await setThreadSubject(id, subject);
    }
    if (archived !== undefined) {
      await setThreadArchived(id, archived);
    }
    // 件名やアーカイブの操作は読んだことにならないので、指定が無いときだけ既読にする
    const updatedCount =
      subject === undefined && archived === undefined
        ? await markThreadAsRead(id)
        : 0;

    return NextResponse.json({
      thread: toThread(await readThread(id)),
      updatedCount,
    });
  } catch (error) {
    return unexpectedErrorResponse('PATCH /api/threads/[id]', error);
  }
};
