'use client';

import {
  isFullAccessAgent,
  type Agent,
  type ListedAgent,
} from '@/types/mail';
import { Icon } from '../Icon';
import { PermissionBadge } from '../PermissionBadge';
import styles from './ContactView.module.css';

interface ContactViewProps {
  readonly agent: ListedAgent | null;
  readonly deleting: boolean;
  readonly onCompose: (agentIds: readonly string[]) => void;
  readonly onEdit: (agent: Agent) => void;
  readonly onDelete: (agent: Agent) => void;
}

const formatTimeout = (timeoutMs?: number): string =>
  timeoutMs === undefined
    ? '既定（10 分）'
    : `${Math.round(timeoutMs / 1000)} 秒`;

/** アドレス帳で選んだエージェントの詳細 */
export const ContactView = ({
  agent,
  deleting,
  onCompose,
  onEdit,
  onDelete,
}: ContactViewProps) => {
  if (!agent) {
    return (
      <section className={styles.view}>
        <p className={styles.placeholder}>
          エージェントを選択すると、モデル・権限・作業ディレクトリを確認できます。
        </p>
      </section>
    );
  }

  const fullAccess = isFullAccessAgent(agent);
  // 既定のエージェントはアプリの土台なので、画面からは変更・削除させない
  const { isDefault } = agent;

  return (
    <section className={styles.view}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>
            {agent.name}
            <PermissionBadge agent={agent} />
            {isDefault && <span className={styles.defaultTag}>既定</span>}
          </h1>
          {agent.description && (
            <p className={styles.description}>{agent.description}</p>
          )}
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.composeButton}
            onClick={() => onCompose([agent.id])}
          >
            <Icon name="mail" size={16} />
            メールを書く
          </button>
          {!isDefault && (
            <>
              <button
                type="button"
                className={styles.actionButton}
                onClick={() => onEdit(agent)}
              >
                <Icon name="edit" size={15} />
                編集
              </button>
              <button
                type="button"
                className={`${styles.actionButton} ${styles.deleteButton}`}
                onClick={() => onDelete(agent)}
                disabled={deleting}
              >
                <Icon name="trash" size={15} />
                削除
              </button>
            </>
          )}
        </div>
      </header>

      <div className={styles.body}>
        <p className={styles.sectionTitle}>設定</p>
        <table className={styles.table}>
          <tbody>
            <tr>
              <th>モデル</th>
              <td className={styles.mono}>{agent.model}</td>
            </tr>
            <tr>
              <th>作業ディレクトリ</th>
              <td className={styles.mono}>{agent.workingDirectory ?? '.'}</td>
            </tr>
            <tr>
              <th>権限モード</th>
              <td className={styles.mono}>{agent.permissionMode ?? 'manual'}</td>
            </tr>
            <tr>
              <th>できること</th>
              <td>
                {fullAccess
                  ? 'ファイルの読み書き、コマンド実行'
                  : 'ファイルの読み取りと検索のみ（作成・変更・コマンド実行は不可）'}
              </td>
            </tr>
            <tr>
              <th>許可ツール</th>
              <td>
                {agent.allowedTools && agent.allowedTools.length > 0 ? (
                  <span className={styles.tools}>
                    {agent.allowedTools.map((tool) => (
                      <span key={tool} className={styles.tool}>
                        {tool}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className={styles.muted}>指定なし（制限しない）</span>
                )}
              </td>
            </tr>
            <tr>
              <th>無効化ツール</th>
              <td>
                {agent.disallowedTools && agent.disallowedTools.length > 0 ? (
                  <span className={styles.tools}>
                    {agent.disallowedTools.map((tool) => (
                      <span
                        key={tool}
                        className={`${styles.tool} ${styles.denied}`}
                      >
                        {tool}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className={styles.muted}>なし</span>
                )}
              </td>
            </tr>
            <tr>
              <th>設定ソース</th>
              <td className={styles.mono}>
                {agent.settingSources && agent.settingSources.length > 0
                  ? agent.settingSources.join(', ')
                  : 'user, project, local（既定）'}
              </td>
            </tr>
            <tr>
              <th>タイムアウト</th>
              <td>{formatTimeout(agent.timeoutMs)}</td>
            </tr>
          </tbody>
        </table>

        <p className={styles.sectionTitle}>役割（システムプロンプト）</p>
        {agent.systemPrompt ? (
          <p className={styles.prompt}>{agent.systemPrompt}</p>
        ) : (
          <p className={styles.muted}>設定されていません</p>
        )}

        <p className={styles.hint}>
          {isDefault
            ? '既定のエージェントのため、画面からは変更・削除できません。'
            : '編集で変えられない項目（許可ツールなど）は data/agents/user.json で調整できます。'}
        </p>
      </div>
    </section>
  );
};
