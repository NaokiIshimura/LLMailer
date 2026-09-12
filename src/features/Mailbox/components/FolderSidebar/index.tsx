'use client';

import { FOLDER_LABELS, FOLDERS, type Folder } from '@/types/mail';
import { Icon } from '../Icon';
import styles from './FolderSidebar.module.css';

interface FolderSidebarProps {
  readonly folder: Folder;
  readonly unreadCount: number;
  readonly draftCount: number;
  readonly agentCount: number;
  readonly onSelectFolder: (folder: Folder) => void;
  readonly onCompose: (to?: readonly string[]) => void;
}

/** フォルダの切り替え（アドレス帳もフォルダの 1 つとして扱う） */
export const FolderSidebar = ({
  folder,
  unreadCount,
  draftCount,
  agentCount,
  onSelectFolder,
  onCompose,
}: FolderSidebarProps) => (
  <nav className={styles.sidebar}>
    <button
      type="button"
      className={styles.composeButton}
      onClick={() => onCompose()}
    >
      <Icon name="mail" size={17} />
      新規作成
    </button>

    {FOLDERS.map((item) => (
      <div key={item}>
        {/* ホームとアドレス帳はスレッドのフォルダではないので区切る */}
        {(item === 'inbox' || item === 'contacts') && (
          <hr className={styles.separator} />
        )}
        <button
          type="button"
          className={`${styles.item} ${folder === item ? styles.active : ''}`}
          onClick={() => onSelectFolder(item)}
          aria-current={folder === item}
        >
          <span>{FOLDER_LABELS[item]}</span>
          {item === 'inbox' && unreadCount > 0 && (
            <span className={styles.badge}>{unreadCount}</span>
          )}
          {item === 'drafts' && draftCount > 0 && (
            <span className={styles.countBadge}>{draftCount}</span>
          )}
          {item === 'contacts' && agentCount > 0 && (
            <span className={styles.countBadge}>{agentCount}</span>
          )}
        </button>
      </div>
    ))}
  </nav>
);
