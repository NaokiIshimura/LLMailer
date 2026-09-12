'use client';

import { useEffect, useRef } from 'react';

/**
 * 返信が届いたときに通知音を鳴らす。
 *
 * 受信件数が増えたことを「返信が届いた」と見なす。
 * 配信はサーバー側で続き、画面は対応中のあいだ取得を繰り返すため、
 * 作業が完了して返信が保存された次の取得でここが気付ける。
 *
 * receivedCount が null のあいだ（まだ取得できていない、取得に失敗した）は
 * 基準が無いので鳴らさない。読み込んだだけで鳴ってしまうのを防ぐ。
 */
export const useReplyChime = (
  receivedCount: number | null,
  play: () => void
): void => {
  /** 直前に確かめた受信件数。まだ確かめていなければ null */
  const knownCountRef = useRef<number | null>(null);

  useEffect(() => {
    if (receivedCount === null) {
      return;
    }

    const known = knownCountRef.current;
    knownCountRef.current = receivedCount;

    // 初回は基準を作るだけ。削除で減ったときも鳴らさない
    if (known === null || receivedCount <= known) {
      return;
    }

    play();
  }, [receivedCount, play]);
};
