'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  DEFAULT_GROUP_DEFAULT_AGENTS,
  readStoredGroupDefaultAgents,
  storeGroupDefaultAgents,
} from '@/lib/agentMailbox';

export interface UseGroupDefaultAgentsResult {
  /** デフォルトのエージェントのメールボックスを 1 つにまとめるか */
  readonly grouped: boolean;
  readonly setGrouped: (grouped: boolean) => void;
}

/** 保存先（localStorage）の変化を React へ伝えるための控え */
const listeners = new Set<() => void>();

/** localStorage に保存できない環境でも、このセッションのあいだは選択を保てるようにする */
let unsavedGrouped: boolean | null = null;

const currentGrouped = (): boolean =>
  unsavedGrouped ?? readStoredGroupDefaultAgents();

const notify = (): void => {
  listeners.forEach((listener) => listener());
};

/** 同じタブでの変更は notify、別タブでの変更は storage イベントで受け取る */
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
};

/** サーバーには設定が無いため、初回描画はデフォルトのまま */
const serverGrouped = (): boolean => DEFAULT_GROUP_DEFAULT_AGENTS;

/**
 * 左ペインでデフォルトのエージェントをまとめるかどうかの設定を持つ。
 *
 * テーマ・通知音と同じく、選んだ設定は localStorage に残して次の読み込みへ引き継ぐ。
 */
export const useGroupDefaultAgents = (): UseGroupDefaultAgentsResult => {
  const grouped = useSyncExternalStore(
    subscribe,
    currentGrouped,
    serverGrouped
  );

  const setGrouped = useCallback((next: boolean) => {
    unsavedGrouped = storeGroupDefaultAgents(next) ? null : next;
    notify();
  }, []);

  return { grouped, setGrouped };
};
