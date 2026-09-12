import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse, unexpectedErrorResponse } from '@/lib/api/response';
import {
  failStalePendingMessages,
  listThreadMessages,
  markThreadAsRead,
} from '@/lib/store/messageRepository';
import { buildThread } from '@/lib/thread';

interface RouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

export const GET = async (
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> => {
  try {
    const { id } = await context.params;
    // 前のプロセスが残した対応中は返信が届かないため、読み出す前に失敗へ倒す
    await failStalePendingMessages();
    const messages = (await listThreadMessages(id)).filter(
      (message) => message.status !== 'draft'
    );

    if (messages.length === 0) {
      return errorResponse('スレッドが見つかりません。', 404);
    }

    return NextResponse.json({ thread: buildThread(id, messages), messages });
  } catch (error) {
    return unexpectedErrorResponse('GET /api/threads/[id]', error);
  }
};

/** スレッドを既読にする */
export const PATCH = async (
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> => {
  try {
    const { id } = await context.params;
    const updated = await markThreadAsRead(id);
    const messages = (await listThreadMessages(id)).filter(
      (message) => message.status !== 'draft'
    );

    if (messages.length === 0) {
      return errorResponse('スレッドが見つかりません。', 404);
    }

    return NextResponse.json({
      thread: buildThread(id, messages),
      updatedCount: updated,
    });
  } catch (error) {
    return unexpectedErrorResponse('PATCH /api/threads/[id]', error);
  }
};
