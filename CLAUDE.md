# sd-metadata Project Instructions

Project-specific instructions for Claude Code.

## Overview

TypeScript library for reading and writing AI-generated image metadata.
Supports PNG, JPEG, and WebP formats across 18+ generation tools
(NovelAI, ComfyUI, Stable Diffusion WebUI, Forge, etc.).
Zero dependencies, works in Node.js and browsers.

## Architecture

Data flow:

```text
read(image)  → readers/ → parsers/detect → parsers/* → ParseResult
write(image) → converters/*              → writers/  → Uint8Array
embed(image) → (always A1111 format)     → writers/  → Uint8Array
```

Directory structure:

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
Do not use `npx` or `pnpm exec` when an equivalent npm script exists:

- `pnpm lint` / `pnpm lint:fix` — not `npx biome check`
- `pnpm test` — not `npx vitest run`
- `pnpm typecheck` — not `npx tsc --noEmit`
- `pnpm build` — not `npx tsup`

This ensures the correct locally-installed version is used and avoids version mismatches.
