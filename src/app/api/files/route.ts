import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse, unexpectedErrorResponse } from '@/lib/api/response';
import { FileReadError, readTextFile } from '@/lib/files/readTextFile';
import { findAgent } from '@/lib/store/agentRepository';

/**
 * 本文に書かれたパスのファイルを 1 件返す。
 *
 * 相対パスの基準になる作業ディレクトリは agentId から引く。
 * クライアントに基準ディレクトリを指定させないことで、
 * 読み取りをエージェントの作業範囲とプロジェクト配下に閉じ込める。
 */
export const GET = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const target = request.nextUrl.searchParams.get('path');
    if (target === null) {
      return errorResponse('path を指定してください', 400);
    }

    const agentId = request.nextUrl.searchParams.get('agentId');
    const agent = agentId === null ? undefined : await findAgent(agentId);

    const file = await readTextFile(target, agent?.workingDirectory);
    return NextResponse.json({ file });
  } catch (error) {
    if (error instanceof FileReadError) {
      return errorResponse(error.message, error.status);
    }
    return unexpectedErrorResponse('GET /api/files', error);
  }
};
