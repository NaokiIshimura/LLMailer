import { NextResponse, type NextRequest } from 'next/server';
import { unexpectedErrorResponse } from '@/lib/api/response';
import {
  failStalePendingMessages,
  listDraftMessages,
} from '@/lib/store/messageRepository';
import { listThreadRecords } from '@/lib/store/threadRepository';
import {
  buildDrafts,
  buildThreads,
  collectArchivedThreadIds,
  countPending,
  countPendingByAgent,
  countReceived,
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
    // 宛先（エージェント）で絞ったメール一覧を出すための指定。
    // まとめたメールボックスでは複数の宛先を受け取る
    const agentIds = request.nextUrl.searchParams.getAll('agentId');
    // 前のプロセスが残した対応中は返信が届かないため、読み出す前に失敗へ倒す
    await failStalePendingMessages();
    const records = await listThreadRecords();
    const drafts = await listDraftMessages();
    // 未読や対応中の件数は下書きも含めた全体から数えるので、読んだものを使い回す
    const messages = [
      ...records.flatMap((record) => record.messages),
      ...drafts,
    ];
    const archivedThreadIds = collectArchivedThreadIds(records);

    return NextResponse.json({
      threads:
        folder === 'drafts'
          ? []
          : buildThreads(records, {
              folder,
              query,
              agentIds,
              archivedThreadIds,
            }),
      drafts: folder === 'drafts' ? buildDrafts(drafts, query) : [],
      unreadCount: countUnread(messages, archivedThreadIds),
      agentUnreadCounts: countUnreadByAgent(messages, archivedThreadIds),
      pendingCount: countPending(messages),
      agentPendingCounts: countPendingByAgent(messages),
      // 返信が届いたかを画面側で見分けるための件数（絞り込みに左右されないよう全体で数える）
      receivedCount: countReceived(messages),
      draftCount: drafts.length,
    });
  } catch (error) {
    return unexpectedErrorResponse('GET /api/threads', error);
  }
};
