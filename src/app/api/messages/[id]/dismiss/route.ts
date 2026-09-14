import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse, unexpectedErrorResponse } from '@/lib/api/response';
import { markMessageAsDismissed } from '@/lib/store/messageRepository';

interface RouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

/**
 * 返信を得られなかった配信（失敗・中断）を、再送せずに取り消す。
 *
 * 取り消しても 1 通は消さず、取り消した日時だけを書き足す。
 * 何があったのかがスレッドに残り、失敗としての扱い（一覧のラベル・未読）だけが終わる。
 */
export const POST = async (
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> => {
  try {
    const { id } = await context.params;

    if (!(await markMessageAsDismissed(id, new Date().toISOString()))) {
      return errorResponse('取り消せるメッセージが見つかりません。', 404);
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return unexpectedErrorResponse('POST /api/messages/[id]/dismiss', error);
  }
};
