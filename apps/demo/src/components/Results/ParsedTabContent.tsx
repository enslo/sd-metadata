import type {
  CharacterPrompt,
  GenerationMetadata,
  LoraSettings,
  ParseResult,
} from '@enslo/sd-metadata';
import { Group, Stack, Table, Text } from '@mantine/core';
import type { I18nMessages } from '../../i18n';
import { CopyButton } from '../CopyButton';
import { ErrorMessage } from './ErrorMessage';
import { ParsedSection } from './ParsedSection';
import { VendorSection } from './VendorSection';

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

  if (parseResult.status === 'vendor') {
    return <VendorSection info={parseResult.info} t={t} />;
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
                  // biome-ignore lint/suspicious/noArrayIndexKey: character entries have no stable id
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

      {/* LoRAs */}
      {metadata.loras && metadata.loras.length > 0 && (
        <ParsedSection title={t.fields.loras}>
          <LoraTable loras={metadata.loras} f={t.fields} />
        </ParsedSection>
      )}

      {/* Generation Settings */}
      {settings.length > 0 && (
        <ParsedSection title={t.fields.generationSettings}>
          <Table
            highlightOnHover
            horizontalSpacing={0}
            verticalSpacing="xs"
            layout="fixed"
          >
            <Table.Tbody>
              {settings.map(({ label, value }) => (
                <Table.Tr key={label}>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {label}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Group gap={4} wrap="nowrap" justify="flex-end">
                      <Text size="sm" fw={500} truncate="end">
                        {String(value)}
                      </Text>
                      {copyableLabels.has(label) && (
                        <CopyButton value={String(value)} />
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ParsedSection>
      )}
    </Stack>
  );
}

interface LoraTableProps {
  loras: LoraSettings[];
  f: I18nMessages['fields'];
}

/**
 * LoRAs in the order the tool listed them; the CLIP weight and hash columns
 * appear only when at least one entry has them
 */
function LoraTable({ loras, f }: LoraTableProps) {
  const hasClipWeight = loras.some((lora) => lora.clipWeight !== undefined);
  const hasHash = loras.some((lora) => lora.hash !== undefined);
  const numeric = { textAlign: 'right' as const, width: '6rem' };

  return (
    <Table
      highlightOnHover
      horizontalSpacing="xs"
      verticalSpacing="xs"
      layout="fixed"
    >
      <Table.Thead>
        <Table.Tr>
          <Table.Th>
            <Text size="xs" c="dimmed">
              {f.loraName}
            </Text>
          </Table.Th>
          <Table.Th style={numeric}>
            <Text size="xs" c="dimmed">
              {f.loraWeight}
            </Text>
          </Table.Th>
          {hasClipWeight && (
            <Table.Th style={numeric}>
              <Text size="xs" c="dimmed">
                {f.loraClipWeight}
              </Text>
            </Table.Th>
          )}
          {hasHash && (
            <Table.Th>
              <Text size="xs" c="dimmed">
                {f.loraHash}
              </Text>
            </Table.Th>
          )}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {loras.map((lora, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the same LoRA can be listed twice
          <Table.Tr key={`lora-${i}`}>
            <Table.Td>
              <Text size="sm" fw={500} style={{ wordBreak: 'break-all' }}>
                {lora.name}
              </Text>
            </Table.Td>
            <Table.Td style={numeric}>
              <Text size="sm">{lora.weight ?? ''}</Text>
            </Table.Td>
            {hasClipWeight && (
              <Table.Td style={numeric}>
                <Text size="sm">{lora.clipWeight ?? ''}</Text>
              </Table.Td>
            )}
            {hasHash && (
              <Table.Td>
                <Text size="sm" c="dimmed" style={{ wordBreak: 'break-all' }}>
                  {lora.hash ?? ''}
                </Text>
              </Table.Td>
            )}
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
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
