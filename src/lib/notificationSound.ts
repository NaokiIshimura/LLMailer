/**
 * 返信が届いたときに鳴らす通知音。
 *
 * 音声ファイルは持たず、Web Audio API でベルの 2 音を合成する。
 * 数十 KB のバイナリを足さずに済み、音の高さや長さもここだけで調整できる。
 */

/**
 * 通知音を鳴らすかどうかの保存先。
 *
 * サーバーに置く必要のない、ブラウザごとの設定なので localStorage に持つ。
 */
export const NOTIFICATION_SOUND_STORAGE_KEY = 'llmailer.notificationSound';

/** 返信に気付けないと待ち続けてしまうため、既定では鳴らす */
export const DEFAULT_NOTIFICATION_SOUND_ENABLED = true;

/** 保存された設定を読む。未設定や壊れた値のときは既定に戻す */
export const readStoredNotificationSound = (): boolean => {
  try {
    const stored = window.localStorage.getItem(NOTIFICATION_SOUND_STORAGE_KEY);
    if (stored === 'on') {
      return true;
    }
    if (stored === 'off') {
      return false;
    }
    return DEFAULT_NOTIFICATION_SOUND_ENABLED;
  } catch {
    return DEFAULT_NOTIFICATION_SOUND_ENABLED;
  }
};

/** 次回の読み込みにも引き継げるよう設定を残す。保存できたかを返す */
export const storeNotificationSound = (enabled: boolean): boolean => {
  try {
    window.localStorage.setItem(
      NOTIFICATION_SOUND_STORAGE_KEY,
      enabled ? 'on' : 'off'
    );
    return true;
  } catch {
    return false;
  }
};

/** 鳴らす音（Hz と、鳴り始めるまでの待ち時間） */
interface Chime {
  /** 基音の高さ（Hz） */
  readonly frequency: number;
  /** 先頭からの遅れ（秒） */
  readonly delay: number;
}

/**
 * メールの着信音らしく、4 度上がる 2 音にする。
 * A5 → D6 の並びは携帯のメール着信音でよく使われ、短くても気付きやすい。
 */
const CHIMES: readonly Chime[] = [
  { frequency: 880, delay: 0 },
  { frequency: 1174.66, delay: 0.13 },
];

/** 1 音が消えるまでの長さ（秒）。作業の完了を知らせるだけなので短くする */
const TONE_DURATION = 0.55;

/** 通知音の音量。作業中の邪魔にならないよう控えめにする */
const TONE_GAIN = 0.18;

/**
 * 倍音（基音の 2 倍）の音量比。
 * 基音だけだと電子音に寄るため、少し重ねて鐘らしい響きにする。
 */
const OVERTONE_GAIN_RATIO = 0.35;

/** 鳴り始めの時間（秒）。0 から立ち上げてプツッというノイズを防ぐ */
const ATTACK = 0.005;

/**
 * AudioContext は使い回す。
 * 1 回の通知ごとに作ると、ブラウザが許す同時数に達して鳴らなくなる。
 */
let sharedContext: AudioContext | null = null;

const audioContext = (): AudioContext | null => {
  if (sharedContext) {
    return sharedContext;
  }

  const Constructor =
    window.AudioContext ??
    (window as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Constructor) {
    return null;
  }

  sharedContext = new Constructor();
  return sharedContext;
};

/** 1 音を鳴らす（減衰する鐘のような音） */
const playTone = (
  context: AudioContext,
  startAt: number,
  frequency: number,
  gain: number
): void => {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;

  // 叩いた鐘のように、立ち上がりは速く、そこから減衰させる
  envelope.gain.setValueAtTime(0, startAt);
  envelope.gain.linearRampToValueAtTime(gain, startAt + ATTACK);
  // 指数で減衰させると自然に聞こえる。0 は指定できないため十分小さい値へ落とす
  envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + TONE_DURATION);

  oscillator.connect(envelope);
  envelope.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + TONE_DURATION);
};

/**
 * 通知音を鳴らす。
 *
 * ブラウザは利用者の操作より前の再生を止めるため、
 * 止まっている AudioContext は再開を試みてから鳴らす。
 * 鳴らせなくても画面の動作には関わらないので、例外は外に出さない。
 */
export const playNotificationSound = (): void => {
  try {
    const context = audioContext();
    if (!context) {
      return;
    }

    if (context.state === 'suspended') {
      void context.resume();
    }

    const startAt = context.currentTime;
    for (const chime of CHIMES) {
      playTone(context, startAt + chime.delay, chime.frequency, TONE_GAIN);
      playTone(
        context,
        startAt + chime.delay,
        chime.frequency * 2,
        TONE_GAIN * OVERTONE_GAIN_RATIO
      );
    }
  } catch (cause) {
    console.error('[llmailer] 通知音を鳴らせませんでした', cause);
  }
};
