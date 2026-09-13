'use client';

import type { ListedTemplate } from '@/types/mail';
import { useJsonResource } from './useJsonResource';

interface TemplatesResponse {
  readonly templates: readonly ListedTemplate[];
}

export interface UseTemplatesResult {
  readonly templates: readonly ListedTemplate[];
  readonly loading: boolean;
  readonly error: string | null;
  /** 追加・変更・削除のあとに取り直す */
  readonly reload: () => void;
}

/** 本文へ差し込める定型文の一覧を取得する */
export const useTemplates = (): UseTemplatesResult => {
  const resource = useJsonResource<TemplatesResponse>('/api/templates');

  return {
    templates: resource.data?.templates ?? [],
    loading: resource.loading,
    error: resource.error,
    reload: resource.reload,
  };
};
