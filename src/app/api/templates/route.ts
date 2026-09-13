import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse, unexpectedErrorResponse } from '@/lib/api/response';
import { parseTemplateFields } from '@/lib/api/templateInput';
import { createTemplate, listTemplates } from '@/lib/store/templateRepository';

export const GET = async (): Promise<NextResponse> => {
  try {
    const templates = await listTemplates();
    return NextResponse.json({ templates });
  } catch (error) {
    return unexpectedErrorResponse('GET /api/templates', error);
  }
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const payload: unknown = await request.json();
    const fields = parseTemplateFields(payload);
    if (!fields) {
      return errorResponse('リクエストの形式が正しくありません。', 400);
    }

    // 識別子はサーバーで採番するため、リクエストからは受け取らない
    const created = await createTemplate(fields);
    if (!created.ok) {
      return errorResponse('同じ名前のテンプレートが既にあります。', 409);
    }

    return NextResponse.json({ template: created.value }, { status: 201 });
  } catch (error) {
    return unexpectedErrorResponse('POST /api/templates', error);
  }
};
