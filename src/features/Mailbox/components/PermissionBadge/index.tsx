'use client';

import { isFullAccessAgent, type Agent } from '@/types/mail';
import styles from './PermissionBadge.module.css';

interface PermissionBadgeProps {
  readonly agent: Agent;
}

/** 宛先がファイルを変更できるかどうかを示すバッジ */
export const PermissionBadge = ({ agent }: PermissionBadgeProps) => {
  const fullAccess = isFullAccessAgent(agent);

  return (
    <span
      className={`${styles.badge} ${
        fullAccess ? styles.fullAccess : styles.readOnly
      }`}
      title={
        fullAccess
          ? 'ファイルの変更やコマンド実行ができます'
          : 'ファイルの読み取りと検索のみ行えます'
      }
    >
      {fullAccess ? 'フル権限' : '読み取り専用'}
    </span>
  );
};
