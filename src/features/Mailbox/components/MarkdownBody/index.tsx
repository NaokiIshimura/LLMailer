'use client';

import type { ComponentPropsWithoutRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import {
  FILE_PATH_ATTRIBUTE,
  remarkFilePaths,
} from '@/lib/markdown/remarkFilePaths';
import { Icon } from '../Icon';
import styles from './MarkdownBody.module.css';

interface MarkdownBodyProps {
  readonly body: string;
  /**
   * 本文に書かれたファイルパスを開く。
   * 渡さなければパスはただの文字として表示する。
   */
  readonly onOpenFile?: (filePath: string) => void;
}

/** remark プラグインが付けた data 属性からファイルパスを取り出す */
const toFilePath = (props: Record<string, unknown>): string | null => {
  const value = props[FILE_PATH_ATTRIBUTE];
  return typeof value === 'string' && value !== '' ? value : null;
};

/**
 * メッセージ本文を Markdown として表示する。
 *
 * react-markdown は既定で生の HTML を解釈しないため、
 * エージェントの応答をそのまま描画しても HTML が実行されることはない。
 * remark-breaks を入れているのは、メール本文の単一改行をそのまま改行として扱うため。
 */
export const MarkdownBody = ({ body, onOpenFile }: MarkdownBodyProps) => (
  <div className={styles.body}>
    <ReactMarkdown
      remarkPlugins={
        onOpenFile
          ? [remarkGfm, remarkBreaks, remarkFilePaths]
          : [remarkGfm, remarkBreaks]
      }
      components={{
        a: ({ href, children, ...props }: ComponentPropsWithoutRef<'a'>) => {
          const filePath = toFilePath(props);
          // 本文に書かれた成果物のパスは、外部リンクではなくビューアで開く
          if (filePath && onOpenFile) {
            return (
              <button
                type="button"
                className={styles.fileLink}
                onClick={() => onOpenFile(filePath)}
                title={`${filePath} を開く`}
              >
                <Icon name="file" size={13} />
                <span className={styles.fileLinkLabel}>{children}</span>
              </button>
            );
          }

          return (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          );
        },
        table: ({ children }: ComponentPropsWithoutRef<'table'>) => (
          <div className={styles.tableWrapper}>
            <table>{children}</table>
          </div>
        ),
      }}
    >
      {body}
    </ReactMarkdown>
  </div>
);
