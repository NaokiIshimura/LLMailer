import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse, unexpectedErrorResponse } from '@/lib/api/response';
import { parseTemplateFields } from '@/lib/api/templateInput';
import { deleteTemplate, updateTemplate } from '@/lib/store/templateRepository';
import type { TemplateMutationError } from '@/lib/store/templateRepository';

interface RouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

/** デフォルトのテンプレートは 403、名前の重複は 409、無いものは 404 として返す */
const mutationErrorResponse = (error: TemplateMutationError): NextResponse => {
  switch (error) {
    case 'protected':
      return errorResponse(
        'デフォルトのテンプレートは変更・削除できません。',
        403
      );
    case 'duplicateName':
      return errorResponse('同じ名前のテンプレートが既にあります。', 409);
    case 'notFound':
      return errorResponse('テンプレートが見つかりません。', 404);
  }
};

export const PUT = async (
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> => {
  try {
    const { id } = await context.params;
    const payload: unknown = await request.json();
    const fields = parseTemplateFields(payload);
    if (!fields) {
      return errorResponse('リクエストの形式が正しくありません。', 400);
    }

    const updated = await updateTemplate(id, fields);
    if (!updated.ok) {
      return mutationErrorResponse(updated.error);
    }

    return NextResponse.json({ template: updated.value });
  } catch (error) {
    return unexpectedErrorResponse('PUT /api/templates/[id]', error);
  }
};

export const DELETE = async (
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> => {
  try {
    const { id } = await context.params;
    const deleted = await deleteTemplate(id);
    if (!deleted.ok) {
      return mutationErrorResponse(deleted.error);
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return unexpectedErrorResponse('DELETE /api/templates/[id]', error);
  }
};
