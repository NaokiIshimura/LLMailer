'use client';

import { useCallback, useState } from 'react';
import { fetchJson } from '@/lib/api/fetchJson';
import {
  toAgentAccess,
  toAgentPermission,
  type Agent,
  type AgentAccess,
} from '@/types/mail';

/** エージェント編集フォームの入力内容 */
export interface AgentForm {
  /** 編集中のエージェントのアドレス（新規追加のときは null） */
  readonly editing: string | null;
  readonly address: string;
  readonly name: string;
  readonly model: string;
  readonly description: string;
  readonly systemPrompt: string;
  readonly workingDirectory: string;
  readonly access: AgentAccess;
  /** タイムアウト（秒）。空なら既定に任せる */
  readonly timeoutSeconds: string;
}

const EMPTY_FORM: AgentForm = {
  editing: null,
  address: '',
  name: '',
  model: 'opus',
  description: '',
  systemPrompt: '',
  workingDirectory: '.',
  access: 'readOnly',
  timeoutSeconds: '',
};

export interface UseAgentEditorResult {
  readonly form: AgentForm | null;
  readonly saving: boolean;
  readonly deleting: boolean;
  readonly error: string | null;
  readonly openNew: () => void;
  readonly openEdit: (agent: Agent) => void;
  readonly close: () => void;
  readonly update: (patch: Partial<AgentForm>) => void;
  /** 保存できたら追加・変更後のエージェントを返す */
  readonly save: () => Promise<Agent | null>;
  /** 削除できたら true */
  readonly remove: (address: string) => Promise<boolean>;
}

const toRequestBody = (form: AgentForm) => {
  const timeoutSeconds = Number(form.timeoutSeconds);
  return {
    name: form.name.trim(),
    model: form.model.trim(),
    description: form.description.trim() || undefined,
    systemPrompt: form.systemPrompt.trim() || undefined,
    workingDirectory: form.workingDirectory.trim() || undefined,
    ...toAgentPermission(form.access),
    timeoutMs:
      form.timeoutSeconds.trim() !== '' && timeoutSeconds > 0
        ? timeoutSeconds * 1000
        : undefined,
  };
};

/**
 * エージェントの追加・変更・削除を扱う。
 *
 * 権限は「フル権限 / 読み取り専用」のプリセットから組み立てる。
 * ツールの許可・拒否を個別に触らせると、読み取り専用のつもりで
 * 書き込めるエージェントを作ってしまうため。
 */
export const useAgentEditor = (onChanged: () => void): UseAgentEditorResult => {
  const [form, setForm] = useState<AgentForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openNew = useCallback(() => {
    setError(null);
    setForm(EMPTY_FORM);
  }, []);

  const openEdit = useCallback((agent: Agent) => {
    setError(null);
    setForm({
      editing: agent.address,
      address: agent.address,
      name: agent.name,
      model: agent.model,
      description: agent.description ?? '',
      systemPrompt: agent.systemPrompt ?? '',
      workingDirectory: agent.workingDirectory ?? '.',
      access: toAgentAccess(agent),
      timeoutSeconds:
        agent.timeoutMs === undefined
          ? ''
          : String(Math.round(agent.timeoutMs / 1000)),
    });
  }, []);

  const close = useCallback(() => {
    setForm(null);
    setError(null);
  }, []);

  const update = useCallback((patch: Partial<AgentForm>) => {
    setForm((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const save = useCallback(async (): Promise<Agent | null> => {
    if (!form) {
      return null;
    }

    setSaving(true);
    setError(null);
    try {
      const body = toRequestBody(form);
      const data = await fetchJson<{ readonly agent: Agent }>(
        form.editing === null
          ? '/api/agents'
          : `/api/agents/${encodeURIComponent(form.editing)}`,
        {
          method: form.editing === null ? 'POST' : 'PUT',
          body: JSON.stringify(
            form.editing === null
              ? { ...body, address: form.address.trim() }
              : body
          ),
        }
      );
      setForm(null);
      onChanged();
      return data.agent;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return null;
    } finally {
      setSaving(false);
    }
  }, [form, onChanged]);

  const remove = useCallback(
    async (address: string): Promise<boolean> => {
      setDeleting(true);
      setError(null);
      try {
        await fetchJson(`/api/agents/${encodeURIComponent(address)}`, {
          method: 'DELETE',
        });
        setForm(null);
        onChanged();
        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        return false;
      } finally {
        setDeleting(false);
      }
    },
    [onChanged]
  );

  return {
    form,
    saving,
    deleting,
    error,
    openNew,
    openEdit,
    close,
    update,
    save,
    remove,
  };
};
