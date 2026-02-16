import type { CharacterPrompt, GenerationMetadata } from '@enslo/sd-metadata';
import { Group, Stack, Text, Title } from '@mantine/core';
import { useStore } from '@nanostores/preact';
import type { ComponentChildren } from 'preact';
import { $t } from '../../i18n';
import { CopyButton } from '../CopyButton/CopyButton';

interface ParsedMetadataProps {
  metadata: GenerationMetadata;
}

/**
 * Display parsed generation metadata
 */
export function ParsedMetadata({ metadata }: ParsedMetadataProps) {
  const t = useStore($t);

  return (
    <Stack gap="md">
      {/* Prompt */}
      {metadata.prompt && (
        <Section title={t.fields.prompt} copyValue={metadata.prompt}>
          <Text
            style={{
              fontFamily: 'var(--mantine-font-family-monospace)',
              fontSize: '0.85rem',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.6,
            }}
          >
            {metadata.prompt}
          </Text>
        </Section>
      )}

      {/* Negative Prompt */}
      {metadata.negativePrompt && (
        <Section
          title={t.fields.negativePrompt}
          copyValue={metadata.negativePrompt}
        >
          <Text
            style={{
              fontFamily: 'var(--mantine-font-family-monospace)',
              fontSize: '0.85rem',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.6,
            }}
          >
            {metadata.negativePrompt}
          </Text>
        </Section>
      )}

      {/* Character Prompts (NovelAI) */}
      {metadata.software === 'novelai' &&
        metadata.characterPrompts &&
        metadata.characterPrompts.length > 0 && (
          <Section title={t.fields.characterPrompts}>
            <Stack gap="sm">
              {metadata.characterPrompts.map(
                (char: CharacterPrompt, i: number) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: character prompts have no unique identifier
                  <div key={`character-${i}`}>
                    <Group justify="space-between" mb={4}>
                      <Text size="sm" fw={500}>
                        Character {i + 1}
                        {char.center &&
                          ` (${(char.center.x * 100).toFixed(0)}%, ${(char.center.y * 100).toFixed(0)}%)`}
                      </Text>
                      <CopyButton value={char.prompt} />
                    </Group>
                    <Text
                      style={{
                        fontFamily: 'var(--mantine-font-family-monospace)',
                        fontSize: '0.85rem',
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.6,
                      }}
                    >
                      {char.prompt}
                    </Text>
                  </div>
                ),
              )}
            </Stack>
          </Section>
        )}

      {/* Generation Settings */}
      <GenerationSettings metadata={metadata} />
    </Stack>
  );
}

interface SectionProps {
  title: string;
  copyValue?: string;
  children: ComponentChildren;
}

function Section({ title, copyValue, children }: SectionProps) {
  return (
    <div>
      <Group justify="space-between" mb="xs">
        <Title order={4} size="sm">
          {title}
        </Title>
        {copyValue !== undefined && <CopyButton value={copyValue} />}
      </Group>
      {children}
    </div>
  );
}

type FieldLabels = ReturnType<typeof useStore<typeof $t>>['fields'];

function GenerationSettings({ metadata }: { metadata: GenerationMetadata }) {
  const t = useStore($t);
  const settings = buildSettingsList(metadata, t.fields);
  if (settings.length === 0) return null;

  return (
    <Section title={t.fields.generationSettings}>
      <Stack gap={4}>
        {settings.map(([label, value, copyable]) => (
          <Group key={label} justify="space-between" wrap="nowrap">
            <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>
              {label}
            </Text>
            <Group gap={4} wrap="nowrap">
              <Text size="sm" fw={500} truncate="end">
                {String(value)}
              </Text>
              {copyable && <CopyButton value={String(value)} />}
            </Group>
          </Group>
        ))}
      </Stack>
    </Section>
  );
}

/**
 * Build settings list from metadata
 */
function buildSettingsList(
  metadata: GenerationMetadata,
  f: FieldLabels,
): [string, unknown, boolean][] {
  const settings: [string, unknown, boolean][] = [];

  // Model
  if (metadata.model) {
    if (metadata.model.name)
      settings.push([f.model, metadata.model.name, false]);
    if (metadata.model.hash)
      settings.push([f.modelHash, metadata.model.hash, false]);
  }

  // Sampling
  if (metadata.sampling) {
    const s = metadata.sampling;
    if (s.sampler) settings.push([f.sampler, s.sampler, false]);
    if (s.scheduler) settings.push([f.scheduler, s.scheduler, false]);
    if (s.steps) settings.push([f.steps, s.steps, false]);
    if (s.cfg) settings.push([f.cfg, s.cfg, false]);
    if (s.seed) settings.push([f.seed, s.seed, true]);
    if (s.clipSkip) settings.push([f.clipSkip, s.clipSkip, false]);
  }

  // Hires/Upscale
  if (metadata.hires) {
    const hr = metadata.hires;
    if (hr.upscaler) settings.push([f.upscaler, hr.upscaler, false]);
    if (hr.scale) settings.push([f.hiresScale, hr.scale, false]);
    if (hr.steps) settings.push([f.hiresSteps, hr.steps, false]);
    if (hr.denoise) settings.push([f.hiresDenoise, hr.denoise, false]);
  }

  // Upscale (post-generation)
  if (metadata.upscale) {
    const u = metadata.upscale;
    if (u.upscaler) settings.push([f.upscaler, u.upscaler, false]);
    if (u.scale) settings.push([f.upscaleFactor, u.scale, false]);
  }

  // Image Size
  settings.push([f.width, metadata.width, false]);
  settings.push([f.height, metadata.height, false]);

  return settings;
}
