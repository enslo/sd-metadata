# Testing Strategy

## Project Characteristics

This library handles metadata from third-party AI image generation tools. Key characteristics:

1. **Incomplete Information Game**: We cannot know all possible data formats that exist in the real world
2. **External Specifications**: The "truth" is defined by what third-party tools actually output, not by us
3. **Sample Files as Specifications**: Real sample files are the source of truth, not documentation

## Test Architecture

### Three-Layer Testing Approach

```text
tests/
├── unit/                           # Logic correctness (synthetic data)
│   ├── readers/                    # PNG/JPEG/WebP spec compliance
│   ├── parsers/                    # Parsing logic for specific inputs
│   ├── converters/                 # Conversion logic correctness
│   └── writers/                    # Segment → binary conversion
│
├── samples/                        # Real-world compatibility
│   ├── readers/                    # Ensure all samples can be read
│   ├── parsers/                    # Verify samples parse correctly
│   └── detection.test.ts           # Software detection accuracy
│
└── integration/                    # End-to-end guarantees
    ├── round-trip.test.ts          # Ensure no data loss
    ├── format-conversion.test.ts   # Cross-format conversion
    └── api.test.ts                 # Actual usage of read() / write()
```

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

- Tests across multiple layers (read → parse → convert → write)
- Verifies component interface compatibility
- Ensures data integrity through round-trips
- Tests actual API usage

**Rule**: All files in `samples/` must participate in round-trip tests. Failing to preserve metadata through read/write cycles betrays end-user expectations.

Round-trip tests (read → write → read) belong here, not in unit tests.

## Sample Tests vs Integration Tests

Both are equally critical:

| Aspect        | Sample Tests                   | Integration Tests                |
|---------------|--------------------------------|----------------------------------|
| Focus         | Can we read this format?       | Can we preserve this format?     |
| Failure means | We don't understand the format | User data will be lost           |
| Coverage      | All samples in `samples/`      | All samples in `samples/`        |

## Supporting New Tools

Follow TDD for each component:

### Phase 1: Setup

- Add sample files to `samples/`

### Phase 2: Detection

- Write failing detection test
- Implement detection in `src/parsers/detect.ts`
- Verify test passes

### Phase 3: Parser

- Write failing sample test in `tests/samples/parsers/`
- Implement parser in `src/parsers/`
- Verify sample test passes
- User reviews expected results

### Phase 4: Converter

- Write failing converter test
- Implement converter in `src/converters/`
- Verify test passes

### Phase 5: Integration

- Ensure round-trip test covers the new sample
- Verify no data loss through read/write cycles

## Commands

```bash
pnpm test           # Single run
pnpm test:watch     # Watch mode
pnpm typecheck      # Type check
pnpm lint           # Lint check
```

## Red Flags

- Sample in `samples/` not covered by sample tests
- Sample in `samples/` not covered by round-trip tests
- Sample test with only existence checks (e.g., `expect(keywords).toContain('prompt')`)
- Identical assertions across many samples via `test.each`
- Round-trip tests in unit test files
