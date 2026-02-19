import {
  ActionIcon,
  Button,
  Group,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useStore } from '@nanostores/preact';
import { Plus, Trash2 } from 'lucide-preact';
import { useState } from 'preact/hooks';
import { $t } from '../../i18n';

type TextChangeEvent = { currentTarget: { value: string } };

interface ExtrasEditorProps {
  extras: Record<string, string | number>;
  onChange: (extras: Record<string, string | number>) => void;
}

interface ExtraEntry {
  id: string;
  key: string;
  value: string;
}

/**
 * @package
 * Dynamic key-value pair editor for embed() extras parameter
 */
export function ExtrasEditor({ extras, onChange }: ExtrasEditorProps) {
  const t = useStore($t);

  // Internal entries for rendering (preserves order and empty rows)
  const [entries, setEntries] = useState<ExtraEntry[]>(() =>
    Object.entries(extras).map(([key, value]) => ({
      id: crypto.randomUUID(),
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
    const updated = [
      ...entries,
      { id: crypto.randomUUID(), key: '', value: '' },
    ];
    setEntries(updated);
  };

  const handleRemove = (id: string) => {
    const updated = entries.filter((e) => e.id !== id);
    setEntries(updated);
    syncExtras(updated);
  };

  const handleKeyChange = (id: string, key: string) => {
    const updated = entries.map((e) => (e.id === id ? { ...e, key } : e));
    setEntries(updated);
    syncExtras(updated);
  };

  const handleValueChange = (id: string, value: string) => {
    const updated = entries.map((e) => (e.id === id ? { ...e, value } : e));
    setEntries(updated);
    syncExtras(updated);
  };

  return (
    <Stack gap="xs">
      <div>
        <Text size="sm" fw={500}>
          {t.embedEditor.extras}
        </Text>
        <Text size="xs" c="dimmed">
          {t.embedEditor.extrasDescription}
        </Text>
      </div>

      {entries.map((entry) => (
        <Group key={entry.id} gap="xs" wrap="nowrap">
          <TextInput
            placeholder={t.embedEditor.key}
            value={entry.key}
            aria-label={t.embedEditor.key}
            onChange={(e: TextChangeEvent) =>
              handleKeyChange(entry.id, e.currentTarget.value)
            }
            style={{ flex: 2 }}
          />
          <TextInput
            placeholder={t.embedEditor.value}
            value={entry.value}
            aria-label={t.embedEditor.value}
            onChange={(e: TextChangeEvent) =>
              handleValueChange(entry.id, e.currentTarget.value)
            }
            style={{ flex: 3 }}
          />
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={() => handleRemove(entry.id)}
            aria-label={t.embedEditor.remove}
          >
            <Trash2 size={14} />
          </ActionIcon>
        </Group>
      ))}

      <Button
        variant="default"
        size="xs"
        leftSection={<Plus size={14} />}
        onClick={handleAdd}
        style={{ alignSelf: 'flex-start' }}
      >
        {t.embedEditor.addExtra}
      </Button>
    </Stack>
  );
}
