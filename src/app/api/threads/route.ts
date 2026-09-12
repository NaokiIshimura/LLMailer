import { NextResponse, type NextRequest } from 'next/server';
import { unexpectedErrorResponse } from '@/lib/api/response';
import {
  failStalePendingMessages,
  listMessages,
} from '@/lib/store/messageRepository';
import {
  buildDrafts,
  buildThreads,
  countPending,
  countUnread,
  countUnreadByAgent,
} from '@/lib/thread';
import { FOLDERS, type Folder } from '@/types/mail';

const parseFolder = (value: string | null): Folder =>
  FOLDERS.find((folder) => folder === value) ?? 'mailbox';

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const folder = parseFolder(request.nextUrl.searchParams.get('folder'));
    const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';
    // 宛先（エージェント）1 件に絞ったメール一覧を出すための指定
    const agentId = request.nextUrl.searchParams.get('agentId') ?? undefined;
    // 前のプロセスが残した対応中は返信が届かないため、読み出す前に失敗へ倒す
    await failStalePendingMessages();
    const messages = await listMessages();

    return NextResponse.json({
      threads:
        folder === 'drafts'
          ? []
          : buildThreads(messages, { folder, query, agentId }),
      drafts: folder === 'drafts' ? buildDrafts(messages, query) : [],
      unreadCount: countUnread(messages),
      agentUnreadCounts: countUnreadByAgent(messages),
      pendingCount: countPending(messages),
      draftCount: buildDrafts(messages).length,
    });
  } catch (error) {
    return unexpectedErrorResponse('GET /api/threads', error);
  }
};
