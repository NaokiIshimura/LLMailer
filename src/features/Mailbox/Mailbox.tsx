'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  ME_ADDRESS,
  NO_SUBJECT,
  type Message,
  type SendMessageResponse,
  type Thread,
} from '@/types/mail';
import {
  ComposeWindow,
  ContactList,
  ContactView,
  FolderSidebar,
  GlobalLoader,
  HomeView,
  Icon,
  ThreadList,
  ThreadView,
} from './components';
import {
  useAgents,
  useCompose,
  useSendMessage,
  useThreadDetail,
  useThreads,
} from './hooks';
import styles from './Mailbox.module.css';

/** LLMailer の 3 ペイン画面 */
export const Mailbox = () => {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  /** アドレス帳で選択中のエージェント */
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  /** 直近の送信結果。一覧・詳細の再取得が終わるまで、この内容で表示を埋める */
  const [recentSend, setRecentSend] = useState<SendMessageResponse | null>(null);

  const agents = useAgents();
  const threads = useThreads();
  /** スレッド本文を表示するフォルダか（ホームとアドレス帳では表示しない） */
  const threadPaneVisible =
    threads.folder !== 'home' && threads.folder !== 'contacts';
  const detail = useThreadDetail(
    selectedThreadId,
    threads.reload,
    threadPaneVisible
  );
  const sender = useSendMessage();
  const compose = useCompose(threads.reload);

  const displayName = useCallback(
    (address: string): string => {
      if (address === ME_ADDRESS) {
        return '自分';
      }
      return (
        agents.agents.find((agent) => agent.address === address)?.name ?? address
      );
    },
    [agents.agents]
  );

  const selectedAgent =
    agents.agents.find((agent) => agent.address === selectedAddress) ??
    agents.agents[0] ??
    null;

  const selectThread = useCallback((threadId: string) => {
    setSelectedThreadId(threadId);
  }, []);

  const pendingForThread = useMemo(
    () =>
      sender.pendingDeliveries.filter(
        (pending) => pending.threadId === selectedThreadId
      ),
    [sender.pendingDeliveries, selectedThreadId]
  );

  /**
   * 配信中の送信は、まだサーバーに保存されていないため一覧・詳細に現れない。
   * 送信した本文をそのまま送信済みメッセージとして見せる。
   */
  const optimisticMessages = useMemo(
    (): readonly Message[] =>
      pendingForThread.map((pending) => ({
        id: `pending-${pending.id}`,
        threadId: pending.threadId ?? '',
        from: ME_ADDRESS,
        to: pending.to,
        subject: pending.subject,
        body: pending.body,
        status: 'sent',
        createdAt: pending.createdAt,
        read: true,
      })),
    [pendingForThread]
  );

  /**
   * 送信直後は再取得がまだ終わっていないため、
   * POST のレスポンスにあるメッセージのうち、詳細に載っていないものを補って表示する。
   */
  const recentMessages = useMemo((): readonly Message[] => {
    if (!recentSend || recentSend.sent.threadId !== selectedThreadId) {
      return [];
    }
    const knownIds = new Set(detail.messages.map((message) => message.id));
    return [recentSend.sent, ...recentSend.replies].filter(
      (message) => !knownIds.has(message.id)
    );
  }, [detail.messages, recentSend, selectedThreadId]);

  const shownMessages = useMemo(
    (): readonly Message[] => [
      ...detail.messages,
      ...recentMessages,
      ...optimisticMessages,
    ],
    [detail.messages, recentMessages, optimisticMessages]
  );

  const headMessage = pendingForThread[0] ?? recentSend?.sent;

  /** 新規送信の直後は、サーバーに保存される前でもスレッドとして表示する */
  const shownThread: Thread | null =
    detail.thread ??
    (headMessage && shownMessages.length > 0
      ? {
          id: selectedThreadId ?? '',
          subject: headMessage.subject || NO_SUBJECT,
          participants: headMessage.to,
          lastMessageAt: headMessage.createdAt,
          messageCount: shownMessages.length,
          unreadCount: 0,
          snippet: '',
          hasPending: pendingForThread.length > 0,
          hasFailure: shownMessages.some(
            (message) => message.status === 'failed'
          ),
        }
      : null);

  /** 配信中のスレッドは一覧にまだ無いので、先頭に足して選択状態が分かるようにする */
  const shownThreads: readonly Thread[] =
    threads.folder !== 'drafts' &&
    shownThread &&
    !threads.threads.some((thread) => thread.id === shownThread.id)
      ? [shownThread, ...threads.threads]
      : threads.threads;

  const handleSend = useCallback(async () => {
    const draft = compose.draft;
    if (!draft) {
      return;
    }

    // 新規送信でもスレッド ID をここで決めておき、応答を待たずにそのスレッドを開く
    const threadId = draft.threadId ?? crypto.randomUUID();

    // 配信の完了を待たずに作成ウィンドウを閉じ、送信先のスレッドを開く
    compose.close();
    setSelectedThreadId(threadId);
    if (
      threads.folder === 'home' ||
      threads.folder === 'contacts' ||
      threads.folder === 'drafts'
    ) {
      threads.selectFolder('inbox');
    }

    const result = await sender.send({
      to: draft.to,
      subject: draft.subject,
      body: draft.body,
      threadId,
      inReplyTo: draft.inReplyTo,
      draftId: draft.draftId,
    });

    if (!result) {
      // 送信できなかったときは入力内容を失わないよう作成ウィンドウへ戻す
      compose.restore(draft);
      setSelectedThreadId(draft.threadId ?? null);
      return;
    }

    setRecentSend(result);
    threads.reload();
    detail.reload();
  }, [compose, detail, sender, threads]);

  /** 配信に失敗した返信を、元の送信内容でもう一度配信する */
  const handleRetry = useCallback(
    async (failed: Message) => {
      const original = shownMessages.find(
        (message) => message.id === failed.inReplyTo
      );
      if (!original) {
        return;
      }

      const result = await sender.send({
        to: [failed.from],
        subject: original.subject,
        body: original.body,
        threadId: failed.threadId,
        inReplyTo: original.id,
      });

      if (result) {
        setRecentSend(result);
        threads.reload();
        detail.reload();
      }
    },
    [detail, sender, shownMessages, threads]
  );

  /** スレッドの最後のエージェント発言に返信する */
  const handleReply = useCallback(() => {
    const target = [...shownMessages]
      .reverse()
      .find((message) => message.from !== ME_ADDRESS);

    if (target) {
      compose.openReply(target);
      return;
    }

    const sent = shownMessages[shownMessages.length - 1];
    if (sent) {
      compose.openReply({ ...sent, from: sent.to[0] ?? ME_ADDRESS });
    }
  }, [compose, shownMessages]);

  /** ホームから選んだスレッドは、種別を問わず出せる「全件」で開く */
  const handleSelectHomeThread = useCallback(
    (threadId: string) => {
      threads.selectFolder('all');
      setSelectedThreadId(threadId);
    },
    [threads]
  );

  const handleSelectDraft = useCallback(
    (draftMessage: Message) => {
      compose.openDraft(draftMessage);
    },
    [compose]
  );


  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.logo}>LLMailer</h1>
        <span className={styles.tagline}>
          メールを書くように LLM へ指示を送る
        </span>
        <span className={styles.me}>{ME_ADDRESS}</span>
        <button
          type="button"
          className={styles.reloadButton}
          onClick={() => {
            threads.reload();
            detail.reload();
          }}
        >
          <Icon name="reload" size={15} />
          更新
        </button>
      </header>

      {agents.error && <p className={styles.notice}>{agents.error}</p>}

      <div className={styles.panes}>
        <FolderSidebar
          folder={threads.folder}
          unreadCount={threads.unreadCount}
          draftCount={threads.draftCount}
          agentCount={agents.agents.length}
          onSelectFolder={threads.selectFolder}
          onCompose={compose.openNew}
        />

        {threads.folder === 'home' ? (
          <HomeView
            threads={threads.threads}
            agents={agents.agents}
            unreadCount={threads.unreadCount}
            draftCount={threads.draftCount}
            pendingCount={sender.pendingDeliveries.length}
            loading={threads.loading}
            error={threads.error}
            displayName={displayName}
            onSelectFolder={threads.selectFolder}
            onSelectThread={handleSelectHomeThread}
            onCompose={compose.openNew}
          />
        ) : threads.folder === 'contacts' ? (
          <>
            <ContactList
              agents={agents.agents}
              selectedAddress={selectedAgent?.address ?? null}
              query={threads.query}
              onChangeQuery={threads.changeQuery}
              onSelect={setSelectedAddress}
            />
            <ContactView agent={selectedAgent} onCompose={compose.openNew} />
          </>
        ) : (
          <>
            <ThreadList
              folder={threads.folder}
              threads={shownThreads}
              drafts={threads.drafts}
              agents={agents.agents}
              selectedThreadId={selectedThreadId}
              query={threads.query}
              loading={threads.loading}
              error={threads.error}
              onChangeQuery={threads.changeQuery}
              onSelectThread={selectThread}
              onSelectDraft={handleSelectDraft}
            />

            <ThreadView
              thread={shownThread}
              messages={shownMessages}
              pendingDeliveries={pendingForThread}
              loading={detail.loading}
              // 保存前のスレッドを取得しに行くと 404 になるため、表示できているうちは伏せる
              error={shownMessages.length > 0 ? null : detail.error}
              displayName={displayName}
              onReply={handleReply}
              onRetry={handleRetry}
            />
          </>
        )}
      </div>

      {compose.draft && (
        <ComposeWindow
          draft={compose.draft}
          agents={agents.agents}
          sending={sender.sending}
          saving={compose.saving}
          error={sender.error}
          displayName={displayName}
          onChange={compose.update}
          onToggleRecipient={compose.toggleRecipient}
          onSend={handleSend}
          onSaveDraft={() => void compose.saveDraft()}
          onClose={compose.close}
        />
      )}

      <GlobalLoader count={sender.pendingDeliveries.length} />
    </div>
  );
};
