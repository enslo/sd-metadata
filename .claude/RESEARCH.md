# Metadata Research Guide

How to investigate the metadata structure of unknown AI-generated images.

## Sample File Locations

| Directory        | Purpose                                     | Git Status |
|------------------|---------------------------------------------|------------|
| `samples/`       | Known/classified samples (source of truth)  | Tracked    |
| `local_samples/` | Unknown/unclassified samples for research   | .gitignore |

> Files in these directories have been pre-verified by the user to contain metadata.

## Research Procedure

### 1. Read with the Library API

Always start here. Run the library's `read()` against the unknown file:

```bash
npx tsx -e "
import { readFileSync } from 'fs';
import { read } from './packages/core/src/index.ts';
const result = read(new Uint8Array(readFileSync('LOCAL_SAMPLE_PATH')));
console.log(JSON.stringify(result, null, 2));
"
```

Interpret the result:

| `status`       | Meaning                                   | Next step              |
|----------------|-------------------------------------------|------------------------|
| `success`      | Known tool, fully parsed                  | Review parsed metadata |
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
2. Document the metadata structure
3. Create failing test first in `packages/core/tests/`
4. Implement parser in `packages/core/src/parsers/`
5. Verify test passes

## When Metadata Cannot Be Extracted

If metadata cannot be found despite the file being confirmed to contain it:

1. Re-verify the research procedure
2. Check for new chunk names or data formats not in existing parsers
3. Report to the user with specific findings

The metadata format landscape is constantly evolving - new formats may require new detection logic.
