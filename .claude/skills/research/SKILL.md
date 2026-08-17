---
name: research
description: Investigate the metadata structure of an unknown AI-generated image — read it with the library API, cross-validate with exiftool, analyze raw chunks/EXIF segments, identify the generating tool, and document findings. Use when asked to research, investigate, or classify an unknown sample.
argument-hint: [path/to/sample]
---

# Metadata Research Guide

How to investigate the metadata structure of unknown AI-generated images.

Arguments: `$ARGUMENTS` — optionally the path to the sample file to
investigate. If not provided, ask the user which file to research or
look in `local_samples/`.

## Sample File Locations

| Directory        | Purpose                                     | Git Status |
|------------------|---------------------------------------------|------------|
| `samples/`       | Known/classified samples (source of truth)  | Tracked    |
| `local_samples/` | Unknown/unclassified samples for research   | .gitignore |

> Files in these directories have been pre-verified by the user to contain metadata.

## Research Procedure

### 1. Read with the Library API

Always start here. Run the library's `read()` against the unknown file.
The command runs with `packages/core` as the working directory, so
reference the sample relative to the repository root via `../../`:

```bash
pnpm --filter @enslo/sd-metadata exec tsx -e "
import { readFileSync } from 'fs';
import { read } from './src/index.ts';
const result = read(new Uint8Array(readFileSync('../../local_samples/unknown.png')));
console.log(JSON.stringify(result, null, 2));
"
```

Interpret the result:

| `status`       | Meaning                                   | Next step              |
|----------------|-------------------------------------------|------------------------|
| `success`      | Known tool, fully parsed                  | Review parsed metadata |
| `c2pa`         | C2PA Credentials (ChatGPT/Gemini)         | Record as C2PA         |
| `unrecognized` | Metadata found but format unknown         | Go to step 3           |
| `empty`        | No metadata extracted                     | Go to step 2           |
| `invalid`      | Image format error                        | Go to step 2           |

### 2. Cross-validate with exiftool

Use when step 1 returns `empty` or `invalid`, or when additional
context is needed (e.g., MakerNote, Software tag, undocumented EXIF
fields):

```bash
exiftool -j local_samples/unknown.png
```

If exiftool finds metadata that the library missed, the gap indicates
a reader-level issue (new chunk keyword, unsupported EXIF tag, etc.).

### 3. Analyze Raw Metadata

When step 1 returns `unrecognized`, examine the `raw` field from the
result:

**PNG** — check each chunk's `keyword` and `text`:

- `parameters`, `prompt`, `workflow`, `Comment` are common keywords
- `tEXt` chunks are Latin-1; `iTXt` chunks are UTF-8
- Note: some tools (e.g., TensorArt, Stability Matrix) write raw UTF-8
  into tEXt chunks, violating the PNG spec. The library's PNG reader
  handles this by falling back to UTF-8 decoding when Latin-1 produces
  mojibake. Be aware of this when inspecting raw chunk data.

**JPEG / WebP** — check each segment's `source` and `data`:

- `exifUserComment`: EXIF UserComment tag
- `exifImageDescription`: EXIF ImageDescription tag
- `exifMake`: EXIF Make tag (used by SwarmUI for node graph)
- `jpegComment`: JPEG COM marker

Determine the data format:

- **JSON** → Likely ComfyUI, NovelAI, TensorArt, Stability Matrix,
  HF Space, or Fooocus
- **A1111-style text** (`prompt\nNegative prompt:\nSteps:, Sampler:`)
  → SD WebUI family or Forge family
- **Other** → New format; document structure thoroughly

### 4. Identify the Tool

Common detection patterns:

| Indicator                                | Tool                 |
|------------------------------------------|----------------------|
| `Software` = "NovelAI" in tEXt           | NovelAI              |
| `workflow` + `prompt` chunks with JSON   | ComfyUI              |
| `sui_image_params` in parameters         | SwarmUI              |
| `generation_data` chunk                  | TensorArt            |
| `smproj` chunk                           | Stability Matrix     |
| `invokeai_metadata` iTXt chunk           | InvokeAI             |
| `Steps:`, `Sampler:` in plain text       | A1111/Forge/SD WebUI |

### 5. Document Findings

When discovering a new tool or format:

1. Place sample in `samples/<format>/<tool_name>.<ext>`
   (C2PA Content Credentials samples go under `samples/c2pa/<format>/`)
2. Document the metadata structure
3. Continue with the `new-tool` skill to implement support
   (failing test first, then parser)

## When Metadata Cannot Be Extracted

If metadata cannot be found despite the file being confirmed to contain it:

1. Re-verify the research procedure
2. Check for new chunk names or data formats not in existing parsers
3. Report to the user with specific findings

The metadata format landscape is constantly evolving - new formats may require new detection logic.
