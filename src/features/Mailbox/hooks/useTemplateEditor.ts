'use client';

import { useCallback, useState } from 'react';
import { fetchJson } from '@/lib/api/fetchJson';
import type { Template } from '@/types/mail';

/** テンプレート編集フォームの入力内容 */
export interface TemplateForm {
  /** 編集中のテンプレートの ID（新規追加のときは null） */
  readonly editing: string | null;
  readonly name: string;
  readonly description: string;
  readonly body: string;
}

const EMPTY_FORM: TemplateForm = {
  editing: null,
  name: '',
  description: '',
  body: '',
};

export interface UseTemplateEditorResult {
  readonly form: TemplateForm | null;
  readonly saving: boolean;
  readonly deleting: boolean;
  readonly error: string | null;
  readonly openNew: () => void;
  readonly openEdit: (template: Template) => void;
  readonly close: () => void;
  readonly update: (patch: Partial<TemplateForm>) => void;
  /** 保存できたら追加・変更後のテンプレートを返す */
  readonly save: () => Promise<Template | null>;
  /** 削除できたら true */
  readonly remove: (templateId: string) => Promise<boolean>;
}

/**
 * テンプレートの追加・変更・削除を扱う。
 *
 * 本文はそのままエージェントへの指示になるため、
 * 空かどうかの判定以外で加工せずに送る。
 */
export const useTemplateEditor = (
  onChanged: () => void
): UseTemplateEditorResult => {
  const [form, setForm] = useState<TemplateForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openNew = useCallback(() => {
    setError(null);
    setForm(EMPTY_FORM);
  }, []);

  const openEdit = useCallback((template: Template) => {
    setError(null);
    setForm({
      editing: template.id,
      name: template.name,
      description: template.description ?? '',
      body: template.body,
    });
  }, []);

  const close = useCallback(() => {
    setForm(null);
    setError(null);
  }, []);

  const update = useCallback((patch: Partial<TemplateForm>) => {
    setForm((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const save = useCallback(async (): Promise<Template | null> => {
    if (!form) {
      return null;
    }

    setSaving(true);
    setError(null);
    try {
      const data = await fetchJson<{ readonly template: Template }>(
        form.editing === null
          ? '/api/templates'
          : `/api/templates/${encodeURIComponent(form.editing)}`,
        {
          method: form.editing === null ? 'POST' : 'PUT',
          body: JSON.stringify({
            name: form.name.trim(),
            description: form.description.trim() || undefined,
            body: form.body,
          }),
        }
      );
      setForm(null);
      onChanged();
      return data.template;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return null;
    } finally {
      setSaving(false);
    }
  }, [form, onChanged]);

  const remove = useCallback(
    async (templateId: string): Promise<boolean> => {
      setDeleting(true);
      setError(null);
      try {
        await fetchJson(`/api/templates/${encodeURIComponent(templateId)}`, {
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
