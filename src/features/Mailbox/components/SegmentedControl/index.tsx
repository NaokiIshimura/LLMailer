import { Icon, type IconName } from '../Icon';
import styles from './SegmentedControl.module.css';

export interface SegmentedOption<T> {
  readonly value: T;
  readonly label: string;
  readonly icon: IconName;
}

interface SegmentedControlProps<T> {
  /** 何を選ぶ並びなのかを読み上げに伝える */
  readonly label: string;
  readonly options: readonly SegmentedOption<T>[];
  readonly selected: T;
  readonly onSelect: (value: T) => void;
}

/**
 * 横並びの選択肢から 1 つ選ばせる。
 *
 * 設定タブの切り替えはどれも同じ見た目にしたいので、
 * 並びと配色はここに持たせ、選択肢だけを呼び出し側から渡す。
 */
export const SegmentedControl = <T,>({
  label,
  options,
  selected,
  onSelect,
}: SegmentedControlProps<T>) => (
  <div className={styles.group} role="group" aria-label={label}>
    {options.map((option) => (
      <button
        key={String(option.value)}
        type="button"
        className={`${styles.item} ${option.value === selected ? styles.active : ''}`}
        onClick={() => onSelect(option.value)}
        aria-pressed={option.value === selected}
      >
        <Icon name={option.icon} size={15} />
        {option.label}
      </button>
    ))}
  </div>
);
