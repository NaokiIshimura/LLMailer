'use client';

import { useCallback, useState } from 'react';
import type { FileContent } from '@/lib/files/types';
import { useJsonResource } from './useJsonResource';

/** ビューアで開いているファイル */
interface ViewerTarget {
  /** 本文に書かれていたパス */
  readonly path: string;
  /** 相対パスの基準にするエージェント（作業ディレクトリを引くのに使う） */
  readonly agentId?: string;
}

export interface UseFileViewerResult {
  /** 開いているパス（閉じているときは null） */
  readonly target: string | null;
  readonly file: FileContent | null;
  readonly loading: boolean;
  readonly error: string | null;
  /** 本文のリンクから開く */
  readonly open: (filePath: string, agentId?: string) => void;
  /** 開いたあとに書き換わることがあるため、読み直せるようにする */
  readonly reload: () => void;
  readonly close: () => void;
}

const toUrl = (target: ViewerTarget | null): string | null => {
  if (target === null) {
    return null;
  }
  const params = new URLSearchParams({ path: target.path });
  if (target.agentId) {
    params.set('agentId', target.agentId);
  }
  return `/api/files?${params.toString()}`;
};

/**
 * 本文に書かれたファイルの中身を読む。
 *
 * 開いているファイルだけを state に持ち、取得は URL 経由のフックに任せる。
 */
export const useFileViewer = (): UseFileViewerResult => {
  const [target, setTarget] = useState<ViewerTarget | null>(null);
  const { data, loading, error, reload } = useJsonResource<{
    readonly file: FileContent;
  }>(toUrl(target));

  const open = useCallback((filePath: string, agentId?: string) => {
    setTarget({ path: filePath, agentId });
  }, []);

  const close = useCallback(() => {
    setTarget(null);
  }, []);

  return {
    target: target?.path ?? null,
    file: data?.file ?? null,
    loading,
    error,
    open,
    reload,
    close,
  };
};
