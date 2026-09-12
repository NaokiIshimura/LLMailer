import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse, unexpectedErrorResponse } from '@/lib/api/response';
import { DirectoryError, listDirectories } from '@/lib/directories/listDirectories';

/** ディレクトリ選択ダイアログ用に、1 階層分のディレクトリを返す */
export const GET = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const target = request.nextUrl.searchParams.get('path') ?? undefined;
    const listing = await listDirectories(target);
    return NextResponse.json({ listing });
  } catch (error) {
    if (error instanceof DirectoryError) {
      return errorResponse(error.message, error.status);
    }
    return unexpectedErrorResponse('GET /api/directories', error);
  }
};
