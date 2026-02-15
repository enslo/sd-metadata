import type { EmbedMetadata } from '@enslo/sd-metadata';
import { useStore } from '@nanostores/preact';
import { $t } from '../../i18n';
import styles from './EmbedEditor.module.css';

interface MetadataFormProps {
  metadata: EmbedMetadata;
  onChange: (metadata: EmbedMetadata) => void;
}

/** Helper to get value from an input event */
function inputValue(e: Event): string {
  return (e.currentTarget as HTMLInputElement).value;
}

/** Helper to get numeric value from an input event */
function numericValue(e: Event): number | undefined {
  const v = (e.currentTarget as HTMLInputElement).valueAsNumber;
  return Number.isNaN(v) ? undefined : v;
}

/**
 * Form fields for editing BaseMetadata + characterPrompts
 */
export function MetadataForm({ metadata, onChange }: MetadataFormProps) {
  const t = useStore($t);

  const hasModel = metadata.model?.name || metadata.model?.hash;
  const hasSampling =
    metadata.sampling?.sampler ||
    metadata.sampling?.steps ||
    metadata.sampling?.cfg ||
    metadata.sampling?.seed;
  const hasHires =
    metadata.hires?.upscaler || metadata.hires?.scale || metadata.hires?.steps;

  return (
    <div>
      {/* Prompt */}
      <div class={styles.formGroup}>
        <label class={styles.label} htmlFor="embed-prompt">
          {t.embedEditor.prompt}
        </label>
        <textarea
          id="embed-prompt"
          class={styles.textarea}
          value={metadata.prompt}
          onInput={(e) => onChange({ ...metadata, prompt: inputValue(e) })}
          rows={3}
        />
      </div>

      {/* Negative Prompt */}
      <div class={styles.formGroup}>
        <label class={styles.label} htmlFor="embed-negative">
          {t.embedEditor.negativePrompt}
        </label>
        <textarea
          id="embed-negative"
          class={styles.textarea}
          value={metadata.negativePrompt}
          onInput={(e) =>
            onChange({ ...metadata, negativePrompt: inputValue(e) })
          }
          rows={2}
        />
      </div>

      {/* Width / Height */}
      <div class={styles.inputRow}>
        <div class={styles.formGroup}>
          <label class={styles.label} htmlFor="embed-width">
            {t.embedEditor.width}
          </label>
          <input
            id="embed-width"
            class={styles.input}
            type="number"
            min={0}
            step={1}
            value={metadata.width}
            onInput={(e) => {
              const v = numericValue(e);
              onChange({ ...metadata, width: v ?? 0 });
            }}
          />
        </div>
        <div class={styles.formGroup}>
          <label class={styles.label} htmlFor="embed-height">
            {t.embedEditor.height}
          </label>
          <input
            id="embed-height"
            class={styles.input}
            type="number"
            min={0}
            step={1}
            value={metadata.height}
            onInput={(e) => {
              const v = numericValue(e);
              onChange({ ...metadata, height: v ?? 0 });
            }}
          />
        </div>
      </div>

      {/* Model */}
      <details class={styles.detailsSection} open={!!hasModel}>
        <summary class={styles.detailsSummary}>{t.embedEditor.model}</summary>
        <div class={styles.detailsContent}>
          <div class={styles.formGroup}>
            <label class={styles.label} htmlFor="embed-model-name">
              {t.embedEditor.modelName}
            </label>
            <input
              id="embed-model-name"
              class={styles.input}
              type="text"
              value={metadata.model?.name ?? ''}
              onInput={(e) => {
                onChange({
                  ...metadata,
                  model: {
                    ...metadata.model,
                    name: inputValue(e) || undefined,
                  },
                });
              }}
            />
          </div>
          <div class={styles.formGroup}>
            <label class={styles.label} htmlFor="embed-model-hash">
              {t.embedEditor.modelHash}
            </label>
            <input
              id="embed-model-hash"
              class={styles.input}
              type="text"
              value={metadata.model?.hash ?? ''}
              onInput={(e) => {
                onChange({
                  ...metadata,
                  model: {
                    ...metadata.model,
                    hash: inputValue(e) || undefined,
                  },
                });
              }}
            />
          </div>
        </div>
      </details>

      {/* Sampling */}
      <details class={styles.detailsSection} open={!!hasSampling}>
        <summary class={styles.detailsSummary}>
          {t.embedEditor.sampling}
        </summary>
        <div class={styles.detailsContent}>
          <div class={styles.inputRow}>
            <div class={styles.formGroup}>
              <label class={styles.label} htmlFor="embed-sampler">
                {t.embedEditor.sampler}
              </label>
              <input
                id="embed-sampler"
                class={styles.input}
                type="text"
                value={metadata.sampling?.sampler ?? ''}
                onInput={(e) => {
                  onChange({
                    ...metadata,
                    sampling: {
                      ...metadata.sampling,
                      sampler: inputValue(e) || undefined,
                    },
                  });
                }}
              />
            </div>
            <div class={styles.formGroup}>
              <label class={styles.label} htmlFor="embed-scheduler">
                {t.embedEditor.scheduler}
              </label>
              <input
                id="embed-scheduler"
                class={styles.input}
                type="text"
                value={metadata.sampling?.scheduler ?? ''}
                onInput={(e) => {
                  onChange({
                    ...metadata,
                    sampling: {
                      ...metadata.sampling,
                      scheduler: inputValue(e) || undefined,
                    },
                  });
                }}
              />
            </div>
          </div>
          <div class={styles.inputRow}>
            <div class={styles.formGroup}>
              <label class={styles.label} htmlFor="embed-steps">
                {t.embedEditor.steps}
              </label>
              <input
                id="embed-steps"
                class={styles.input}
                type="number"
                min={1}
                value={metadata.sampling?.steps ?? ''}
                onInput={(e) => {
                  onChange({
                    ...metadata,
                    sampling: {
                      ...metadata.sampling,
                      steps: numericValue(e),
                    },
                  });
                }}
              />
            </div>
            <div class={styles.formGroup}>
              <label class={styles.label} htmlFor="embed-cfg">
                {t.embedEditor.cfg}
              </label>
              <input
                id="embed-cfg"
                class={styles.input}
                type="number"
                min={0}
                step={0.5}
                value={metadata.sampling?.cfg ?? ''}
                onInput={(e) => {
                  onChange({
                    ...metadata,
                    sampling: {
                      ...metadata.sampling,
                      cfg: numericValue(e),
                    },
                  });
                }}
              />
            </div>
          </div>
          <div class={styles.inputRow}>
            <div class={styles.formGroup}>
              <label class={styles.label} htmlFor="embed-seed">
                {t.embedEditor.seed}
              </label>
              <input
                id="embed-seed"
                class={styles.input}
                type="number"
                min={0}
                value={metadata.sampling?.seed ?? ''}
                onInput={(e) => {
                  onChange({
                    ...metadata,
                    sampling: {
                      ...metadata.sampling,
                      seed: numericValue(e),
                    },
                  });
                }}
              />
            </div>
            <div class={styles.formGroup}>
              <label class={styles.label} htmlFor="embed-clip-skip">
                {t.embedEditor.clipSkip}
              </label>
              <input
                id="embed-clip-skip"
                class={styles.input}
                type="number"
                min={1}
                value={metadata.sampling?.clipSkip ?? ''}
                onInput={(e) => {
                  onChange({
                    ...metadata,
                    sampling: {
                      ...metadata.sampling,
                      clipSkip: numericValue(e),
                    },
                  });
                }}
              />
            </div>
          </div>
        </div>
      </details>

      {/* Hires.fix */}
      <details class={styles.detailsSection} open={!!hasHires}>
        <summary class={styles.detailsSummary}>{t.embedEditor.hires}</summary>
        <div class={styles.detailsContent}>
          <div class={styles.formGroup}>
            <label class={styles.label} htmlFor="embed-hires-upscaler">
              {t.embedEditor.hiresUpscaler}
            </label>
            <input
              id="embed-hires-upscaler"
              class={styles.input}
              type="text"
              value={metadata.hires?.upscaler ?? ''}
              onInput={(e) => {
                onChange({
                  ...metadata,
                  hires: {
                    ...metadata.hires,
                    upscaler: inputValue(e) || undefined,
                  },
                });
              }}
            />
          </div>
          <div class={styles.inputRow}>
            <div class={styles.formGroup}>
              <label class={styles.label} htmlFor="embed-hires-scale">
                {t.embedEditor.hiresScale}
              </label>
              <input
                id="embed-hires-scale"
                class={styles.input}
                type="number"
                min={1}
                step={0.1}
                value={metadata.hires?.scale ?? ''}
                onInput={(e) => {
                  onChange({
                    ...metadata,
                    hires: {
                      ...metadata.hires,
                      scale: numericValue(e),
                    },
                  });
                }}
              />
            </div>
            <div class={styles.formGroup}>
              <label class={styles.label} htmlFor="embed-hires-steps">
                {t.embedEditor.hiresSteps}
              </label>
              <input
                id="embed-hires-steps"
                class={styles.input}
                type="number"
                min={1}
                value={metadata.hires?.steps ?? ''}
                onInput={(e) => {
                  onChange({
                    ...metadata,
                    hires: {
                      ...metadata.hires,
                      steps: numericValue(e),
                    },
                  });
                }}
              />
            </div>
          </div>
          <div class={styles.formGroup}>
            <label class={styles.label} htmlFor="embed-hires-denoise">
              {t.embedEditor.hiresDenoise}
            </label>
            <input
              id="embed-hires-denoise"
              class={styles.input}
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={metadata.hires?.denoise ?? ''}
              onInput={(e) => {
                onChange({
                  ...metadata,
                  hires: {
                    ...metadata.hires,
                    denoise: numericValue(e),
                  },
                });
              }}
            />
          </div>
        </div>
      </details>
    </div>
  );
}
