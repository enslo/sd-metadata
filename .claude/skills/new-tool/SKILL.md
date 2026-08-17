---
name: new-tool
description: Add support for a new AI image generation tool — TDD phases from sample files through software detection, parser, converter, round-trip integration, and lite support. Use when asked to support, add, or implement a new generation tool or metadata format.
argument-hint: <tool-name>
---

# Supporting a New Tool

TDD workflow for adding support for a new generation tool.

Arguments: `$ARGUMENTS` — the name of the tool to support. Sample files
for the tool must exist first; if the metadata format is still unknown,
run the `research` skill before this one.

Follow the phases in order. Each implementation step is test-first:
write the failing test, implement, verify it passes.

## Phase 1: Setup

- Add sample files to `samples/<format>/<tool_name>.<ext>`
- Every file in `samples/` must be covered by sample tests AND
  round-trip tests (see `.claude/TESTING.md`)

## Phase 2: Detection

- Write failing detection test in `packages/core/tests/unit/parsers/detect.test.ts`
- Implement detection in `packages/core/src/parsers/detect.ts`
- Verify test passes

## Phase 3: Parser

- Write failing sample test in `packages/core/tests/samples/parsers/`
- Implement parser in `packages/core/src/parsers/`
- Verify sample test passes
- User reviews expected results

## Phase 4: Converter

- Write failing converter test in `packages/core/tests/unit/converters/`
- Implement converter in `packages/core/src/converters/`
- Verify test passes

## Phase 5: Integration

- Ensure round-trip test covers the new sample
  (`packages/core/tests/integration/round-trip.test.ts`)
- Verify no data loss through read/write cycles

## Phase 6: Lite (if applicable)

- Verify `packages/lite/` can also extract metadata from the new sample
- Add lite sample test if the tool requires special handling in extract()

## Commands

```bash
# Core
pnpm --filter @enslo/sd-metadata test             # Single run
pnpm --filter @enslo/sd-metadata test:watch       # Watch mode
pnpm --filter @enslo/sd-metadata typecheck        # Type check

# Lite
pnpm --filter @enslo/sd-metadata-lite test        # Single run

# Workspace-wide
pnpm lint                                         # Lint check
```

## Quality Bar

Avoid the red flags from `.claude/TESTING.md`:

- Sample test with only existence checks
  (e.g., `expect(keywords).toContain('prompt')`)
- Identical assertions across many samples via `test.each`
- Round-trip tests placed in unit test files
