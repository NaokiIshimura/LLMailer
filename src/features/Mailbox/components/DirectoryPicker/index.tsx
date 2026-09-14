'use client';

import { useDirectoryBrowser } from '../../hooks';
import { Icon } from '../Icon';
import { Spinner } from '../Loader';
import styles from './DirectoryPicker.module.css';

interface DirectoryPickerProps {
  /** 最初に開くディレクトリ（現在の設定値） */
  readonly initialPath: string;
  /** 選んだディレクトリを保存用の値で受け取る */
  readonly onSelect: (value: string) => void;
  readonly onClose: () => void;
}

/** 作業ディレクトリを 1 階層ずつ辿って選ぶダイアログ */
export const DirectoryPicker = ({
  initialPath,
  onSelect,
  onClose,
}: DirectoryPickerProps) => {
  const { listing, loading, error, open } = useDirectoryBrowser(initialPath);

  return (
    <div className={styles.overlay}>
      <div
        className={styles.window}
        role="dialog"
        aria-modal="true"
        aria-label="作業ディレクトリの選択"
      >
        <header className={styles.header}>
          <span>作業ディレクトリの選択</span>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="閉じる"
          >
            <Icon name="close" size={18} />
          </button>
        </header>

        <div className={styles.toolbar}>
          <button
            type="button"
            className={styles.toolButton}
            onClick={() => listing?.parent && open(listing.parent)}
            disabled={!listing?.parent}
          >
            <Icon name="arrowUp" size={14} />
            上へ
          </button>
          <button
            type="button"
            className={styles.toolButton}
            onClick={() => listing && open(listing.shortcuts.project)}
            disabled={!listing}
          >
            プロジェクト
          </button>
          <button
            type="button"
            className={styles.toolButton}
            onClick={() => listing && open(listing.shortcuts.home)}
            disabled={!listing}
          >
            ホーム
          </button>
        </div>

        <p className={styles.current} title={listing?.path ?? initialPath}>
          {listing?.path ?? initialPath}
        </p>

        {error && (
          <p className={styles.error}>
            {error}
            <button
              type="button"
              className={styles.errorButton}
              onClick={() => open('.')}
            >
              プロジェクトに戻る
            </button>
          </p>
        )}

        <div className={styles.entries}>
          {loading && (
            <p className={styles.status}>
              <Spinner />
              読み込み中…
            </p>
          )}
          {!loading &&
            listing?.entries.map((entry) => (
              <button
                key={entry.path}
                type="button"
                className={styles.entry}
                onClick={() => open(entry.path)}
              >
                <Icon name="folder" size={15} />
                <span className={styles.entryName}>{entry.name}</span>
              </button>
            ))}
          {!loading && listing?.entries.length === 0 && (
            <p className={styles.status}>ここにディレクトリはありません</p>
          )}
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.selectButton}
            onClick={() => listing && onSelect(listing.value)}
            disabled={!listing}
          >
            このディレクトリを選択
          </button>
          <button type="button" className={styles.cancelButton} onClick={onClose}>
            キャンセル
          </button>
          <span className={styles.footerHint}>
            プロジェクト配下は相対パス、ホーム配下は <code>~</code> で保存します
          </span>
        </footer>
      </div>
    </div>
  );
};
