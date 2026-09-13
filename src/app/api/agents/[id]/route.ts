import { NextResponse, type NextRequest } from 'next/server';
import { parseAgentFields } from '@/lib/api/agentInput';
import { errorResponse, unexpectedErrorResponse } from '@/lib/api/response';
import { deleteAgent, updateAgent } from '@/lib/store/agentRepository';
import type { AgentMutationError } from '@/lib/store/agentRepository';

interface RouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

/** デフォルトのエージェントは 403、名前の重複は 409、居ないものは 404 として返す */
const mutationErrorResponse = (error: AgentMutationError): NextResponse => {
  switch (error) {
    case 'protected':
      return errorResponse('デフォルトのエージェントは変更・削除できません。', 403);
    case 'duplicateName':
      return errorResponse('同じ名前のエージェントが既にあります。', 409);
    case 'notFound':
      return errorResponse('エージェントが見つかりません。', 404);
  }
};

export const PUT = async (
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> => {
  try {
    const { id } = await context.params;
    const payload: unknown = await request.json();
    const fields = parseAgentFields(payload);
    if (!fields) {
      return errorResponse('リクエストの形式が正しくありません。', 400);
    }

    const updated = await updateAgent(id, fields);
    if (!updated.ok) {
      return mutationErrorResponse(updated.error);
    }

    return NextResponse.json({ agent: updated.value });
  } catch (error) {
    return unexpectedErrorResponse('PUT /api/agents/[id]', error);
  }
};

export const DELETE = async (
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> => {
  try {
    const { id } = await context.params;
    const deleted = await deleteAgent(id);
    if (!deleted.ok) {
      return mutationErrorResponse(deleted.error);
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return unexpectedErrorResponse('DELETE /api/agents/[id]', error);
  }
};
