'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { toAgentMailboxes, type AgentMailbox } from '@/lib/agentMailbox';
import { toThreadExchanges } from '@/lib/thread';
import {
  isOutgoingMessage,
  isThreadPaneFolder,
  NO_SUBJECT,
  type Agent,
  type Folder,
  type ListedTemplate,
  type Message,
  type SendMessageResponse,
  type Thread,
} from '@/types/mail';
import {
  AgentEditor,
  ComposeWindow,
  ContactList,
  ContactView,
  FileViewer,
  FolderSidebar,
  GlobalLoader,
  HomeView,
  Icon,
  SettingsView,
  TemplateEditor,
  ThreadList,
  ThreadView,
} from './components';
import {
  useAgentEditor,
  useAgents,
  useArchiveThread,
  useCancelDelivery,
  useCompose,
  useDeleteMessage,
  useDismissMessage,
  useFileViewer,
  useGroupDefaultAgents,
  useNotificationSound,
  useRenameThread,
  useReplyChime,
  useSendMessage,
  useTemplateEditor,
  useTemplates,
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
  /** 返信を得られなかった通（失敗・中断）を、再送せずに取り消すためのもの */
  const dismisser = useDismissMessage();
  const draftDeleter = useDeleteMessage();
  /** 対応中の配信の中断 */
  const canceler = useCancelDelivery();
  /** 対応が済んだスレッドの片付け（アーカイブと、その解除） */
  const archiver = useArchiveThread();
  /** スレッドのお題の変更 */
  const renamer = useRenameThread();
  const compose = useCompose(threads.reload);
  const agentEditor = useAgentEditor(agents.reload);
  /** 本文へ差し込める定型文（作成ウィンドウと設定で同じものを見せる） */
  const templates = useTemplates();
  const templateEditor = useTemplateEditor(templates.reload);
  const theme = useTheme();
  const notificationSound = useNotificationSound();
  /** 左ペインでデフォルトのエージェントを 1 つにまとめるかの設定 */
  const groupDefaultAgents = useGroupDefaultAgents();
  /** 本文に書かれた実行計画などの md ファイルを、その場で読むためのビューア */
  const fileViewer = useFileViewer();

  /** 返信が届いたら通知音で知らせる（画面を見ていなくても作業の完了が分かるように） */
  useReplyChime(threads.receivedCount, notificationSound.play);

  /** 削除されたエージェントも過去のスレッドには残るため、見つからない場合の表示も用意する */
  const agentName = useCallback(
    (agentId: string): string =>
      agents.agents.find((agent) => agent.id === agentId)?.name ??
      '不明なエージェント',
    [agents.agents]
  );

  /** 作業ディレクトリの保存形は `.` や `~` なので、サーバーが直した形を使う */
  const agentDirectory = useCallback(
    (agentId: string): string | undefined =>
      agents.agents.find((agent) => agent.id === agentId)
        ?.resolvedWorkingDirectory,
    [agents.agents]
  );

  const selectedAgent =
    agents.agents.find((agent) => agent.id === selectedAgentId) ??
    agents.agents[0] ??
    null;

  /** サイドバーに並べる宛先ごとのメールボックス（設定によりデフォルトのぶんはまとまる） */
  const mailboxes = useMemo(
    () => toAgentMailboxes(agents.agents, groupDefaultAgents.grouped),
    [agents.agents, groupDefaultAgents.grouped]
  );

  /** サイドバーで一覧を開いているメールボックス */
  const listedMailbox =
    mailboxes.find((mailbox) => mailbox.key === threads.mailboxKey) ?? null;

  const selectThread = useCallback((threadId: string) => {
    setSelectedThreadId(threadId);
  }, []);

  /**
   * 見ている場所を移ったら、開いていたスレッドは閉じる。
   *
   * 選択中のスレッドは一覧に無くても先頭に足して見せているため、
   * 開いたままにすると移った先の一覧にも出てしまう。
   */
  const handleSelectFolder = useCallback(
    (next: Folder) => {
      setSelectedThreadId(null);
      threads.selectFolder(next);
    },
    [threads]
  );

  const handleSelectMailbox = useCallback(
    (mailbox: AgentMailbox) => {
      setSelectedThreadId(null);
      threads.selectMailbox(mailbox.key, mailbox.agentIds);
    },
    [threads]
  );

  /**
   * まとめる設定を切り替えると、開いていたメールボックスが無くなることがある。
   * 絞り込みだけが残ると何の一覧か分からなくなるため、メールボックスへ戻す。
   */
  const { mailboxKey, selectFolder } = threads;
  useEffect(() => {
    if (
      mailboxKey !== null &&
      mailboxes.length > 0 &&
      !mailboxes.some((mailbox) => mailbox.key === mailboxKey)
    ) {
      selectFolder('mailbox');
    }
  }, [mailboxKey, mailboxes, selectFolder]);

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

  /** 送信直後のスレッドを開いたときは、詳細が届くまで送信結果からスレッドを組み立てて表示する */
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
          // 送ったばかりなので片付いていない（アーカイブ済みでも送信でメールボックスへ戻る）
          archived: false,
        }
      : null);

  /** 保存済みのスレッドの ID（送信直後の組み立てぶんは、まだ保存されていない） */
  const storedThreadId = detail.thread?.id ?? null;

  /** 選択中のスレッドが一覧に無いときは、先頭に足して選択状態が分かるようにする */
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

    // 新規送信でもスレッド ID をここで決めておき、サーバーの採番を待たずに送る
    const threadId = draft.threadId ?? crypto.randomUUID();

    // 配信の完了を待たずに作成ウィンドウを閉じる。
    // 送信しても見ている場所は変えないため、フォルダ・スレッドの選択はそのままにする。
    compose.close();

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
      return;
    }

    setRecentSend(result);
    threads.reload();
    detail.reload();
  }, [compose, detail, sender, threads]);

  /**
   * 送信直後の控えから 1 通を外す。
   *
   * 控えに残っていると、消したはずのものが「対応中」として戻ってしまう。
   */
  const forgetRecentPending = useCallback((messageId: string) => {
    setRecentSend((current) =>
      current
        ? {
            ...current,
            pending: current.pending.filter(
              (message) => message.id !== messageId
            ),
          }
        : current
    );
  }, []);

  /**
   * 配信に失敗した返信を、元の送信内容でもう一度配信する。
   *
   * 失敗・中断の 1 通は消さずに残し、サーバー側で「再送した」ことだけを書き足す。
   * どんなエラーで送り直したのかが、あとからスレッドを読めば分かるようにするため。
   */
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
        resendOf: failed.id,
      });

      if (!result) {
        return;
      }

      setRecentSend(result);
      threads.reload();
      detail.reload();
    },
    [detail, sender, shownMessages, threads]
  );

  /**
   * 返信を得られなかった返信を、再送せずに取り消す。
   *
   * 1 通は消さずに「取り消しました」として残し、
   * 一覧の失敗ラベルと未読からだけ外す（何があったかは、あとから読める）。
   */
  const handleDismiss = useCallback(
    async (unanswered: Message) => {
      if (!(await dismisser.dismiss(unanswered.id))) {
        return;
      }

      threads.reload();
      detail.reload();
    },
    [detail, dismisser, threads]
  );

  /**
   * 対応中の配信を中断する。
   *
   * 作業中のエージェントを途中で止めることになるので、一度だけ確かめる。
   * 中断した 1 通は「中断しました」として残るため、直してから再送できる。
   */
  const handleCancelDelivery = useCallback(
    async (pendingMessage: Message) => {
      const agents = pendingMessage.agentIds.map(agentName).join(', ');
      const confirmed = window.confirm(
        `${agents}の対応を中断しますか？\n途中まで進んだ作業は元に戻りません。`
      );
      if (!confirmed) {
        return;
      }

      if (!(await canceler.cancel(pendingMessage.id))) {
        return;
      }

      forgetRecentPending(pendingMessage.id);
      threads.reload();
      detail.reload();
    },
    [agentName, canceler, detail, forgetRecentPending, threads]
  );

  /**
   * 対応が済んだスレッドを片付ける（アーカイブフォルダでは受信箱へ戻す）。
   *
   * 片付けると今見ているフォルダの一覧から消えるため、開いていたら閉じる。
   */
  const handleArchive = useCallback(
    async (threadId: string, archived: boolean) => {
      if (!(await archiver.setArchived(threadId, archived))) {
        return;
      }

      if (selectedThreadId === threadId) {
        setSelectedThreadId(null);
      }
      threads.reload();
    },
    [archiver, selectedThreadId, threads]
  );

  /**
   * スレッドのお題を変える。
   *
   * 件名はスレッドが 1 つだけ持つので、一覧も本文もまとめて新しいものになる。
   */
  const handleRename = useCallback(
    async (threadId: string, subject: string) => {
      if (!(await renamer.rename(threadId, subject))) {
        return;
      }

      threads.reload();
      detail.reload();
    },
    [detail, renamer, threads]
  );

  /** スレッドの最後のエージェント発言に返信する */
  const handleReply = useCallback(() => {
    const reversed = [...shownMessages].reverse();
    // エージェントの発言が無ければ、自分の送信（＝同じ宛先）に対する追記として返信する
    const target =
      reversed.find((message) => !isOutgoingMessage(message)) ??
      shownMessages[shownMessages.length - 1];

    if (!target) {
      return;
    }

    /*
      宛先の初期値は直近の自分の送信に合わせる。
      最後の受信 1 通の相手を既定にすると、複数宛先のスレッドで
      返信のたびに宛先が 1 件へ減っていくため。
    */
    const lastSent = reversed.find((message) => message.status === 'sent');
    compose.openReply(target, lastSent?.agentIds ?? target.agentIds);
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

  const handleDeleteTemplate = useCallback(
    async (target: ListedTemplate) => {
      const confirmed = window.confirm(
        `テンプレート「${target.name}」を削除しますか？`
      );
      if (!confirmed) {
        return;
      }

      await templateEditor.remove(target.id);
    },
    [templateEditor]
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
      {dismisser.error && <p className={styles.notice}>{dismisser.error}</p>}
      {canceler.error && <p className={styles.notice}>{canceler.error}</p>}
      {draftDeleter.error && (
        <p className={styles.notice}>{draftDeleter.error}</p>
      )}
      {archiver.error && <p className={styles.notice}>{archiver.error}</p>}
      {renamer.error && <p className={styles.notice}>{renamer.error}</p>}
      {/* 編集フォームを開いていないときの失敗（削除など）はヘッダー下に出す */}
      {agentEditor.error && !agentEditor.form && (
        <p className={styles.notice}>{agentEditor.error}</p>
      )}

      <div className={styles.panes}>
        <FolderSidebar
          folder={threads.folder}
          selectedMailboxKey={threads.mailboxKey}
          mailboxes={mailboxes}
          agentCount={agents.agents.length}
          unreadCount={threads.unreadCount}
          pendingCount={pendingCount}
          draftCount={threads.draftCount}
          agentUnreadCounts={threads.agentUnreadCounts}
          agentPendingCounts={threads.agentPendingCounts}
          onSelectFolder={handleSelectFolder}
          onSelectMailbox={handleSelectMailbox}
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
            onSelectFolder={handleSelectFolder}
            onSelectThread={handleSelectHomeThread}
            onCompose={compose.openNew}
          />
        ) : threads.folder === 'settings' ? (
          <SettingsView
            theme={theme.theme}
            onSelectTheme={theme.selectTheme}
            notificationSound={notificationSound.enabled}
            onSelectNotificationSound={notificationSound.setEnabled}
            onPreviewNotificationSound={notificationSound.preview}
            groupDefaultAgents={groupDefaultAgents.grouped}
            onSelectGroupDefaultAgents={groupDefaultAgents.setGrouped}
            templates={templates.templates}
            templateError={
              // 編集フォームを開いているときは、そちらに出るので重ねない
              templates.error ??
              (templateEditor.form ? null : templateEditor.error)
            }
            deletingTemplate={templateEditor.deleting}
            onCreateTemplate={templateEditor.openNew}
            onEditTemplate={templateEditor.openEdit}
            onDeleteTemplate={(template) => void handleDeleteTemplate(template)}
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
          // 同じ組み合わせのまま中身だけが入れ替わるので、移ったら作り直して出し直す
          <Fragment key={`${threads.folder}:${threads.mailboxKey ?? ''}`}>
            <ThreadList
              folder={threads.folder}
              mailbox={listedMailbox}
              threads={shownThreads}
              drafts={threads.drafts}
              agents={agents.agents}
              selectedThreadId={selectedThreadId}
              query={threads.query}
              loading={threads.loading}
              error={threads.error}
              onChangeQuery={threads.changeQuery}
              onSelectThread={selectThread}
              onCompose={compose.openNew}
              onSelectDraft={handleSelectDraft}
              onDeleteDraft={(draftMessage) =>
                void handleDeleteDraft(draftMessage)
              }
              deletingDraft={draftDeleter.deleting}
              onArchiveThread={(thread) =>
                void handleArchive(thread.id, !thread.archived)
              }
              archiving={archiver.archiving}
            />

            <ThreadView
              thread={shownThread}
              exchanges={shownExchanges}
              newReplyCount={detail.newReplyCount}
              loading={detail.loading}
              // 保存前のスレッドを取得しに行くと 404 になるため、表示できているうちは伏せる
              error={shownMessages.length > 0 ? null : detail.error}
              agentName={agentName}
              agentDirectory={agentDirectory}
              onReply={handleReply}
              onMarkRead={detail.markRead}
              onRetry={handleRetry}
              onDismiss={handleDismiss}
              dismissing={dismisser.dismissing}
              onCancelDelivery={handleCancelDelivery}
              canceling={canceler.canceling}
              onArchive={(archived) => {
                if (shownThread) {
                  void handleArchive(shownThread.id, archived);
                }
              }}
              archiving={archiver.archiving}
              /* 保存前のスレッドはまだサーバー側に無いため、件名を変えられない */
              onRename={
                storedThreadId
                  ? (subject) => void handleRename(storedThreadId, subject)
                  : undefined
              }
              renaming={renamer.renaming}
              onOpenFile={fileViewer.open}
            />
          </Fragment>
        )}
      </div>

      {compose.draft && (
        <ComposeWindow
          draft={compose.draft}
          agents={agents.agents}
          templates={templates.templates}
          sending={sender.sending}
          saving={compose.saving}
          error={sender.error}
          onChange={compose.update}
          onToggleRecipient={compose.toggleRecipient}
          onSend={handleSend}
          onSaveDraft={() => void compose.saveDraft()}
          onClose={compose.close}
        />
      )}

      {fileViewer.target && (
        <FileViewer
          path={fileViewer.target}
          file={fileViewer.file}
          loading={fileViewer.loading}
          error={fileViewer.error}
          onOpenFile={fileViewer.open}
          onReload={fileViewer.reload}
          onClose={fileViewer.close}
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

      {templateEditor.form && (
        <TemplateEditor
          form={templateEditor.form}
          saving={templateEditor.saving}
          error={templateEditor.error}
          onChange={templateEditor.update}
          onSave={() => void templateEditor.save()}
          onClose={templateEditor.close}
        />
      )}

      <GlobalLoader count={pendingCount} />
    </div>
  );
};
