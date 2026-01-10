import type { GenerationMetadata } from 'sd-metadata';
import { CopyButton } from '../CopyButton/CopyButton';
import styles from './Results.module.css';

interface ParsedMetadataProps {
  metadata: GenerationMetadata;
}

/**
 * Display parsed generation metadata
 */
export function ParsedMetadata({ metadata }: ParsedMetadataProps) {
  return (
    <div>
      {/* Prompt */}
      {metadata.prompt && (
        <Section title="Prompt" copyValue={metadata.prompt}>
          <div class={styles.promptText}>{metadata.prompt}</div>
        </Section>
      )}

      {/* Negative Prompt */}
      {metadata.negativePrompt && (
        <Section title="Negative Prompt" copyValue={metadata.negativePrompt}>
          <div class={styles.promptText}>{metadata.negativePrompt}</div>
        </Section>
      )}

      {/* Character Prompts (NovelAI) */}
      {metadata.software === 'novelai' &&
        metadata.characterPrompts &&
        metadata.characterPrompts.length > 0 && (
          <Section title="Character Prompts">
            {metadata.characterPrompts.map((char, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: character prompts have no unique identifier
              <div class={styles.characterPrompt} key={`character-${i}`}>
                <div class={styles.characterHeader}>
                  <span>
                    Character {i + 1}
                    {char.center &&
                      ` (${(char.center.x * 100).toFixed(0)}%, ${(char.center.y * 100).toFixed(0)}%)`}
                  </span>
                  <CopyButton value={char.prompt} />
                </div>
                <div class={styles.promptText}>{char.prompt}</div>
              </div>
            ))}
          </Section>
        )}

      {/* Generation Settings */}
      <GenerationSettings metadata={metadata} />
    </div>
  );
}

interface SectionProps {
  title: string;
  copyValue?: string;
  children: preact.ComponentChildren;
}

function Section({ title, copyValue, children }: SectionProps) {
  return (
    <div class={styles.metadataSection}>
      <div class={styles.sectionHeader}>
        <h4 class={styles.sectionTitle}>{title}</h4>
        {copyValue !== undefined && <CopyButton value={copyValue} />}
      </div>
      {children}
    </div>
  );
}

function GenerationSettings({ metadata }: { metadata: GenerationMetadata }) {
  const settings = buildSettingsList(metadata);
  if (settings.length === 0) return null;

  return (
    <Section title="Generation Settings">
      {settings.map(([label, value, copyable]) => (
        <div class={styles.metadataField} key={label}>
          <span class={styles.fieldLabel}>{label}</span>
          <span class={styles.fieldValue}>
            {String(value)}
            {copyable && <CopyButton value={String(value)} />}
          </span>
        </div>
      ))}
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
