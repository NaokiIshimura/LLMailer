'use client';

import { useEffect, useRef, useState } from 'react';
import type { ListedTemplate } from '@/types/mail';
import { Icon } from '../Icon';
import styles from './TemplatePicker.module.css';

interface TemplatePickerProps {
  readonly templates: readonly ListedTemplate[];
  readonly onSelect: (template: ListedTemplate) => void;
}

/** 本文へ定型文を差し込むためのボタンと、その一覧 */
export const TemplatePicker = ({
  templates,
  onSelect,
}: TemplatePickerProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 開いているあいだだけ、外側のクリックと Esc で閉じられるようにする
  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  /** デフォルトと利用者ぶんの境目に区切り線を入れるための位置 */
  const firstCustomIndex = templates.findIndex(
    (template) => !template.isDefault
  );

  return (
    <div className={styles.picker} ref={containerRef}>
      <button
        type="button"
        className={styles.button}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Icon name="template" size={14} />
        テンプレート
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          {templates.length === 0 ? (
            <p className={styles.empty}>
              テンプレートはまだありません（設定から追加できます）
            </p>
          ) : (
            templates.map((template, index) => (
              <button
                key={template.id}
                type="button"
                role="menuitem"
                className={`${styles.item} ${
                  index === firstCustomIndex && index > 0 ? styles.divided : ''
                }`}
                onClick={() => {
                  onSelect(template);
                  setOpen(false);
                }}
              >
                <span className={styles.name}>{template.name}</span>
                {template.description && (
                  <span className={styles.description}>
                    {template.description}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};
