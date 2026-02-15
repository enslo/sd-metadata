import { useStore } from '@nanostores/preact';
import { Plus, Trash2 } from 'lucide-preact';
import { useState } from 'preact/hooks';
import { $t } from '../../i18n';
import styles from './EmbedEditor.module.css';

interface ExtrasEditorProps {
  extras: Record<string, string | number>;
  onChange: (extras: Record<string, string | number>) => void;
}

interface ExtraEntry {
  id: number;
  key: string;
  value: string;
}

let nextId = 0;

/**
 * Dynamic key-value pair editor for embed() extras parameter
 */
export function ExtrasEditor({ extras, onChange }: ExtrasEditorProps) {
  const t = useStore($t);

  // Internal entries for rendering (preserves order and empty rows)
  const [entries, setEntries] = useState<ExtraEntry[]>(() =>
    Object.entries(extras).map(([key, value]) => ({
      id: nextId++,
      key,
      value: String(value),
    })),
  );

  const syncExtras = (updated: ExtraEntry[]) => {
    const result: Record<string, string | number> = {};
    for (const entry of updated) {
      if (entry.key.trim()) {
        const numVal = Number(entry.value);
        result[entry.key.trim()] =
          entry.value !== '' && !Number.isNaN(numVal) ? numVal : entry.value;
      }
    }
    onChange(result);
  };

  const handleAdd = () => {
    const updated = [...entries, { id: nextId++, key: '', value: '' }];
    setEntries(updated);
  };

  const handleRemove = (id: number) => {
    const updated = entries.filter((e) => e.id !== id);
    setEntries(updated);
    syncExtras(updated);
  };

  const handleKeyChange = (id: number, key: string) => {
    const updated = entries.map((e) => (e.id === id ? { ...e, key } : e));
    setEntries(updated);
    syncExtras(updated);
  };

  const handleValueChange = (id: number, value: string) => {
    const updated = entries.map((e) => (e.id === id ? { ...e, value } : e));
    setEntries(updated);
    syncExtras(updated);
  };

  return (
    <div class={styles.formGroup}>
      <span class={styles.label}>{t.embedEditor.extras}</span>
      <p
        style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-muted)',
          margin: '0 0 0.5rem',
        }}
      >
        {t.embedEditor.extrasDescription}
      </p>

      {entries.map((entry) => (
        <div class={styles.extrasRow} key={entry.id}>
          <input
            class={`${styles.input} ${styles.extrasKey}`}
            type="text"
            placeholder={t.embedEditor.key}
            value={entry.key}
            aria-label={t.embedEditor.key}
            onInput={(e) =>
              handleKeyChange(
                entry.id,
                (e.currentTarget as HTMLInputElement).value,
              )
            }
          />
          <input
            class={`${styles.input} ${styles.extrasValue}`}
            type="text"
            placeholder={t.embedEditor.value}
            value={entry.value}
            aria-label={t.embedEditor.value}
            onInput={(e) =>
              handleValueChange(
                entry.id,
                (e.currentTarget as HTMLInputElement).value,
              )
            }
          />
          <button
            type="button"
            class={styles.removeButton}
            onClick={() => handleRemove(entry.id)}
            aria-label={t.embedEditor.remove}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      <button type="button" class={styles.addButton} onClick={handleAdd}>
        <Plus size={14} />
        {t.embedEditor.addExtra}
      </button>
    </div>
  );
}
