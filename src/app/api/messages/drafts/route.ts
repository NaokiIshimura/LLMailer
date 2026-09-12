import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse, unexpectedErrorResponse } from '@/lib/api/response';
import { saveMessage } from '@/lib/store/messageRepository';
import {
  ME_ADDRESS,
  NO_SUBJECT,
  type Message,
  type SaveDraftRequest,
} from '@/types/mail';

const isSaveDraftRequest = (value: unknown): value is SaveDraftRequest => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const body = value as Record<string, unknown>;
  return (
    Array.isArray(body.to) &&
    body.to.every((to) => typeof to === 'string') &&
    typeof body.subject === 'string' &&
    typeof body.body === 'string'
  );
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const payload: unknown = await request.json();
    if (!isSaveDraftRequest(payload)) {
      return errorResponse('リクエストの形式が正しくありません。', 400);
    }

    const draft: Message = {
      id: payload.id ?? randomUUID(),
      threadId: payload.threadId ?? randomUUID(),
      from: ME_ADDRESS,
      to: payload.to,
      subject: payload.subject.trim() || NO_SUBJECT,
      body: payload.body,
      status: 'draft',
      createdAt: new Date().toISOString(),
      read: true,
    };
    await saveMessage(draft);

    return NextResponse.json({ draft });
  } catch (error) {
    return unexpectedErrorResponse('POST /api/messages/drafts', error);
  }
};
