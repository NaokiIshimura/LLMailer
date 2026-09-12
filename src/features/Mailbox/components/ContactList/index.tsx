'use client';

import type { Agent } from '@/types/mail';
import { PermissionBadge } from '../PermissionBadge';
import styles from './ContactList.module.css';

interface ContactListProps {
  readonly agents: readonly Agent[];
  readonly selectedAddress: string | null;
  readonly query: string;
  readonly onChangeQuery: (query: string) => void;
  readonly onSelect: (address: string) => void;
}

const matches = (agent: Agent, query: string): boolean => {
  if (!query) {
    return true;
  }
  const keyword = query.toLowerCase();
  return [agent.name, agent.address, agent.description ?? '', agent.model].some(
    (value) => value.toLowerCase().includes(keyword)
  );
};

/** アドレス帳の一覧（スレッド一覧と同じ位置に表示する） */
export const ContactList = ({
  agents,
  selectedAddress,
  query,
  onChangeQuery,
  onSelect,
}: ContactListProps) => {
  const shown = agents.filter((agent) => matches(agent, query));

  return (
    <section className={styles.list}>
      <div className={styles.searchRow}>
        <input
          type="search"
          className={styles.search}
          placeholder="名前・アドレス・モデルを検索"
          value={query}
          onChange={(event) => onChangeQuery(event.target.value)}
        />
      </div>

      <div className={styles.items}>
        {shown.length === 0 && (
          <p className={styles.empty}>該当するエージェントはありません</p>
        )}

        {shown.map((agent) => (
          <button
            key={agent.address}
            type="button"
            className={`${styles.item} ${
              agent.address === selectedAddress ? styles.selected : ''
            }`}
            onClick={() => onSelect(agent.address)}
          >
            <div className={styles.topRow}>
              <span className={styles.name}>{agent.name}</span>
              <PermissionBadge agent={agent} />
            </div>
            <div className={styles.address}>{agent.address}</div>
            {agent.description && (
              <div className={styles.description}>{agent.description}</div>
            )}
          </button>
        ))}
      </div>
    </section>
  );
};
