import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse, unexpectedErrorResponse } from '@/lib/api/response';
import { deleteMessage } from '@/lib/store/messageRepository';

interface RouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

export const DELETE = async (
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> => {
  try {
    const { id } = await context.params;
    const deleted = await deleteMessage(id);
    if (!deleted) {
      return errorResponse('メッセージが見つかりません。', 404);
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return unexpectedErrorResponse('DELETE /api/messages/[id]', error);
  }
};
