'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toThreadExchanges } from '@/lib/thread';
import {
  isOutgoingMessage,
  isThreadPaneFolder,
  NO_SUBJECT,
  type Agent,
  type Message,
  type SendMessageResponse,
  type Thread,
} from '@/types/mail';
import {
  AgentEditor,
  ComposeWindow,
  ContactList,
  ContactView,
  FolderSidebar,
  GlobalLoader,
  HomeView,
  Icon,
  SettingsView,
  ThreadList,
  ThreadView,
} from './components';
import {
  useAgentEditor,
  useAgents,
  useCompose,
  useDeleteMessage,
  useSendMessage,
  useTheme,
  useThreadDetail,
  useThreads,
} from './hooks';
import styles from './Mailbox.module.css';

/** 対応中の配信があるあいだ、返信が届いたかを見に行く間隔 */
const PENDING_POLL_INTERVAL_MS = 3000;

/** LLMailer の 3 ペイン画面 */
export const Mailbox = () => {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  /** アドレス帳で選択中のエージェント */
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  /** 直近の送信結果。一覧・詳細の再取得が終わるまで、この内容で表示を埋める */
  const [recentSend, setRecentSend] = useState<SendMessageResponse | null>(null);

  const agents = useAgents();
  const threads = useThreads();
  /** スレッド本文を表示するフォルダか（ホーム・アドレス帳・設定では表示しない） */
  const threadPaneVisible = isThreadPaneFolder(threads.folder);
  const detail = useThreadDetail(
    selectedThreadId,
    threads.reload,
    threadPaneVisible
  );
  const sender = useSendMessage();
  /** 失敗した返信を消すためのもの（再送後の片付けと、再送しない取り消しで使う） */
  const failureDeleter = useDeleteMessage();
  const draftDeleter = useDeleteMessage();
  const compose = useCompose(threads.reload);
  const agentEditor = useAgentEditor(agents.reload);
  const theme = useTheme();

  /** 削除されたエージェントも過去のスレッドには残るため、見つからない場合の表示も用意する */
  const agentName = useCallback(
    (agentId: string): string =>
      agents.agents.find((agent) => agent.id === agentId)?.name ??
      '不明なエージェント',
    [agents.agents]
  );

  const selectedAgent =
    agents.agents.find((agent) => agent.id === selectedAgentId) ??
    agents.agents[0] ??
    null;

  const selectThread = useCallback((threadId: string) => {
    setSelectedThreadId(threadId);
  }, []);

  /** 配信はサーバー側で続くため、対応中があるあいだは返信が届いたかを見に行く */
  const { pendingCount, reload: reloadThreads } = threads;
  const { reload: reloadDetail } = detail;
  useEffect(() => {
    if (pendingCount === 0) {
      return;
    }

    const timer = setInterval(() => {
      reloadThreads();
      reloadDetail();
    }, PENDING_POLL_INTERVAL_MS);

    return () => {
      clearInterval(timer);
    };
  }, [pendingCount, reloadThreads, reloadDetail]);

  /**
   * 送信直後は再取得がまだ終わっていないため、
   * POST のレスポンスにあるメッセージのうち、詳細に載っていないものを補って表示する。
   */
  const recentMessages = useMemo((): readonly Message[] => {
    if (!recentSend || recentSend.sent.threadId !== selectedThreadId) {
      return [];
    }
    const knownIds = new Set(detail.messages.map((message) => message.id));
    return [recentSend.sent, ...recentSend.pending].filter(
      (message) => !knownIds.has(message.id)
    );
  }, [detail.messages, recentSend, selectedThreadId]);

  const shownMessages = useMemo(
    (): readonly Message[] => [...detail.messages, ...recentMessages],
    [detail.messages, recentMessages]
  );

  /** 本文は「送信とその返信」を 1 まとまりにして、新しいものから並べる */
  const shownExchanges = useMemo(
    () => toThreadExchanges(shownMessages),
    [shownMessages]
  );

  const headMessage = recentSend?.sent;

  /** 新規送信の直後は、サーバーに保存される前でもスレッドとして表示する */
  const shownThread: Thread | null =
    detail.thread ??
    (headMessage && shownMessages.length > 0
      ? {
          id: selectedThreadId ?? '',
          subject: headMessage.subject || NO_SUBJECT,
          participants: headMessage.agentIds,
          lastMessageAt: headMessage.createdAt,
          messageCount: shownMessages.length,
          unreadCount: 0,
          snippet: '',
          hasPending: shownMessages.some(
            (message) => message.status === 'pending'
          ),
          hasFailure: shownMessages.some(
            (message) => message.status === 'failed'
          ),
        }
      : null);

  /** 送信直後のスレッドは一覧にまだ無いので、先頭に足して選択状態が分かるようにする */
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
    // 送信したやり取りがそのまま見えるよう、どのフォルダからでもメールボックスへ移る
    if (threads.folder !== 'mailbox') {
      threads.selectFolder('mailbox');
    }

    const result = await sender.send({
      agentIds: draft.agentIds,
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

  /**
   * 配信に失敗した返信そのものを消す。
   *
   * 「失敗しました」の行も一覧の失敗ラベルも、この 1 通だけが根拠なので、
   * 消せば再送・取り消しのボタンもラベルも残らない。
   */
  const dismissFailure = useCallback(
    async (failed: Message): Promise<boolean> => {
      if (!(await failureDeleter.remove(failed.id))) {
        return false;
      }

      // 送信直後の控えに残っていると「対応中」として戻ってしまうため、そこからも外す
      setRecentSend((current) =>
        current
          ? {
              ...current,
              pending: current.pending.filter(
                (message) => message.id !== failed.id
              ),
            }
          : current
      );
      return true;
    },
    [failureDeleter]
  );

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
        agentIds: failed.agentIds,
        subject: original.subject,
        body: original.body,
        threadId: failed.threadId,
        inReplyTo: original.id,
      });

      if (!result) {
        return;
      }

      // 再送したからには、もう済んだ失敗を残さない
      await dismissFailure(failed);
      setRecentSend(result);
      threads.reload();
      detail.reload();
    },
    [detail, dismissFailure, sender, shownMessages, threads]
  );

  /** 配信に失敗した返信を、再送せずに取り消す */
  const handleCancelFailure = useCallback(
    async (failed: Message) => {
      if (!(await dismissFailure(failed))) {
        return;
      }

      threads.reload();
      detail.reload();
    },
    [detail, dismissFailure, threads]
  );

  /** スレッドの最後のエージェント発言に返信する */
  const handleReply = useCallback(() => {
    // エージェントの発言が無ければ、自分の送信（＝同じ宛先）に対する追記として返信する
    const target =
      [...shownMessages].reverse().find((message) => !isOutgoingMessage(message)) ??
      shownMessages[shownMessages.length - 1];

    if (target) {
      compose.openReply(target);
    }
  }, [compose, shownMessages]);

  /** ホームから選んだスレッドは、すべてのやり取りが出るメールボックスで開く */
  const handleSelectHomeThread = useCallback(
    (threadId: string) => {
      threads.selectFolder('mailbox');
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

  const handleDeleteDraft = useCallback(
    async (draftMessage: Message) => {
      const confirmed = window.confirm(
        `下書き「${draftMessage.subject}」を削除しますか？`
      );
      if (!confirmed) {
        return;
      }

      if (!(await draftDeleter.remove(draftMessage.id))) {
        return;
      }

      // 削除した下書きを開いたままだと、保存し直して復活してしまう
      if (compose.draft?.draftId === draftMessage.id) {
        compose.close();
      }
      threads.reload();
    },
    [compose, draftDeleter, threads]
  );

  /** 追加・変更したエージェントは、そのまま詳細で確認できるように選択しておく */
  const handleSaveAgent = useCallback(async () => {
    const saved = await agentEditor.save();
    if (saved) {
      setSelectedAgentId(saved.id);
    }
  }, [agentEditor]);

  const handleDeleteAgent = useCallback(
    async (target: Agent) => {
      const confirmed = window.confirm(
        `${target.name}を削除しますか？\n送受信済みのメールは残ります。`
      );
      if (!confirmed) {
        return;
      }

      if (await agentEditor.remove(target.id)) {
        setSelectedAgentId(null);
      }
    },
    [agentEditor]
  );

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.logo}>LLMailer</h1>
        <span className={styles.tagline}>
          メールを書くように LLM へ指示を送る
        </span>
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
      {failureDeleter.error && (
        <p className={styles.notice}>{failureDeleter.error}</p>
      )}
      {draftDeleter.error && (
        <p className={styles.notice}>{draftDeleter.error}</p>
      )}
      {/* 編集フォームを開いていないときの失敗（削除など）はヘッダー下に出す */}
      {agentEditor.error && !agentEditor.form && (
        <p className={styles.notice}>{agentEditor.error}</p>
      )}

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
            pendingCount={pendingCount}
            loading={threads.loading}
            error={threads.error}
            agentName={agentName}
            onSelectFolder={threads.selectFolder}
            onSelectThread={handleSelectHomeThread}
            onCompose={compose.openNew}
          />
        ) : threads.folder === 'settings' ? (
          <SettingsView
            theme={theme.theme}
            onSelectTheme={theme.selectTheme}
          />
        ) : threads.folder === 'contacts' ? (
          <>
            <ContactList
              agents={agents.agents}
              selectedAgentId={selectedAgent?.id ?? null}
              query={threads.query}
              onChangeQuery={threads.changeQuery}
              onSelect={setSelectedAgentId}
              onCreate={agentEditor.openNew}
            />
            <ContactView
              agent={selectedAgent}
              deleting={agentEditor.deleting}
              onCompose={compose.openNew}
              onEdit={agentEditor.openEdit}
              onDelete={handleDeleteAgent}
            />
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
              onDeleteDraft={(draftMessage) =>
                void handleDeleteDraft(draftMessage)
              }
              deletingDraft={draftDeleter.deleting}
            />

            <ThreadView
              thread={shownThread}
              exchanges={shownExchanges}
              loading={detail.loading}
              // 保存前のスレッドを取得しに行くと 404 になるため、表示できているうちは伏せる
              error={shownMessages.length > 0 ? null : detail.error}
              agentName={agentName}
              onReply={handleReply}
              onRetry={handleRetry}
              onCancelFailure={handleCancelFailure}
              dismissing={failureDeleter.deleting}
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
          agentName={agentName}
          onChange={compose.update}
          onToggleRecipient={compose.toggleRecipient}
          onSend={handleSend}
          onSaveDraft={() => void compose.saveDraft()}
          onClose={compose.close}
        />
      )}

      {agentEditor.form && (
        <AgentEditor
          form={agentEditor.form}
          saving={agentEditor.saving}
          error={agentEditor.error}
          onChange={agentEditor.update}
          onSave={() => void handleSaveAgent()}
          onClose={agentEditor.close}
        />
      )}

      <GlobalLoader count={pendingCount} />
    </div>
  );
};
