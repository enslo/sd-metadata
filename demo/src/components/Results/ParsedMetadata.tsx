import type { GenerationMetadata } from '@enslo/sd-metadata';
import { Group, Stack, Text, Title } from '@mantine/core';
import type { ComponentChildren } from 'preact';
import { CopyButton } from '../CopyButton/CopyButton';

interface ParsedMetadataProps {
  metadata: GenerationMetadata;
}

/**
 * Display parsed generation metadata
 */
export function ParsedMetadata({ metadata }: ParsedMetadataProps) {
  return (
    <Stack gap="md">
      {/* Prompt */}
      {metadata.prompt && (
        <Section title="Prompt" copyValue={metadata.prompt}>
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
        <Section title="Negative Prompt" copyValue={metadata.negativePrompt}>
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
          <Section title="Character Prompts">
            <Stack gap="sm">
              {metadata.characterPrompts.map((char, i) => (
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
              ))}
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

function GenerationSettings({ metadata }: { metadata: GenerationMetadata }) {
  const settings = buildSettingsList(metadata);
  if (settings.length === 0) return null;

  return (
    <Section title="Generation Settings">
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
): [string, unknown, boolean][] {
  const settings: [string, unknown, boolean][] = [];

  // Model
  if (metadata.model) {
    if (metadata.model.name)
      settings.push(['Model', metadata.model.name, false]);
    if (metadata.model.hash)
      settings.push(['Model Hash', metadata.model.hash, false]);
  }

  // Sampling
  if (metadata.sampling) {
    const s = metadata.sampling;
    if (s.sampler) settings.push(['Sampler', s.sampler, false]);
    if (s.scheduler) settings.push(['Scheduler', s.scheduler, false]);
    if (s.steps) settings.push(['Steps', s.steps, false]);
    if (s.cfg) settings.push(['CFG Scale', s.cfg, false]);
    if (s.seed) settings.push(['Seed', s.seed, true]);
    if (s.clipSkip) settings.push(['CLIP Skip', s.clipSkip, false]);
  }

  // Hires/Upscale
  if (metadata.hires) {
    const hr = metadata.hires;
    if (hr.upscaler) settings.push(['Upscaler', hr.upscaler, false]);
    if (hr.scale) settings.push(['Hires Scale', hr.scale, false]);
    if (hr.steps) settings.push(['Hires Steps', hr.steps, false]);
    if (hr.denoise) settings.push(['Hires Denoise', hr.denoise, false]);
  }

  // Upscale (post-generation)
  if (metadata.upscale) {
    const u = metadata.upscale;
    if (u.upscaler) settings.push(['Upscaler', u.upscaler, false]);
    if (u.scale) settings.push(['Upscale Factor', u.scale, false]);
  }

  // Image Size
  settings.push(['Width', metadata.width, false]);
  settings.push(['Height', metadata.height, false]);

  return settings;
}
