import styles from './Loader.module.css';

export const Spinner = () => (
  <span className={styles.spinner} role="status" aria-label="読み込み中" />
);

interface GlobalLoaderProps {
  /** 進行中の件数。0 のときは何も表示しない */
  readonly count: number;
  readonly label?: string;
}

/** 画面右下に進行中の配信を表示する */
export const GlobalLoader = ({ count, label = '対応中' }: GlobalLoaderProps) => {
  if (count <= 0) {
    return null;
  }

  return (
    <div className={styles.global}>
      <Spinner />
      <span>
        {label}
        {count > 1 ? `（${count} 件）` : ''}…
      </span>
    </div>
  );
};
