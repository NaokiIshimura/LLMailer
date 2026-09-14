/**
 * 配信中の Claude Code を、あとから止められるようにしておくための置き場。
 *
 * 対応中メッセージの ID から、その配信を止める合図を引ける。
 * next dev では Route Handler ごとにモジュールが別々に読み込まれることがあるため、
 * 1 プロセスで 1 つの Map を使えるよう globalThis に持つ。
 */
const globalStore = globalThis as typeof globalThis & {
  llmailerDeliveries?: Map<string, AbortController>;
};

const deliveries = (globalStore.llmailerDeliveries ??= new Map());

/** 配信の開始を記録し、中断の合図を返す */
export const registerDelivery = (messageId: string): AbortController => {
  const controller = new AbortController();
  deliveries.set(messageId, controller);
  return controller;
};

/** 配信の終了を記録する（成功・失敗・中断のいずれでも呼ぶ） */
export const finishDelivery = (messageId: string): void => {
  deliveries.delete(messageId);
};

/**
 * 配信中なら止める。
 *
 * このプロセスで配信していなければ false。
 * 前のプロセスが残した対応中は読み出し時に配信失敗へ倒れるため、ここでは扱わない。
 */
export const abortDelivery = (messageId: string): boolean => {
  const controller = deliveries.get(messageId);
  if (!controller) {
    return false;
  }
  controller.abort();
  return true;
};
