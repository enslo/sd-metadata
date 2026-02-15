import type { EmbedMetadata } from '@enslo/sd-metadata';
import {
  Accordion,
  Group,
  NumberInput,
  Stack,
  TextInput,
  Textarea,
} from '@mantine/core';
import { useStore } from '@nanostores/preact';
import { useRef } from 'preact/hooks';
import { $t } from '../../i18n';

interface MetadataFormProps {
  metadata: EmbedMetadata;
  onChange: (metadata: EmbedMetadata) => void;
}

/** Convert NumberInput value to number | undefined */
function toNum(val: string | number): number | undefined {
  return typeof val === 'number' ? val : undefined;
}

/** Get input value from a change event */
function val(e: { currentTarget: { value: string } }): string {
  return e.currentTarget.value;
}

/**
 * Compute which accordion sections should be open by default
 */
function computeDefaultSections(metadata: EmbedMetadata): string[] {
  const values: string[] = [];
  if (metadata.model?.name || metadata.model?.hash) values.push('model');
  if (
    metadata.sampling?.sampler ||
    metadata.sampling?.steps ||
    metadata.sampling?.cfg ||
    metadata.sampling?.seed
  )
    values.push('sampling');
  if (
    metadata.hires?.upscaler ||
    metadata.hires?.scale ||
    metadata.hires?.steps
  )
    values.push('hires');
  return values;
}

/**
 * Form fields for editing BaseMetadata + characterPrompts
 */
export function MetadataForm({ metadata, onChange }: MetadataFormProps) {
  const t = useStore($t);

  // Capture initial accordion state (only on first render)
  const defaultSections = useRef(computeDefaultSections(metadata));

  return (
    <Stack gap="sm">
      {/* Prompt */}
      <Textarea
        label={t.embedEditor.prompt}
        value={metadata.prompt}
        onChange={(e: { currentTarget: { value: string } }) =>
          onChange({ ...metadata, prompt: val(e) })
        }
        rows={3}
        autosize
        styles={{
          input: { fontFamily: 'var(--mantine-font-family-monospace)' },
        }}
      />

      {/* Negative Prompt */}
      <Textarea
        label={t.embedEditor.negativePrompt}
        value={metadata.negativePrompt}
        onChange={(e: { currentTarget: { value: string } }) =>
          onChange({ ...metadata, negativePrompt: val(e) })
        }
        rows={2}
        autosize
        styles={{
          input: { fontFamily: 'var(--mantine-font-family-monospace)' },
        }}
      />

      {/* Width / Height */}
      <Group grow>
        <NumberInput
          label={t.embedEditor.width}
          min={0}
          step={1}
          value={metadata.width}
          onChange={(v: string | number) =>
            onChange({ ...metadata, width: toNum(v) ?? 0 })
          }
        />
        <NumberInput
          label={t.embedEditor.height}
          min={0}
          step={1}
          value={metadata.height}
          onChange={(v: string | number) =>
            onChange({ ...metadata, height: toNum(v) ?? 0 })
          }
        />
      </Group>

      {/* Collapsible sections */}
      <Accordion
        multiple
        defaultValue={defaultSections.current}
        variant="separated"
      >
        {/* Model */}
        <Accordion.Item value="model">
          <Accordion.Control>{t.embedEditor.model}</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="sm">
              <TextInput
                label={t.embedEditor.modelName}
                value={metadata.model?.name ?? ''}
                onChange={(e: { currentTarget: { value: string } }) =>
                  onChange({
                    ...metadata,
                    model: {
                      ...metadata.model,
                      name: val(e) || undefined,
                    },
                  })
                }
              />
              <TextInput
                label={t.embedEditor.modelHash}
                value={metadata.model?.hash ?? ''}
                onChange={(e: { currentTarget: { value: string } }) =>
                  onChange({
                    ...metadata,
                    model: {
                      ...metadata.model,
                      hash: val(e) || undefined,
                    },
                  })
                }
              />
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>

        {/* Sampling */}
        <Accordion.Item value="sampling">
          <Accordion.Control>{t.embedEditor.sampling}</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="sm">
              <Group grow>
                <TextInput
                  label={t.embedEditor.sampler}
                  value={metadata.sampling?.sampler ?? ''}
                  onChange={(e: { currentTarget: { value: string } }) =>
                    onChange({
                      ...metadata,
                      sampling: {
                        ...metadata.sampling,
                        sampler: val(e) || undefined,
                      },
                    })
                  }
                />
                <TextInput
                  label={t.embedEditor.scheduler}
                  value={metadata.sampling?.scheduler ?? ''}
                  onChange={(e: { currentTarget: { value: string } }) =>
                    onChange({
                      ...metadata,
                      sampling: {
                        ...metadata.sampling,
                        scheduler: val(e) || undefined,
                      },
                    })
                  }
                />
              </Group>
              <Group grow>
                <NumberInput
                  label={t.embedEditor.steps}
                  min={1}
                  value={metadata.sampling?.steps ?? ''}
                  onChange={(v: string | number) =>
                    onChange({
                      ...metadata,
                      sampling: { ...metadata.sampling, steps: toNum(v) },
                    })
                  }
                />
                <NumberInput
                  label={t.embedEditor.cfg}
                  min={0}
                  step={0.5}
                  decimalScale={1}
                  value={metadata.sampling?.cfg ?? ''}
                  onChange={(v: string | number) =>
                    onChange({
                      ...metadata,
                      sampling: { ...metadata.sampling, cfg: toNum(v) },
                    })
                  }
                />
              </Group>
              <Group grow>
                <NumberInput
                  label={t.embedEditor.seed}
                  min={0}
                  value={metadata.sampling?.seed ?? ''}
                  onChange={(v: string | number) =>
                    onChange({
                      ...metadata,
                      sampling: { ...metadata.sampling, seed: toNum(v) },
                    })
                  }
                />
                <NumberInput
                  label={t.embedEditor.clipSkip}
                  min={1}
                  value={metadata.sampling?.clipSkip ?? ''}
                  onChange={(v: string | number) =>
                    onChange({
                      ...metadata,
                      sampling: { ...metadata.sampling, clipSkip: toNum(v) },
                    })
                  }
                />
              </Group>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>

        {/* Hires.fix */}
        <Accordion.Item value="hires">
          <Accordion.Control>{t.embedEditor.hires}</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="sm">
              <TextInput
                label={t.embedEditor.hiresUpscaler}
                value={metadata.hires?.upscaler ?? ''}
                onChange={(e: { currentTarget: { value: string } }) =>
                  onChange({
                    ...metadata,
                    hires: {
                      ...metadata.hires,
                      upscaler: val(e) || undefined,
                    },
                  })
                }
              />
              <Group grow>
                <NumberInput
                  label={t.embedEditor.hiresScale}
                  min={1}
                  step={0.1}
                  decimalScale={2}
                  value={metadata.hires?.scale ?? ''}
                  onChange={(v: string | number) =>
                    onChange({
                      ...metadata,
                      hires: { ...metadata.hires, scale: toNum(v) },
                    })
                  }
                />
                <NumberInput
                  label={t.embedEditor.hiresSteps}
                  min={1}
                  value={metadata.hires?.steps ?? ''}
                  onChange={(v: string | number) =>
                    onChange({
                      ...metadata,
                      hires: { ...metadata.hires, steps: toNum(v) },
                    })
                  }
                />
              </Group>
              <NumberInput
                label={t.embedEditor.hiresDenoise}
                min={0}
                max={1}
                step={0.05}
                decimalScale={2}
                value={metadata.hires?.denoise ?? ''}
                onChange={(v: string | number) =>
                  onChange({
                    ...metadata,
                    hires: { ...metadata.hires, denoise: toNum(v) },
                  })
                }
              />
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}
