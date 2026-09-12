'use client';

import { useCallback, useState } from 'react';
import { fetchJson } from '@/lib/api/fetchJson';
import { NO_SUBJECT, type Message } from '@/types/mail';

/** 作成ウィンドウの入力内容 */
export interface ComposeDraft {
  /** 下書きとして保存済みの場合の ID */
  readonly draftId?: string;
  readonly to: readonly string[];
  readonly subject: string;
  readonly body: string;
  /** 返信の場合のスレッド ID */
  readonly threadId?: string;
  readonly inReplyTo?: string;
  /** 件名・宛先を固定するか（返信時は固定） */
  readonly locked: boolean;
}

const EMPTY_DRAFT: ComposeDraft = {
  to: [],
  subject: '',
  body: '',
  locked: false,
};

export interface UseComposeResult {
  readonly draft: ComposeDraft | null;
  readonly saving: boolean;
  readonly openNew: (to?: readonly string[]) => void;
  readonly openReply: (message: Message) => void;
  readonly openDraft: (message: Message) => void;
  readonly close: () => void;
  /** 送信に失敗したときに、入力内容を保ったまま作成ウィンドウへ戻す */
  readonly restore: (draft: ComposeDraft) => void;
  readonly update: (patch: Partial<ComposeDraft>) => void;
  readonly toggleRecipient: (address: string) => void;
  /** 下書きとして保存し、作成ウィンドウを閉じる */
  readonly saveDraft: () => Promise<void>;
}

/** 作成ウィンドウの開閉と入力状態を扱う */
export const useCompose = (onDraftSaved: () => void): UseComposeResult => {
  const [draft, setDraft] = useState<ComposeDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const openNew = useCallback((to: readonly string[] = []) => {
    setDraft({ ...EMPTY_DRAFT, to });
  }, []);

  const openReply = useCallback((message: Message) => {
    setDraft({
      to: [message.from],
      subject: message.subject,
      body: '',
      threadId: message.threadId,
      inReplyTo: message.id,
      locked: true,
    });
  }, []);

  const openDraft = useCallback((message: Message) => {
    setDraft({
      draftId: message.id,
      to: message.to,
      subject: message.subject === NO_SUBJECT ? '' : message.subject,
      body: message.body,
      locked: false,
    });
  }, []);

  const close = useCallback(() => setDraft(null), []);

  const restore = useCallback((restored: ComposeDraft) => {
    setDraft(restored);
  }, []);

  const update = useCallback((patch: Partial<ComposeDraft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const toggleRecipient = useCallback((address: string) => {
    setDraft((current) => {
      if (!current || current.locked) {
        return current;
      }
      const selected = current.to.includes(address);
      return {
        ...current,
        to: selected
          ? current.to.filter((item) => item !== address)
          : [...current.to, address],
      };
    });
  }, []);

  const saveDraft = useCallback(async () => {
    if (!draft) {
      return;
    }
    setSaving(true);
    try {
      await fetchJson('/api/messages/drafts', {
        method: 'POST',
        body: JSON.stringify({
          id: draft.draftId,
          to: draft.to,
          subject: draft.subject,
          body: draft.body,
          threadId: draft.threadId,
        }),
      });
      // 保存した内容は下書きフォルダから開き直せるため、ウィンドウは閉じる
      setDraft(null);
      onDraftSaved();
    } finally {
      setSaving(false);
    }
  }, [draft, onDraftSaved]);

  return {
    draft,
    saving,
    openNew,
    openReply,
    openDraft,
    close,
    restore,
    update,
    toggleRecipient,
    saveDraft,
  };
};
