'use client';

import { SegmentedControl, type SegmentedOption } from '../SegmentedControl';

const OPTIONS: readonly SegmentedOption<boolean>[] = [
  { value: false, label: '宛先ごと', icon: 'inbox' },
  { value: true, label: 'まとめる', icon: 'folder' },
];

interface GroupDefaultAgentsToggleProps {
  readonly grouped: boolean;
  readonly onSelect: (grouped: boolean) => void;
}

/** 左ペインでデフォルトのエージェントのメールボックスをまとめるかを切り替える */
export const GroupDefaultAgentsToggle = ({
  grouped,
  onSelect,
}: GroupDefaultAgentsToggleProps) => (
  <SegmentedControl
    label="デフォルトのエージェントのメールボックス"
    options={OPTIONS}
    selected={grouped}
    onSelect={onSelect}
  />
);
