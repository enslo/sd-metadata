---
trigger: model_decision
description: When conducting metadata research
---

# Metadata Research Rules

## Overview

Procedures for investigating the metadata structure of unknown AI-generated images and determining support scope.

## Research Targets

- `local_samples/` - Unknown/unclassified samples (.gitignore)
- `samples/` - Known/classified samples (Git-managed)

## Metadata Format Categories (PNG)

> [!IMPORTANT]
> The following categories are not exhaustive. If metadata is discovered that does not fit existing categories, consider adding a new category.

| Format | Characteristics | Chunks |
|--------|-----------------|--------|
| **A1111 Format** | Text, Key: Value pairs | `tEXt parameters` |
| **ComfyUI Format** | JSON, node-based | `tEXt prompt`, `tEXt workflow` |
| **NovelAI Format** | JSON, Software=NovelAI | `tEXt Title`, `tEXt Software`, `tEXt Source`, `tEXt Comment` |
| **InvokeAI Format** | JSON, uses iTXt chunks | `iTXt invokeai_metadata`, `iTXt invokeai_graph` |

## Tool Detection Logic

### For A1111 Format

Check `Version:` in `parameters`:

- `Version: neo` → Forge Neo
- `Version: f*.*.*` → Forge
- `Version: v*.*.*` or none → SD WebUI (A1111)

### For ComfyUI Format

Check for additional chunks or keys in JSON:

- `sui_image_params` key in `tEXt parameters` → SwarmUI
- `tEXt generation_data` chunk present → TensorArt
- `tEXt smproj` chunk present → Stability Matrix
- Otherwise → ComfyUI (can identify custom nodes by node names)

### For NovelAI Format

- Identify by `tEXt Software` value = "NovelAI"
- Version info in `tEXt Source` (e.g., "NovelAI Diffusion V4.5 4BDE2A90")
- `tEXt Title` = "NovelAI generated image"

### For InvokeAI Format

- Identify by presence of `iTXt invokeai_metadata` chunk (uses `iTXt`, not `tEXt`)
- Version identifiable via `app_version` field in JSON

## Research Procedure

1. **Binary inspection**: Use `strings -n 20 <file>` to confirm metadata presence
2. **Chunk identification**: Use `xxd <file> | grep -E "tEXt|iTXt"` to identify chunk names
3. **Format classification**: Classify according to the category table above
4. **Tool identification**: Identify using the detection logic
5. **Documentation**: Document new patterns in research documentation

## When Discovering a New Tool

1. Place sample in `samples/png/<tool_name>.png`
2. Document the metadata structure
3. Update detection logic
4. Add parser tasks if support is needed

## When Unable to Extract Metadata

> [!NOTE]
> Files in `samples/` and `local_samples/` have been pre-verified by the user to contain metadata.

If metadata cannot be extracted, consider the following:

1. **A new category may be needed** - A new metadata format that doesn't fit existing categories
2. **Analysis method issue** - Overlooked chunk names or structure

### Response Procedure

1. First, re-verify the research procedure to ensure nothing was overlooked
2. If new chunk names or data formats are found, consider adding a new category
3. If metadata still cannot be extracted, **report to the user with the specific filename**
