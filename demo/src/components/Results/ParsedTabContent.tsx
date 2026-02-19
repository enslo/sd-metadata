import type {
  CharacterPrompt,
  GenerationMetadata,
  ParseResult,
} from '@enslo/sd-metadata';
import { Divider, Group, Stack, Text } from '@mantine/core';
import type { I18nMessages } from '../../i18n';
import { CopyButton } from '../CopyButton';
import { ErrorMessage } from './ErrorMessage';
import { ParsedSection } from './ParsedSection';

interface ParsedTabContentProps {
  parseResult: Exclude<ParseResult, { status: 'invalid' }>;
  t: I18nMessages;
}

/**
 * @package
 * Tab content for the Parsed metadata view
 */
export function ParsedTabContent({ parseResult, t }: ParsedTabContentProps) {
  if (parseResult.status === 'empty') {
    return <ErrorMessage message={t.results.errors.noMetadata} />;
  }

  if (parseResult.status === 'unrecognized') {
    return <ErrorMessage message={t.results.errors.unrecognized} />;
  }

  const { metadata } = parseResult;
  const settings = buildSettingsList(metadata, t.fields);
  const copyableLabels = new Set([t.fields.seed]);

  return (
    <Stack gap="md">
      {/* Prompt */}
      {metadata.prompt && (
        <ParsedSection title={t.fields.prompt} copyValue={metadata.prompt}>
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
        </ParsedSection>
      )}

      {/* Negative Prompt */}
      {metadata.negativePrompt && (
        <ParsedSection
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
        </ParsedSection>
      )}

      {/* Character Prompts (NovelAI) */}
      {metadata.software === 'novelai' &&
        metadata.characterPrompts &&
        metadata.characterPrompts.length > 0 && (
          <ParsedSection title={t.fields.characterPrompts}>
            <Stack gap="sm">
              {metadata.characterPrompts.map(
                (char: CharacterPrompt, i: number) => (
                  <div key={`character-${i}`}>
                    <Group justify="space-between" mb={4}>
                      <Text
                        size="xs"
                        fw={700}
                        c="dimmed"
                        style={{
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
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
          </ParsedSection>
        )}

      {/* Generation Settings */}
      {settings.length > 0 && (
        <ParsedSection title={t.fields.generationSettings}>
          <Stack gap={0}>
            {settings.map(({ label, value }, i) => (
              <div key={label}>
                {i > 0 && <Divider />}
                <Group justify="space-between" wrap="nowrap" py={6}>
                  <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>
                    {label}
                  </Text>
                  <Group gap={4} wrap="nowrap">
                    <Text size="sm" fw={500} truncate="end">
                      {String(value)}
                    </Text>
                    {copyableLabels.has(label) && (
                      <CopyButton value={String(value)} />
                    )}
                  </Group>
                </Group>
              </div>
            ))}
          </Stack>
        </ParsedSection>
      )}
    </Stack>
  );
}

type Setting =
  | { label: string; value: string }
  | { label: string; value: number };

function buildSettingsList(
  metadata: GenerationMetadata,
  f: I18nMessages['fields'],
): Setting[] {
  return [
    metadata.model?.name
      ? { label: f.model, value: metadata.model.name }
      : null,
    metadata.model?.hash
      ? { label: f.modelHash, value: metadata.model.hash }
      : null,
    metadata.sampling?.sampler
      ? { label: f.sampler, value: metadata.sampling.sampler }
      : null,
    metadata.sampling?.scheduler
      ? { label: f.scheduler, value: metadata.sampling.scheduler }
      : null,
    metadata.sampling?.steps
      ? { label: f.steps, value: metadata.sampling.steps }
      : null,
    metadata.sampling?.cfg
      ? { label: f.cfg, value: metadata.sampling.cfg }
      : null,
    metadata.sampling?.seed
      ? { label: f.seed, value: metadata.sampling.seed }
      : null,
    metadata.sampling?.clipSkip
      ? { label: f.clipSkip, value: metadata.sampling.clipSkip }
      : null,
    metadata.hires?.upscaler
      ? { label: f.upscaler, value: metadata.hires.upscaler }
      : null,
    metadata.hires?.scale
      ? { label: f.hiresScale, value: metadata.hires.scale }
      : null,
    metadata.hires?.steps
      ? { label: f.hiresSteps, value: metadata.hires.steps }
      : null,
    metadata.hires?.denoise
      ? { label: f.hiresDenoise, value: metadata.hires.denoise }
      : null,
    metadata.upscale?.upscaler
      ? { label: f.upscaler, value: metadata.upscale.upscaler }
      : null,
    metadata.upscale?.scale
      ? { label: f.upscaleFactor, value: metadata.upscale.scale }
      : null,
    { label: f.width, value: metadata.width },
    { label: f.height, value: metadata.height },
  ].filter((s): s is Setting => s !== null);
}
