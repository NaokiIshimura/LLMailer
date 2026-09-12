'use client';

import { isFullAccessAgent, type Agent } from '@/types/mail';
import { Icon } from '../Icon';
import { PermissionBadge } from '../PermissionBadge';
import styles from './ContactView.module.css';

interface ContactViewProps {
  readonly agent: Agent | null;
  readonly onCompose: (to: readonly string[]) => void;
}

const formatTimeout = (timeoutMs?: number): string =>
  timeoutMs === undefined
    ? '既定（10 分）'
    : `${Math.round(timeoutMs / 1000)} 秒`;

/** アドレス帳で選んだエージェントの詳細 */
export const ContactView = ({ agent, onCompose }: ContactViewProps) => {
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

  return (
    <section className={styles.view}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>
            {agent.name}
            <PermissionBadge agent={agent} />
          </h1>
          <p className={styles.address}>{agent.address}</p>
        </div>
        <button
          type="button"
          className={styles.composeButton}
          onClick={() => onCompose([agent.address])}
        >
          <Icon name="mail" size={16} />
          メールを書く
        </button>
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
          エージェントの追加・変更は <code>data/agents.json</code> を編集してください。
        </p>
      </div>
    </section>
  );
};
