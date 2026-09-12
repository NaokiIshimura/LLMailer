'use client';

import {
  FOLDER_LABELS,
  MAIL_FOLDERS,
  TOOL_FOLDERS,
  type Agent,
  type Folder,
} from '@/types/mail';
import { Icon } from '../Icon';
import styles from './FolderSidebar.module.css';

interface FolderSidebarProps {
  readonly folder: Folder;
  /** 宛先ごとの一覧を出しているエージェント（出していなければ null） */
  readonly selectedAgentId: string | null;
  readonly agents: readonly Agent[];
  readonly unreadCount: number;
  readonly draftCount: number;
  readonly agentUnreadCounts: Readonly<Record<string, number>>;
  readonly onSelectFolder: (folder: Folder) => void;
  readonly onSelectAgent: (agentId: string) => void;
  readonly onCompose: (to?: readonly string[]) => void;
}

/**
 * フォルダの切り替え（アドレス帳もフォルダの 1 つとして扱う）。
 *
 * メールのフォルダと、それ以外の画面のあいだに宛先（エージェント）ごとの一覧を挟む。
 */
export const FolderSidebar = ({
  folder,
  selectedAgentId,
  agents,
  unreadCount,
  draftCount,
  agentUnreadCounts,
  onSelectFolder,
  onSelectAgent,
  onCompose,
}: FolderSidebarProps) => {
  /** 宛先で絞り込んでいるあいだは、元のフォルダを選択中にしない */
  const folderClassName = (item: Folder): string =>
    `${styles.item} ${
      folder === item && selectedAgentId === null ? styles.active : ''
    }`;

  const selected = (item: Folder): boolean =>
    folder === item && selectedAgentId === null;

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
            <span>{FOLDER_LABELS[item]}</span>
            {item === 'mailbox' && unreadCount > 0 && (
              <span className={styles.badge}>{unreadCount}</span>
            )}
            {item === 'drafts' && draftCount > 0 && (
              <span className={styles.countBadge}>{draftCount}</span>
            )}
          </button>
        </div>
      ))}

      <hr className={styles.separator} />

      {agents.map((agent) => (
        <button
          key={agent.id}
          type="button"
          className={`${styles.item} ${
            selectedAgentId === agent.id ? styles.active : ''
          }`}
          onClick={() => onSelectAgent(agent.id)}
          aria-current={selectedAgentId === agent.id}
          title={agent.description ?? agent.name}
        >
          <span className={styles.agentName}>{agent.name}</span>
          {(agentUnreadCounts[agent.id] ?? 0) > 0 && (
            <span className={styles.badge}>{agentUnreadCounts[agent.id]}</span>
          )}
        </button>
      ))}

      <hr className={styles.separator} />

      {TOOL_FOLDERS.map((item) => (
        <button
          key={item}
          type="button"
          className={folderClassName(item)}
          onClick={() => onSelectFolder(item)}
          aria-current={selected(item)}
        >
          <span>{FOLDER_LABELS[item]}</span>
          {item === 'contacts' && agents.length > 0 && (
            <span className={styles.countBadge}>{agents.length}</span>
          )}
        </button>
      ))}
    </nav>
  );
};
