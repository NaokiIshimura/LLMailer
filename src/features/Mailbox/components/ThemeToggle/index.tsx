'use client';

import {
  THEME_LABELS,
  THEME_PREFERENCES,
  type ThemePreference,
} from '@/lib/theme';
import { Icon, type IconName } from '../Icon';
import styles from './ThemeToggle.module.css';

const ICONS: Readonly<Record<ThemePreference, IconName>> = {
  system: 'desktop',
  light: 'sun',
  dark: 'moon',
};

interface ThemeToggleProps {
  readonly theme: ThemePreference;
  readonly onSelect: (theme: ThemePreference) => void;
}

/** 画面の配色を選ぶ */
export const ThemeToggle = ({ theme, onSelect }: ThemeToggleProps) => (
  <div className={styles.group} role="group" aria-label="表示テーマ">
    {THEME_PREFERENCES.map((item) => (
      <button
        key={item}
        type="button"
        className={`${styles.item} ${theme === item ? styles.active : ''}`}
        onClick={() => onSelect(item)}
        aria-pressed={theme === item}
      >
        <Icon name={ICONS[item]} size={15} />
        {THEME_LABELS[item]}
      </button>
    ))}
  </div>
);
