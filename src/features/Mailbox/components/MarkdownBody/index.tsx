'use client';

import type { ComponentPropsWithoutRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import styles from './MarkdownBody.module.css';

interface MarkdownBodyProps {
  readonly body: string;
}

/**
 * メッセージ本文を Markdown として表示する。
 *
 * react-markdown は既定で生の HTML を解釈しないため、
 * エージェントの応答をそのまま描画しても HTML が実行されることはない。
 * remark-breaks を入れているのは、メール本文の単一改行をそのまま改行として扱うため。
 */
export const MarkdownBody = ({ body }: MarkdownBodyProps) => (
  <div className={styles.body}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      components={{
        a: ({ href, children }: ComponentPropsWithoutRef<'a'>) => (
          <a href={href} target="_blank" rel="noreferrer noopener">
            {children}
          </a>
        ),
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
