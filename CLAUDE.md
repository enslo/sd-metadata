# sd-metadata Project Instructions

Project-specific instructions for Claude Code.

## Overview

pnpm workspace monorepo for reading and writing AI-generated image metadata.
Supports PNG, JPEG, and WebP formats across 18+ generation tools
(NovelAI, ComfyUI, Stable Diffusion WebUI, Forge, etc.).

| Package                                       | Description                                                       |
|-----------------------------------------------|-------------------------------------------------------------------|
| `@enslo/sd-metadata` (`packages/core`)        | Full-featured library with read, write, embed, and stringify APIs |
| `@enslo/sd-metadata-lite` (`packages/lite`)   | Lightweight read-only parser for bookmarklets (~7 KB IIFE)        |

## Architecture

### Repository structure

```text
sd-metadata/
├── packages/
│   ├── core/           @enslo/sd-metadata
│   │   ├── src/
│   │   ├── tests/
│   │   ├── docs/       Type reference (types.md)
│   │   └── package.json
│   └── lite/           @enslo/sd-metadata-lite
│       ├── src/
│       ├── tests/
│       └── package.json
├── samples/            Shared sample files (Git-managed)
├── local_samples/      Research samples (.gitignore)
├── apps/               Demo site
└── CLAUDE.md
```

### Core data flow

```text
read(image)  → readers/ → parsers/detect → parsers/* → ParseResult
write(image) → converters/*              → writers/  → Uint8Array
embed(image) → (always A1111 format)     → writers/  → Uint8Array
```

Core source layout (`packages/core/src/`):

```text
src/
├── api/          Public API (read, write, embed, stringify)
├── readers/      Format-specific extraction (PNG chunks, JPEG/WebP EXIF)
├── parsers/      Software detection + per-tool metadata parsing
├── converters/   Metadata format conversion between tools
├── writers/      Binary encoding (PNG chunks, EXIF segments)
├── utils/        Shared utilities
└── types.ts      All type definitions
```

### Lite data flow

```text
parse(image) → read{Png,Jpeg,Webp} → extract → A1111-format string
```

Lite source layout (`packages/lite/src/`): `index.ts`, `read.ts`, `extract.ts`

## Language

This is a globally released npm package. All content committed to the repository must be in **English**:

- Code comments (including JSDoc)
- Commit messages
- Documentation (README.md, etc.)
- Identifiers (variables, functions, classes)
- Error messages and test descriptions

## Key Documents

- [Development Workflow](.claude/WORKFLOW.md) - Branch strategy, PR rules, daily workflow
- [Release Workflow](.claude/RELEASE.md) - How to create and publish releases
- [Testing Strategy](.claude/TESTING.md) - Three-layer testing approach
- [Metadata Research](.claude/RESEARCH.md) - How to investigate unknown metadata formats

## Sample Files

- `samples/` - Known/classified samples (Git-managed, source of truth)
- `local_samples/` - Unknown/unclassified samples (.gitignore, for research)

## Running Commands

Always prefer scripts defined in `package.json` over invoking tools directly.
Do not use `npx` or `pnpm exec` when an equivalent npm script exists.

### Workspace-level (from repository root)

- `pnpm lint` / `pnpm lint:fix` — lint entire workspace

### Per-package

Use `pnpm --filter <name>` to run package scripts:

- `pnpm --filter @enslo/sd-metadata build`
- `pnpm --filter @enslo/sd-metadata test`
- `pnpm --filter @enslo/sd-metadata-lite build`
- `pnpm --filter @enslo/sd-metadata-lite test`

This ensures the correct locally-installed version is used and avoids version mismatches.
