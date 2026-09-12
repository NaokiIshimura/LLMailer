import { NextResponse, type NextRequest } from 'next/server';
import { parseAgentFields } from '@/lib/api/agentInput';
import { errorResponse, unexpectedErrorResponse } from '@/lib/api/response';
import { createAgent, listAgents } from '@/lib/store/agentRepository';

export const GET = async (): Promise<NextResponse> => {
  try {
    const agents = await listAgents();
    return NextResponse.json({ agents });
  } catch (error) {
    return unexpectedErrorResponse('GET /api/agents', error);
  }
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const payload: unknown = await request.json();
    const fields = parseAgentFields(payload);
    if (!fields) {
      return errorResponse('リクエストの形式が正しくありません。', 400);
    }

    // 識別子はサーバーで採番するため、リクエストからは受け取らない
    const created = await createAgent(fields);
    if (!created.ok) {
      return errorResponse('同じ名前のエージェントが既にあります。', 409);
    }

    return NextResponse.json({ agent: created.value }, { status: 201 });
  } catch (error) {
    return unexpectedErrorResponse('POST /api/agents', error);
  }
};
