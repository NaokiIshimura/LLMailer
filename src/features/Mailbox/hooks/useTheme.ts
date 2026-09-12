'use client';

import { useEffect } from 'react';
import {
  applyTheme,
  cacheTheme,
  DARK_MEDIA_QUERY,
  systemTheme,
  type ResolvedTheme,
} from '@/lib/theme';

/**
 * Next.js DevTools（画面左下のインジケーター）のホスト要素。
 * Preferences > Theme の選択は、この要素の class として現れる。
 */
const DEVTOOLS_HOST_SELECTOR = 'nextjs-portal';

/** DevTools の選択を読む。class が付いていないときは 'System'（OS の設定）*/
const readDevToolsTheme = (host: Element | null): ResolvedTheme => {
  if (host?.classList.contains('dark')) {
    return 'dark';
  }
  if (host?.classList.contains('light')) {
    return 'light';
  }
  return systemTheme();
};

/**
 * DevTools の Preferences > Theme をアプリ全体へ反映する。
 *
 * DevTools は自分のパネル（shadow DOM）にしかテーマを当てないため、
 * ホスト要素の class を監視して html 要素へ写す。
 * DevTools が無い本番ビルドでは OS の設定に従う。
 */
export const useTheme = (): void => {
  useEffect(() => {
    const media = window.matchMedia(DARK_MEDIA_QUERY);
    let observedHost: Element | null = null;
    let hostObserver: MutationObserver | null = null;

    const sync = () => {
      const resolved = readDevToolsTheme(observedHost);
      applyTheme(resolved);
      cacheTheme(resolved);
    };

    /** DevTools は読み込み後に差し込まれるので、現れてから class を監視する */
    const watchHost = () => {
      const host = document.querySelector(DEVTOOLS_HOST_SELECTOR);
      if (host === observedHost) {
        return;
      }
      hostObserver?.disconnect();
      observedHost = host;
      if (host) {
        hostObserver = new MutationObserver(sync);
        hostObserver.observe(host, { attributeFilter: ['class'] });
      }
      sync();
    };

    const bodyObserver = new MutationObserver(watchHost);
    bodyObserver.observe(document.body, { childList: true });
    media.addEventListener('change', sync);
    watchHost();

    return () => {
      bodyObserver.disconnect();
      hostObserver?.disconnect();
      media.removeEventListener('change', sync);
    };
  }, []);
};
