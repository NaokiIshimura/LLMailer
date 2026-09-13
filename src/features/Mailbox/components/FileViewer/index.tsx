'use client';

import { formatDateTime, formatFileSize } from '@/lib/format';
import { isMarkdownPath, type FileContent } from '@/lib/files/types';
import { Icon } from '../Icon';
import { Spinner } from '../Loader';
import { MarkdownBody } from '../MarkdownBody';
import styles from './FileViewer.module.css';

interface FileViewerProps {
  /** 本文のリンクに書かれていたパス */
  readonly path: string;
  readonly file: FileContent | null;
  readonly loading: boolean;
  readonly error: string | null;
  /** ビューアの中のリンクから、別のファイルへ移る */
  readonly onOpenFile: (filePath: string) => void;
  readonly onReload: () => void;
  readonly onClose: () => void;
}

/** 本文に書かれた実行計画などの md ファイルを、その場で読むためのビューア */
export const FileViewer = ({
  path,
  file,
  loading,
  error,
  onOpenFile,
  onReload,
  onClose,
}: FileViewerProps) => (
  <div className={styles.overlay}>
    <div
      className={styles.window}
      role="dialog"
      aria-modal="true"
      aria-label={`${file?.name ?? path} の表示`}
    >
      <header className={styles.header}>
        <span className={styles.title}>
          <Icon name="file" size={16} />
          {file?.name ?? path}
        </span>
        <button
          type="button"
          className={styles.headerButton}
          onClick={onReload}
          aria-label="読み直す"
          title="読み直す"
        >
          <Icon name="reload" size={15} />
        </button>
        <button
          type="button"
          className={styles.headerButton}
          onClick={onClose}
          aria-label="閉じる"
        >
          <Icon name="close" size={18} />
        </button>
      </header>

      <p className={styles.path} title={file?.path ?? path}>
        {file?.path ?? path}
      </p>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.content}>
        {/* 読み直しの最中も、すでに出ている中身はそのまま見せ続ける */}
        {loading && !file && (
          <p className={styles.status}>
            <Spinner />
            読み込み中…
          </p>
        )}
        {file &&
          (isMarkdownPath(file.name) ? (
            <MarkdownBody body={file.content} onOpenFile={onOpenFile} />
          ) : (
            <pre className={styles.plain}>{file.content}</pre>
          ))}
      </div>

      <footer className={styles.footer}>
        {file && (
          <span>
            {formatFileSize(file.size)} ・ 更新 {formatDateTime(file.modifiedAt)}
          </span>
        )}
      </footer>
    </div>
  </div>
);
