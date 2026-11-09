import { parse } from '@enslo/sd-metadata-lite';

declare const __LITE_VERSION__: string;

// Inject version into footer
document.getElementById('lib-version')!.textContent = __LITE_VERSION__;

// DOM elements
const dropzone = document.getElementById('dropzone')!;
const dropzoneInitial = document.getElementById('dropzone-initial')!;
const dropzonePreview = document.getElementById('dropzone-preview')!;
const previewThumb = document.getElementById(
  'preview-thumb',
) as HTMLImageElement;
const previewFilename = document.getElementById('preview-filename')!;
const clearBtn = document.getElementById('clear-btn')!;
const resultSection = document.getElementById('result')!;
const resultText = document.getElementById('result-text')!;
const fileInput = document.getElementById('file-input') as HTMLInputElement;

let currentObjectUrl: string | null = null;

// --- File handling ---

function handleFile(file: File): void {
  file
    .arrayBuffer()
    .then((buf) => {
      const text = parse(new Uint8Array(buf));

      // Revoke previous object URL
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
      }

      // Show preview in drop zone
      currentObjectUrl = URL.createObjectURL(file);
      previewThumb.src = currentObjectUrl;
      previewFilename.textContent = file.name;
      previewFilename.title = file.name;
      dropzoneInitial.hidden = true;
      dropzonePreview.hidden = false;

      // Show parse result
      resultText.textContent = text || 'No metadata found.';
      resultSection.hidden = false;
    })
    .catch((e: unknown) => {
      // A file the browser could not read, or one the parser choked on:
      // say so instead of leaving the page as it was
      resultText.textContent = `Failed to read the file: ${e instanceof Error ? e.message : String(e)}`;
      resultSection.hidden = false;
    });
}

function clearState(): void {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }

  // An empty src resolves to the page itself, which the browser would fetch
  previewThumb.removeAttribute('src');
  previewFilename.textContent = '';
  dropzoneInitial.hidden = false;
  dropzonePreview.hidden = true;
  resultSection.hidden = true;
  resultText.textContent = '';
  fileInput.value = '';
}

// --- Drop zone click ---

dropzone.addEventListener('click', (e) => {
  // Don't trigger file picker when clicking the clear button
  if ((e.target as HTMLElement).closest('.clear-btn')) return;
  fileInput.click();
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) handleFile(file);
});

// --- Clear button ---

clearBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  clearState();
});

// --- Global drag & drop ---

let dragCounter = 0;

document.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragCounter++;
  if (dragCounter === 1) {
    dropzone.classList.add('drag-over');
  }
});

document.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter === 0) {
    dropzone.classList.remove('drag-over');
  }
});

document.addEventListener('dragover', (e) => {
  e.preventDefault();
});

document.addEventListener('drop', (e) => {
  e.preventDefault();
  dragCounter = 0;
  dropzone.classList.remove('drag-over');

  const file = e.dataTransfer?.files[0];
  if (file) handleFile(file);
});
