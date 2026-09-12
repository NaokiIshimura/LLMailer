import { NextResponse, type NextRequest } from 'next/server';
import { parseAgentAddress, parseAgentFields } from '@/lib/api/agentInput';
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
    const address = parseAgentAddress(
      (payload as { readonly address?: unknown } | null)?.address
    );
    if (address === null) {
      return errorResponse(
        'アドレスの形式が正しくありません（例: myrepo@llmailer.local）。',
        400
      );
    }

    const fields = parseAgentFields(payload);
    if (!fields) {
      return errorResponse('リクエストの形式が正しくありません。', 400);
    }

    const created = await createAgent({ ...fields, address });
    if (!created.ok) {
      return created.error === 'protected'
        ? errorResponse('既定のエージェントと同じアドレスは使えません。', 403)
        : errorResponse('同じアドレスのエージェントが既にあります。', 409);
    }

    return NextResponse.json({ agent: created.value }, { status: 201 });
  } catch (error) {
    return unexpectedErrorResponse('POST /api/agents', error);
  }
};
