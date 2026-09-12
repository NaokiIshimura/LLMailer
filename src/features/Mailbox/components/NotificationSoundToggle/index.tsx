'use client';

import { SegmentedControl, type SegmentedOption } from '../SegmentedControl';
import styles from './NotificationSoundToggle.module.css';

const OPTIONS: readonly SegmentedOption<boolean>[] = [
  { value: true, label: 'オン', icon: 'bell' },
  { value: false, label: 'オフ', icon: 'bellOff' },
];

interface NotificationSoundToggleProps {
  readonly enabled: boolean;
  readonly onSelect: (enabled: boolean) => void;
  /** 設定に関わらず 1 回鳴らす（どんな音かを確かめるため） */
  readonly onPreview: () => void;
}

/** 返信が届いたときの通知音を切り替える */
export const NotificationSoundToggle = ({
  enabled,
  onSelect,
  onPreview,
}: NotificationSoundToggleProps) => (
  <div className={styles.controls}>
    <SegmentedControl
      label="返信の通知音"
      options={OPTIONS}
      selected={enabled}
      onSelect={onSelect}
    />

    {/* オフのままでも音を確かめられるようにする（切り替えの判断に使う） */}
    <button type="button" className={styles.preview} onClick={onPreview}>
      試聴
    </button>
  </div>
);
