/**
 * Demo site entry point
 *
 * Handles DOM initialization and event setup.
 * Rendering logic is delegated to render.ts.
 */

import './style.css';
import {
  parseJpeg,
  parsePng,
  parseWebp,
  readJpegMetadata,
  readPngMetadata,
  readWebpMetadata,
} from 'sd-metadata';
import type { MetadataSegment, ParseResult, PngTextChunk } from 'sd-metadata';
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

  // Validate file type
  const format = getImageFormat(file.type);
  if (!format) {
    showError('Please upload a PNG, JPEG, or WebP file');
    return;
  }

  // Read file as ArrayBuffer
  const buffer = await file.arrayBuffer();
  const data = new Uint8Array(buffer);

  // Show preview
  showPreview(file);

  // Process based on format
  switch (format) {
    case 'png':
      processPng(data);
      break;
    case 'jpeg':
      processJpeg(data);
      break;
    case 'webp':
      processWebp(data);
      break;
  }
}

/**
 * Get image format from MIME type
 */
function getImageFormat(mimeType: string): 'png' | 'jpeg' | 'webp' | null {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return 'jpeg';
  if (mimeType === 'image/webp') return 'webp';
  return null;
}

/**
 * Process PNG file
 */
function processPng(data: Uint8Array) {
  const readResult = readPngMetadata(data);
  if (!readResult.ok) {
    showError(`Failed to read PNG: ${readResult.error.type}`);
    return;
  }

  const parseResult = parsePng(data);
  showPngResults(readResult.value, parseResult);
}

/**
 * Process JPEG file
 */
function processJpeg(data: Uint8Array) {
  const readResult = readJpegMetadata(data);
  if (!readResult.ok) {
    showError(`Failed to read JPEG: ${readResult.error.type}`);
    return;
  }

  const parseResult = parseJpeg(data);
  showExifResults(readResult.value, parseResult);
}

/**
 * Process WebP file
 */
function processWebp(data: Uint8Array) {
  const readResult = readWebpMetadata(data);
  if (!readResult.ok) {
    showError(`Failed to read WebP: ${readResult.error.type}`);
    return;
  }

  const parseResult = parseWebp(data);
  showExifResults(readResult.value, parseResult);
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
 * Show results with PNG chunks
 */
function showPngResults(raw: PngTextChunk[], parseResult: ParseResult) {
  const { imageInfo, parsedMetadata, rawData, results } = elements;

  // Update image info and parsed metadata based on status
  if (parseResult.status === 'success') {
    imageInfo.replaceChildren(createImageInfo(parseResult.metadata));
    parsedMetadata.replaceChildren(createParsedMetadata(parseResult.metadata));
  } else {
    imageInfo.replaceChildren(createImageInfo(null, parseResult.status));
    parsedMetadata.replaceChildren(createError(parseResult.status));
  }

  // Show raw data as individual chunks
  rawData.replaceChildren(createRawChunks(raw));

  // Reset to Parsed Metadata tab
  setActiveTab('parsed');
  results.hidden = false;
}

/**
 * Show results with Exif segments (JPEG/WebP)
 */
function showExifResults(raw: MetadataSegment[], parseResult: ParseResult) {
  const { imageInfo, parsedMetadata, rawData, results } = elements;

  // Update image info and parsed metadata based on status
  if (parseResult.status === 'success') {
    imageInfo.replaceChildren(createImageInfo(parseResult.metadata));
    parsedMetadata.replaceChildren(createParsedMetadata(parseResult.metadata));
  } else {
    imageInfo.replaceChildren(createImageInfo(null, parseResult.status));
    parsedMetadata.replaceChildren(createError(parseResult.status));
  }

  // Show raw data as segments
  rawData.replaceChildren(createExifSegments(raw));

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
