/**
 * Demo site entry point
 *
 * Handles DOM initialization and event setup.
 * Rendering logic is delegated to render.ts.
 */

import './style.css';
import { read } from 'sd-metadata';
import type { ParseResult } from 'sd-metadata';
import {
  createError,
  createExifSegments,
  createImageInfo,
  createParsedMetadata,
  createRawChunks,
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

  // Enable drop anywhere on the page
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  document.addEventListener('dragleave', (e) => {
    // Only remove highlight when leaving the document
    if (e.relatedTarget === null) {
      dropZone.classList.remove('drag-over');
    }
  });

  document.addEventListener('drop', (e) => {
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

  // Read file as ArrayBuffer
  const buffer = await file.arrayBuffer();
  const data = new Uint8Array(buffer);

  // Show preview
  showPreview(file);

  // Parse metadata using unified API
  showResults(read(data));
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
 * Show results based on parse result
 */
function showResults(parseResult: ParseResult) {
  const { imageInfo, parsedMetadata, rawData, results } = elements;

  // Handle different statuses
  switch (parseResult.status) {
    case 'success':
      imageInfo.replaceChildren(createImageInfo(parseResult.metadata));
      parsedMetadata.replaceChildren(
        createParsedMetadata(parseResult.metadata),
      );
      // Show raw data based on format
      if (parseResult.raw.format === 'png') {
        rawData.replaceChildren(createRawChunks(parseResult.raw.chunks));
      } else {
        rawData.replaceChildren(createExifSegments(parseResult.raw.segments));
      }
      break;

    case 'unrecognized':
      imageInfo.replaceChildren(createImageInfo(null, 'unrecognized'));
      parsedMetadata.replaceChildren(createError('unrecognized'));
      // Show raw data even when unrecognized
      if (parseResult.raw.format === 'png') {
        rawData.replaceChildren(createRawChunks(parseResult.raw.chunks));
      } else {
        rawData.replaceChildren(createExifSegments(parseResult.raw.segments));
      }
      break;

    case 'empty':
      imageInfo.replaceChildren(createImageInfo(null, 'empty'));
      parsedMetadata.replaceChildren(createError('empty'));
      rawData.replaceChildren(createError('empty'));
      break;

    case 'invalid':
      showError(parseResult.message ?? 'Invalid image file');
      return;
  }

  // Reset to Parsed Metadata tab
  setActiveTab('parsed');
  results.hidden = false;
}

/**
 * Set active tab
 */
function setActiveTab(tabName: 'parsed' | 'raw') {
  const { parsedTab, rawTab } = elements;
  for (const tab of tabs) {
    const name = (tab as HTMLElement).dataset.tab;
    tab.classList.toggle('active', name === tabName);
  }
  parsedTab.hidden = tabName !== 'parsed';
  rawTab.hidden = tabName !== 'raw';
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
