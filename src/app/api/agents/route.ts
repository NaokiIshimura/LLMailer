import { NextResponse } from 'next/server';
import { unexpectedErrorResponse } from '@/lib/api/response';
import { listAgents } from '@/lib/store/agentRepository';

export const GET = async (): Promise<NextResponse> => {
  try {
    const agents = await listAgents();
    return NextResponse.json({ agents });
  } catch (error) {
    return unexpectedErrorResponse('GET /api/agents', error);
  }
};
