/**
 * Demo site entry point
 *
 * Handles DOM initialization and event setup.
 * Rendering logic is delegated to render.ts.
 */

import './style.css';
import { parsePng, readPngMetadata } from 'sd-metadata';
import type { GenerationMetadata, PngTextChunk } from 'sd-metadata';
import {
  renderError,
  renderImageInfo,
  renderParsedMetadata,
  renderRawChunks,
} from './render';

// =============================================================================
// DOM Elements
// =============================================================================

const elements = {
  dropZone: document.getElementById('dropZone') as HTMLElement,
  dropZoneContent: document.getElementById('dropZoneContent') as HTMLElement,
  dropZonePreview: document.getElementById('dropZonePreview') as HTMLElement,
  fileInput: document.getElementById('fileInput') as HTMLInputElement,
  previewImage: document.getElementById('previewImage') as HTMLImageElement,
  imageInfo: document.getElementById('imageInfo') as HTMLElement,
  results: document.getElementById('results') as HTMLElement,
  parsedMetadata: document.getElementById('parsedMetadata') as HTMLElement,
  rawData: document.getElementById('rawData') as HTMLElement,
  errorSection: document.getElementById('error') as HTMLElement,
  errorMessage: document.getElementById('errorMessage') as HTMLElement,
  parsedTab: document.getElementById('parsedTab') as HTMLElement,
  rawTab: document.getElementById('rawTab') as HTMLElement,
};

const tabs = document.querySelectorAll('.tab');

// =============================================================================
// Initialization
// =============================================================================

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
  const { dropZone, fileInput } = elements;

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
  const { parsedTab, rawTab } = elements;

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

// =============================================================================
// Event Handlers
// =============================================================================

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
  const { results, errorSection } = elements;

  // Reset UI
  errorSection.hidden = true;
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

  // Read raw metadata for display
  const readResult = readPngMetadata(data);
  if (!readResult.ok) {
    showError(`Failed to read PNG: ${readResult.error.type}`);
    return;
  }

  // Parse metadata using unified API
  const parseResult = parsePng(data);

  if (parseResult.ok) {
    showResults(readResult.value, parseResult.value);
  } else {
    showResults(readResult.value, null, parseResult.error.type);
  }
}

// =============================================================================
// UI Updates
// =============================================================================

/**
 * Show image preview in drop zone
 */
function showPreview(file: File) {
  const { dropZone, dropZoneContent, dropZonePreview, previewImage } = elements;

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
  const { dropZone, dropZoneContent, dropZonePreview } = elements;

  dropZoneContent.hidden = false;
  dropZonePreview.hidden = true;
  dropZone.classList.remove('has-preview');
}

/**
 * Show results with parsed and raw data
 */
function showResults(
  raw: PngTextChunk[],
  parsed: GenerationMetadata | null,
  error?: string,
) {
  const { imageInfo, parsedMetadata, rawData, parsedTab, rawTab, results } =
    elements;

  // Update image info
  imageInfo.innerHTML = renderImageInfo(parsed, error);

  // Show parsed metadata or error
  parsedMetadata.innerHTML = parsed
    ? renderParsedMetadata(parsed)
    : renderError(error || 'Unknown format');

  // Show raw data as individual chunks
  rawData.innerHTML = renderRawChunks(raw);

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
 * Show error message
 */
function showError(message: string) {
  const { errorSection, errorMessage } = elements;
  errorMessage.textContent = message;
  errorSection.hidden = false;
}

// =============================================================================
// Start
// =============================================================================

init();
