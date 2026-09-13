'use client';

import type { ListedAgent } from '@/types/mail';
import { Icon } from '../Icon';
import { PermissionBadge } from '../PermissionBadge';
import styles from './ContactList.module.css';

interface ContactListProps {
  readonly agents: readonly ListedAgent[];
  readonly selectedAgentId: string | null;
  readonly query: string;
  readonly onChangeQuery: (query: string) => void;
  readonly onSelect: (agentId: string) => void;
  readonly onCreate: () => void;
}

const matches = (agent: ListedAgent, query: string): boolean => {
  if (!query) {
    return true;
  }
  const keyword = query.toLowerCase();
  return [agent.name, agent.description ?? '', agent.model].some(
    (value) => value.toLowerCase().includes(keyword)
  );
};

/** アドレス帳の一覧（スレッド一覧と同じ位置に表示する） */
export const ContactList = ({
  agents,
  selectedAgentId,
  query,
  onChangeQuery,
  onSelect,
  onCreate,
}: ContactListProps) => {
  const shown = agents.filter((agent) => matches(agent, query));

  return (
    <section className={styles.list}>
      <div className={styles.searchRow}>
        <input
          type="search"
          className={styles.search}
          placeholder="名前・説明・モデルを検索"
          value={query}
          onChange={(event) => onChangeQuery(event.target.value)}
        />
        <button type="button" className={styles.addButton} onClick={onCreate}>
          <Icon name="plus" size={15} />
          追加
        </button>
      </div>

      <div className={styles.items}>
        {shown.length === 0 && (
          <p className={styles.empty}>該当するエージェントはありません</p>
        )}

        {shown.map((agent) => (
          <button
            key={agent.id}
            type="button"
            className={`${styles.item} ${
              agent.id === selectedAgentId ? styles.selected : ''
            }`}
            onClick={() => onSelect(agent.id)}
          >
            <div className={styles.topRow}>
              <span className={styles.name}>{agent.name}</span>
              <PermissionBadge agent={agent} />
              {agent.isDefault && (
                <span className={styles.defaultTag}>デフォルト</span>
              )}
            </div>
            <div className={styles.model}>{agent.model}</div>
            {agent.description && (
              <div className={styles.description}>{agent.description}</div>
            )}
          </button>
        ))}
      </div>
    </section>
  );
};
