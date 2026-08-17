# Testing Strategy

## Project Characteristics

This library handles metadata from third-party AI image generation tools. Key characteristics:

1. **Incomplete Information Game**: We cannot know all possible data formats that exist in the real world
2. **External Specifications**: The "truth" is defined by what third-party tools actually output, not by us
3. **Sample Files as Specifications**: Real sample files are the source of truth, not documentation

## Test Architecture

### Core: Three-Layer Testing Approach

```text
packages/core/tests/
├── helpers/                        # Shared test utilities
├── unit/                           # Logic correctness (synthetic data)
│   ├── api/                        # embed/stringify/image input handling
│   ├── readers/                    # PNG/JPEG/WebP spec compliance
│   ├── parsers/                    # Parsing logic + software detection
│   ├── converters/                 # Conversion logic correctness
│   ├── writers/                    # Segment -> binary conversion
│   └── utils/                      # Shared utility functions
│
├── samples/                        # Real-world compatibility
│   ├── api/                        # API behavior against real samples
│   ├── readers/                    # Ensure all samples can be read
│   ├── parsers/                    # Verify samples parse correctly
│   └── c2pa.test.ts                # C2PA Content Credentials samples
│
└── integration/                    # End-to-end guarantees
    ├── round-trip.test.ts          # Ensure no data loss
    ├── format-conversion.test.ts   # Cross-format conversion
    ├── api.test.ts                 # Actual usage of read() / write()
    └── embed.test.ts               # embed() end-to-end
```

### Lite

```text
packages/lite/tests/
├── read.test.ts                    # parse() vs core read()+stringify() on all samples
├── c2pa.test.ts                    # C2PA detection
└── bundle.test.ts                  # Built IIFE/ESM bundles match source behavior
```

Lite tests verify that `parse()` returns correct A1111-format text for
all supported image formats and generation tools. Sample files are
shared from the root `samples/` directory.

## Layer Responsibilities

### 1. Unit Tests

**Purpose**: Ensure logic is theoretically correct

**Characteristics**:

- Fast execution
- No external dependencies
- Uses synthetic/mock data
- Tests isolated functionality

### 2. Sample Tests

**Purpose**: Guarantee compatibility with real-world files

**Characteristics**:

- Uses actual files from third-party tools
- Documents knowledge about each tool's characteristics
- Discovers edge cases that only appear in real files

**Rule**: All files in `samples/` must participate in sample tests. These files are curated and meaningful - each must be correctly interpreted.

### 3. Integration Tests

**Purpose**: Ensure multiple components work together correctly

**Characteristics**:

- Tests across multiple layers (read -> parse -> convert -> write)
- Verifies component interface compatibility
- Ensures data integrity through round-trips
- Tests actual API usage

**Rule**: All files in `samples/` must participate in round-trip tests. Failing to preserve metadata through read/write cycles betrays end-user expectations.

Round-trip tests (read -> write -> read) belong here, not in unit tests.

## Sample Tests vs Integration Tests

Both are equally critical:

| Aspect        | Sample Tests                   | Integration Tests                |
|---------------|--------------------------------|----------------------------------|
| Focus         | Can we read this format?       | Can we preserve this format?     |
| Failure means | We don't understand the format | User data will be lost           |
| Coverage      | All samples in `samples/`      | All samples in `samples/`        |

## Supporting New Tools

Follow the `new-tool` skill (`.claude/skills/new-tool/SKILL.md`) — it
walks through the TDD phases from sample files to lite support.

## Commands

```bash
# Core
pnpm --filter @enslo/sd-metadata test             # Single run
pnpm --filter @enslo/sd-metadata test:watch       # Watch mode
pnpm --filter @enslo/sd-metadata typecheck        # Type check

# Lite
pnpm --filter @enslo/sd-metadata-lite test        # Single run
pnpm --filter @enslo/sd-metadata-lite test:watch  # Watch mode

# Workspace-wide
pnpm lint                                         # Lint check
```

## Red Flags

- Sample in `samples/` not covered by sample tests
- Sample in `samples/` not covered by round-trip tests
- Sample test with only existence checks (e.g., `expect(keywords).toContain('prompt')`)
- Identical assertions across many samples via `test.each`
- Round-trip tests in unit test files
