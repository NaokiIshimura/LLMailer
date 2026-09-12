import { NextResponse, type NextRequest } from 'next/server';
import { parseAgentFields } from '@/lib/api/agentInput';
import { errorResponse, unexpectedErrorResponse } from '@/lib/api/response';
import { deleteAgent, updateAgent } from '@/lib/store/agentRepository';
import type { AgentMutationError } from '@/lib/store/agentRepository';

interface RouteContext {
  readonly params: Promise<{ readonly address: string }>;
}

/** 既定のエージェントは 403、居ないものは 404 として返す */
const mutationErrorResponse = (error: AgentMutationError): NextResponse =>
  error === 'protected'
    ? errorResponse('既定のエージェントは変更・削除できません。', 403)
    : errorResponse('エージェントが見つかりません。', 404);

export const PUT = async (
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> => {
  try {
    const { address } = await context.params;
    const payload: unknown = await request.json();
    const fields = parseAgentFields(payload);
    if (!fields) {
      return errorResponse('リクエストの形式が正しくありません。', 400);
    }

    const updated = await updateAgent(address, fields);
    if (!updated.ok) {
      return mutationErrorResponse(updated.error);
    }

    return NextResponse.json({ agent: updated.value });
  } catch (error) {
    return unexpectedErrorResponse('PUT /api/agents/[address]', error);
  }
};

export const DELETE = async (
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> => {
  try {
    const { address } = await context.params;
    const deleted = await deleteAgent(address);
    if (!deleted.ok) {
      return mutationErrorResponse(deleted.error);
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return unexpectedErrorResponse('DELETE /api/agents/[address]', error);
  }
};
