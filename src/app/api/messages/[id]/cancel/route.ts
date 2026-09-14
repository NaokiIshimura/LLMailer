import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse, unexpectedErrorResponse } from '@/lib/api/response';
import { abortDelivery } from '@/lib/delivery/registry';
import { cancelPendingMessage } from '@/lib/store/messageRepository';

interface RouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

/**
 * 対応中の配信を中断する。
 *
 * 起動している claude を止めてから状態を倒す。
 * 中断された配信の結果は保存されないため、この 1 通は「中断」のまま残る。
 */
export const POST = async (
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> => {
  try {
    const { id } = await context.params;
    abortDelivery(id);

    if (!(await cancelPendingMessage(id))) {
      return errorResponse('中断できる対応中のメッセージが見つかりません。', 404);
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return unexpectedErrorResponse('POST /api/messages/[id]/cancel', error);
  }
};
