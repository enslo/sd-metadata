# Metadata Research Guide

How to investigate the metadata structure of unknown AI-generated images.

## Sample File Locations

| Directory        | Purpose                                     | Git Status |
|------------------|---------------------------------------------|------------|
| `samples/`       | Known/classified samples (source of truth)  | Tracked    |
| `local_samples/` | Unknown/unclassified samples for research   | .gitignore |

> Files in these directories have been pre-verified by the user to contain metadata.

## Research Procedure

### 1. Initial Inspection

Use the Read tool to examine the file as binary. Look for readable text patterns:

```text
Read the file at samples/png/unknown.png
```

For PNG files, look for chunk keywords like `tEXt`, `iTXt` followed by keywords like `parameters`, `prompt`, `workflow`, `Comment`.

### 2. Identify Chunk Structure

**PNG**: Look for text chunks

- `tEXt` - Simple text (Latin-1)
- `iTXt` - International text (UTF-8)

**JPEG**: Look for EXIF or COM segments

- EXIF UserComment
- JPEG COM marker

**WebP**: Similar to JPEG (EXIF-based)

### 3. Extract Metadata Text

Once you identify where metadata is stored, extract and examine the content:

- Is it plain text (A1111 format)?
- Is it JSON (ComfyUI, NovelAI, etc.)?
- What keys/fields are present?

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
3. Create failing test first
4. Implement parser
5. Verify test passes

## When Metadata Cannot Be Extracted

If metadata cannot be found despite the file being confirmed to contain it:

1. Re-verify the research procedure
2. Check for new chunk names or data formats not in existing parsers
3. Report to the user with specific findings

The metadata format landscape is constantly evolving - new formats may require new detection logic.
