'use client';

import {
  THEME_LABELS,
  THEME_PREFERENCES,
  type ThemePreference,
} from '@/lib/theme';
import type { IconName } from '../Icon';
import { SegmentedControl, type SegmentedOption } from '../SegmentedControl';

const ICONS: Readonly<Record<ThemePreference, IconName>> = {
  system: 'desktop',
  light: 'sun',
  dark: 'moon',
};

const OPTIONS: readonly SegmentedOption<ThemePreference>[] =
  THEME_PREFERENCES.map((theme) => ({
    value: theme,
    label: THEME_LABELS[theme],
    icon: ICONS[theme],
  }));

interface ThemeToggleProps {
  readonly theme: ThemePreference;
  readonly onSelect: (theme: ThemePreference) => void;
}

/** 画面の配色を選ぶ */
export const ThemeToggle = ({ theme, onSelect }: ThemeToggleProps) => (
  <SegmentedControl
    label="表示テーマ"
    options={OPTIONS}
    selected={theme}
    onSelect={onSelect}
  />
);
