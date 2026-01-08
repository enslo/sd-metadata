import './style.css';
import { parseMetadata, readPngMetadata } from 'sd-metadata';
import type { GenerationMetadata, PngMetadata } from 'sd-metadata';

// DOM Elements
const dropZone = document.getElementById('dropZone') as HTMLElement;
const dropZoneContent = document.getElementById(
  'dropZoneContent',
) as HTMLElement;
const dropZonePreview = document.getElementById(
  'dropZonePreview',
) as HTMLElement;
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const previewImage = document.getElementById(
  'previewImage',
) as HTMLImageElement;
const imageInfo = document.getElementById('imageInfo') as HTMLElement;
const results = document.getElementById('results') as HTMLElement;
const parsedMetadata = document.getElementById('parsedMetadata') as HTMLElement;
const rawData = document.getElementById('rawData') as HTMLElement;
const errorSection = document.getElementById('error') as HTMLElement;
const errorMessage = document.getElementById('errorMessage') as HTMLElement;
const tabs = document.querySelectorAll('.tab');
const parsedTab = document.getElementById('parsedTab') as HTMLElement;
const rawTab = document.getElementById('rawTab') as HTMLElement;

/**
 * Initialize the application
 */
function init() {
  setupDropZone();
  setupTabs();
}

/**
 * Setup drag and drop handlers
 */
function setupDropZone() {
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileSelect);

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer?.files[0];
    if (file) processFile(file);
  });
}

/**
 * Setup tab switching
 */
function setupTabs() {
  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      const tabName = (tab as HTMLElement).dataset.tab;
      for (const t of tabs) {
        t.classList.remove('active');
      }
      tab.classList.add('active');

      parsedTab.hidden = tabName !== 'parsed';
      rawTab.hidden = tabName !== 'raw';
    });
  }
}

/**
 * Handle file selection from input
 */
function handleFileSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) processFile(file);
}

/**
 * Process the uploaded file
 */
async function processFile(file: File) {
  // Reset UI
  hideError();
  results.hidden = true;
  resetDropZone();

  // Validate file type
  if (!file.type.startsWith('image/png')) {
    showError('Please upload a PNG file');
    return;
  }

  // Read file as ArrayBuffer
  const buffer = await file.arrayBuffer();
  const data = new Uint8Array(buffer);

  // Show preview
  showPreview(file);

  // Read metadata
  const readResult = readPngMetadata(data);
  if (!readResult.ok) {
    showError(`Failed to read PNG: ${readResult.error.type}`);
    return;
  }

  const pngMetadata = readResult.value;

  // Parse metadata
  const parseResult = parseMetadata(pngMetadata);

  if (parseResult.ok) {
    showResults(pngMetadata, parseResult.value);
  } else {
    // Show raw data even if parsing fails
    showResults(pngMetadata, null, parseResult.error.type);
  }
}

/**
 * Show image preview in drop zone
 */
function showPreview(file: File) {
  const url = URL.createObjectURL(file);
  previewImage.src = url;
  previewImage.onload = () => URL.revokeObjectURL(url);
  dropZoneContent.hidden = true;
  dropZonePreview.hidden = false;
  dropZone.classList.add('has-preview');
}

/**
 * Reset drop zone to initial state
 */
function resetDropZone() {
  dropZoneContent.hidden = false;
  dropZonePreview.hidden = true;
  dropZone.classList.remove('has-preview');
}

/**
 * Show results with parsed and raw data
 */
function showResults(
  raw: PngMetadata,
  parsed: GenerationMetadata | null,
  error?: string,
) {
  // Update image info
  updateImageInfo(raw, parsed, error);

  // Show parsed metadata
  if (parsed) {
    parsedMetadata.innerHTML = renderParsedMetadata(parsed);
  } else {
    parsedMetadata.innerHTML = `<div class="error-inline">
      <p>Could not parse metadata: ${error || 'Unknown format'}</p>
    </div>`;
  }

  // Show raw data as individual chunks
  rawData.innerHTML = renderRawChunks(raw.chunks);

  // Reset to Parsed Metadata tab
  for (const tab of tabs) {
    const tabName = (tab as HTMLElement).dataset.tab;
    tab.classList.toggle('active', tabName === 'parsed');
  }
  parsedTab.hidden = false;
  rawTab.hidden = true;

  results.hidden = false;
}

/**
 * Update image info section
 */
function updateImageInfo(
  raw: PngMetadata,
  parsed: GenerationMetadata | null,
  error?: string,
) {
  const software = parsed?.software || raw.software || 'Unknown';
  const softwareLabel = getSoftwareLabel(software);

  imageInfo.innerHTML = `
    <h3>Detected Software</h3>
    <span class="software-badge">${softwareLabel}</span>
    ${error ? `<p style="color: var(--color-error); margin-top: 0.5rem;">Parse error: ${error}</p>` : ''}
  `;
}

/**
 * Get display label for software
 */
function getSoftwareLabel(software: string): string {
  const labels: Record<string, string> = {
    novelai: 'NovelAI',
    comfyui: 'ComfyUI',
    tensorart: 'TensorArt',
    'stability-matrix': 'Stability Matrix',
    invokeai: 'InvokeAI',
    swarmui: 'SwarmUI',
    'sd-webui': 'SD WebUI',
    forge: 'Forge',
    'forge-neo': 'Forge Neo',
  };
  return labels[software] || software;
}

/**
 * Render parsed metadata as HTML
 */
function renderParsedMetadata(metadata: GenerationMetadata): string {
  let html = '';

  // Prompt
  if (metadata.prompt) {
    html += `
      <div class="metadata-section">
        <h4>Prompt</h4>
        <div class="prompt-text">${escapeHtml(metadata.prompt)}</div>
      </div>
    `;
  }

  // Negative Prompt
  if (metadata.negativePrompt) {
    html += `
      <div class="metadata-section">
        <h4>Negative Prompt</h4>
        <div class="prompt-text">${escapeHtml(metadata.negativePrompt)}</div>
      </div>
    `;
  }

  // NovelAI Character Prompts
  if (
    metadata.software === 'novelai' &&
    metadata.characterPrompts &&
    metadata.characterPrompts.length > 0
  ) {
    html += `
      <div class="metadata-section">
        <h4>Character Prompts</h4>
        ${metadata.characterPrompts
          .map(
            (char, i) => `
          <div class="character-prompt">
            <div class="character-header">Character ${i + 1}${char.center ? ` (${(char.center.x * 100).toFixed(0)}%, ${(char.center.y * 100).toFixed(0)}%)` : ''}</div>
            <div class="prompt-text">${escapeHtml(char.prompt)}</div>
          </div>
        `,
          )
          .join('')}
      </div>
    `;
  }

  // Generation Settings (Model → Sampling → Hires → Size)
  const settings: [string, unknown][] = [];

  // 1. Model
  if (metadata.model) {
    if (metadata.model.name) settings.push(['Model', metadata.model.name]);
    if (metadata.model.hash) settings.push(['Model Hash', metadata.model.hash]);
  }

  // 2. Sampling
  if (metadata.sampling) {
    if (metadata.sampling.sampler)
      settings.push(['Sampler', metadata.sampling.sampler]);
    if (metadata.sampling.scheduler)
      settings.push(['Scheduler', metadata.sampling.scheduler]);
    if (metadata.sampling.steps)
      settings.push(['Steps', metadata.sampling.steps]);
    if (metadata.sampling.cfg)
      settings.push(['CFG Scale', metadata.sampling.cfg]);
    if (metadata.sampling.seed) settings.push(['Seed', metadata.sampling.seed]);
    if (metadata.sampling.clipSkip)
      settings.push(['CLIP Skip', metadata.sampling.clipSkip]);
  }

  // 3. Hires/Upscale
  if (metadata.hires) {
    if (metadata.hires.upscaler)
      settings.push(['Upscaler', metadata.hires.upscaler]);
    if (metadata.hires.scale)
      settings.push(['Hires Scale', metadata.hires.scale]);
    if (metadata.hires.steps)
      settings.push(['Hires Steps', metadata.hires.steps]);
    if (metadata.hires.denoise)
      settings.push(['Hires Denoise', metadata.hires.denoise]);
  }

  // 4. Image Size
  settings.push(['Width', metadata.width]);
  settings.push(['Height', metadata.height]);

  if (settings.length > 0) {
    html += `<div class="metadata-section"><h4>Generation Settings</h4>${settings.map(([label, value]) => `<div class="metadata-field"><span class="label">${label}</span><span class="value">${value}</span></div>`).join('')}</div>`;
  }

  return html;
}

/**
 * Detect if text is JSON
 */
function isJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Render raw chunks as individual collapsible sections
 */
function renderRawChunks(
  chunks: Array<{ keyword: string; type: string; text: string }>,
): string {
  return chunks
    .map((chunk) => {
      const format = isJson(chunk.text) ? 'JSON' : 'Text';

      // Format JSON for display
      let formattedText = chunk.text;
      if (format === 'JSON') {
        try {
          formattedText = JSON.stringify(JSON.parse(chunk.text), null, 2);
        } catch {
          // Keep original if formatting fails
        }
      }

      return `<details class="raw-chunk" open><summary class="raw-chunk-header"><span class="chunk-keyword">${escapeHtml(chunk.keyword)}</span><span class="chunk-type">${chunk.type}</span><span class="chunk-format">${format}</span></summary><pre class="chunk-content">${escapeHtml(formattedText)}</pre></details>`;
    })
    .join('');
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Show error message
 */
function showError(message: string) {
  errorMessage.textContent = message;
  errorSection.hidden = false;
}

/**
 * Hide error message
 */
function hideError() {
  errorSection.hidden = true;
}

// Initialize app
init();
