'use client';

import type { AgentMailbox } from '@/lib/agentMailbox';
import {
  FOLDER_LABELS,
  MAIL_FOLDERS,
  TOOL_FOLDERS,
  type Folder,
} from '@/types/mail';
import { Icon } from '../Icon';
import styles from './FolderSidebar.module.css';

interface FolderSidebarProps {
  readonly folder: Folder;
  /** 宛先ごとの一覧を出しているメールボックス（出していなければ null） */
  readonly selectedMailboxKey: string | null;
  /** 宛先ごとのメールボックス（設定によりデフォルトのぶんは 1 つにまとまる） */
  readonly mailboxes: readonly AgentMailbox[];
  /** アドレス帳に載っているエージェントの数 */
  readonly agentCount: number;
  readonly unreadCount: number;
  /** 対応中（応答待ち）の件数 */
  readonly pendingCount: number;
  readonly draftCount: number;
  readonly agentUnreadCounts: Readonly<Record<string, number>>;
  /** 宛先ごとの対応中件数（エージェント ID → 件数） */
  readonly agentPendingCounts: Readonly<Record<string, number>>;
  readonly onSelectFolder: (folder: Folder) => void;
  readonly onSelectMailbox: (mailbox: AgentMailbox) => void;
  readonly onCompose: (to?: readonly string[]) => void;
}

/** メールボックスに含まれる宛先ぶんを合計する（まとめたものは全員ぶん） */
const sumCounts = (
  counts: Readonly<Record<string, number>>,
  agentIds: readonly string[]
): number =>
  agentIds.reduce((total, agentId) => total + (counts[agentId] ?? 0), 0);

/**
 * フォルダの切り替え（アドレス帳もフォルダの 1 つとして扱う）。
 *
 * メールのフォルダと、それ以外の画面のあいだに宛先（エージェント）ごとの一覧を挟む。
 */
export const FolderSidebar = ({
  folder,
  selectedMailboxKey,
  mailboxes,
  agentCount,
  unreadCount,
  pendingCount,
  draftCount,
  agentUnreadCounts,
  agentPendingCounts,
  onSelectFolder,
  onSelectMailbox,
  onCompose,
}: FolderSidebarProps) => {
  /** 宛先で絞り込んでいるあいだは、元のフォルダを選択中にしない */
  const folderClassName = (item: Folder): string =>
    `${styles.item} ${
      folder === item && selectedMailboxKey === null ? styles.active : ''
    }`;

  const selected = (item: Folder): boolean =>
    folder === item && selectedMailboxKey === null;

  return (
    <nav className={styles.sidebar}>
      <button
        type="button"
        className={styles.composeButton}
        onClick={() => onCompose()}
      >
        <Icon name="mail" size={17} />
        新規作成
      </button>

      {MAIL_FOLDERS.map((item) => (
        <div key={item}>
          {/* ホームと、メールのフォルダを区切る */}
          {item === 'mailbox' && <hr className={styles.separator} />}
          <button
            type="button"
            className={folderClassName(item)}
            onClick={() => onSelectFolder(item)}
            aria-current={selected(item)}
          >
            <span className={styles.label}>{FOLDER_LABELS[item]}</span>
            {/* 対応中は一覧を開かなくても分かるよう、メールボックスにも出す。
                フォルダ名が詰まらないよう、文字は添えずに点滅するドットだけにする */}
            {item === 'mailbox' && (pendingCount > 0 || unreadCount > 0) && (
              <span className={styles.trailing}>
                {pendingCount > 0 && (
                  <span className={styles.pendingDot} aria-label="対応中" />
                )}
                {unreadCount > 0 && (
                  <span className={styles.badge}>{unreadCount}</span>
                )}
              </span>
            )}
            {item === 'drafts' && draftCount > 0 && (
              <span className={styles.countBadge}>{draftCount}</span>
            )}
          </button>
        </div>
      ))}

      <hr className={styles.separator} />

      {mailboxes.map((mailbox) => {
        // まとめたメールボックスは、含まれる宛先ぶんを合わせて出す
        const mailboxPending = sumCounts(agentPendingCounts, mailbox.agentIds);
        const mailboxUnread = sumCounts(agentUnreadCounts, mailbox.agentIds);

        return (
          <button
            key={mailbox.key}
            type="button"
            className={`${styles.item} ${
              selectedMailboxKey === mailbox.key ? styles.active : ''
            }`}
            onClick={() => onSelectMailbox(mailbox)}
            aria-current={selectedMailboxKey === mailbox.key}
            title={mailbox.description ?? mailbox.name}
          >
            <span className={styles.agentName}>{mailbox.name}</span>
            {/* 宛先ごとの対応中も、メールボックスと同じくドットだけで示す */}
            {(mailboxPending > 0 || mailboxUnread > 0) && (
              <span className={styles.trailing}>
                {mailboxPending > 0 && (
                  <span className={styles.pendingDot} aria-label="対応中" />
                )}
                {mailboxUnread > 0 && (
                  <span className={styles.badge}>{mailboxUnread}</span>
                )}
              </span>
            )}
          </button>
        );
      })}

      <hr className={styles.separator} />

      {TOOL_FOLDERS.map((item) => (
        <button
          key={item}
          type="button"
          className={folderClassName(item)}
          onClick={() => onSelectFolder(item)}
          aria-current={selected(item)}
        >
          <span className={styles.label}>{FOLDER_LABELS[item]}</span>
          {item === 'contacts' && agentCount > 0 && (
            <span className={styles.countBadge}>{agentCount}</span>
          )}
        </button>
      ))}
    </nav>
  );
};
