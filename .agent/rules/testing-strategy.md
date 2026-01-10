---
trigger: model_decision
description: When writing tests
---

# Testing Strategy

## Project Characteristics

This library handles metadata from third-party AI image generation tools. Key characteristics:

1. **Incomplete Information Game**: We cannot know all possible data formats that exist in the real world
2. **External Specifications**: The "truth" is defined by what third-party tools actually output, not by us
3. **Sample Files as Specifications**: Real sample files are the source of truth, not documentation
4. **Backward Compatibility is Critical**: Files created by older versions of tools must continue to work

## Test Architecture

### Three-Layer Testing Approach

```
tests/
├── unit/                           # Logic correctness (synthetic data)
│   ├── readers/
│   │   ├── png.test.ts            # PNG spec compliance (basic functionality)
│   │   ├── jpeg.test.ts           # JPEG spec compliance
│   │   └── webp.test.ts           # WebP spec compliance
│   ├── parsers/
│   │   ├── comfyui.test.ts        # Parsing logic for specific inputs
│   │   └── ...                    # (Small mock data is sufficient)
│   ├── converters/
│   │   └── converter.test.ts      # Conversion logic correctness
│   └── writers/
│       ├── png.test.ts            # Segment → binary conversion correctness
│       ├── jpeg.test.ts
│       └── webp.test.ts
│
├── samples/                        # 🎯 Real-world compatibility (REQUIRED!)
│   ├── readers/
│   │   ├── png.test.ts            # Ensure all PNG samples can be read
│   │   ├── jpeg.test.ts           # Ensure all JPEG samples can be read
│   │   └── webp.test.ts           # Ensure all WebP samples can be read
│   ├── parsers/
│   │   ├── comfyui.test.ts        # Verify ComfyUI samples parse correctly
│   │   ├── novelai.test.ts        # Verify NovelAI samples parse correctly
│   │   └── ...                    # Test each tool with real files
│   └── detection.test.ts          # Software detection accuracy (real files)
│
└── integration/                    # End-to-end guarantees
    ├── round-trip.test.ts         # Ensure no data loss
    ├── format-conversion.test.ts  # Cross-format conversion accuracy
    └── api.test.ts                # Actual usage of read() / write()
```

## Layer Responsibilities

### 1. Unit Tests

**Purpose**: Ensure logic is theoretically correct

**Characteristics**:
- Fast execution
- No external dependencies
- Uses synthetic/mock data
- Tests isolated functionality

**Example**:
```typescript
// unit/parsers/comfyui.test.ts
describe('parseComfyUI', () => {
  it('should extract prompt from workflow widgets_values', () => {
    const mockChunks = [
      { keyword: 'workflow', text: '{"nodes":[...]}' }
    ];
    const result = parseComfyUI(mockChunks);
    expect(result.value.prompt).toBe('expected prompt');
  });
});
```

### 2. Sample Tests ⭐ **Core of This Library**

**Purpose**: Guarantee compatibility with real-world files

**Characteristics**:
- Uses actual files from third-party tools
- Serves as regression tests for backward compatibility
- Documents knowledge about each tool's characteristics
- Discovers edge cases that only appear in real files

**Example**:
```typescript
// samples/parsers/comfyui.test.ts
describe('ComfyUI sample compatibility', () => {
  test.each([
    'comfyui.png',
    'comfyui-hires.png',
    'comfyui-saveimage-plus.png',
  ])('should correctly parse %s', (filename) => {
    const data = loadSample(filename);
    const chunks = readPngMetadata(data);
    const result = parseComfyUI(chunks.value);
    
    expect(result.ok).toBe(true);
    expect(result.value.software).toBe('comfyui');
    expect(result.value.prompt).toBe('expected prompt text');
    // More detailed verification...
  });
});
```

**Critical Process for Sample Tests**:
1. Agent reads sample file binary and writes initial test with expected results
2. User reviews and corrects expectations to match truly expected results
3. This collaborative verification ensures test accuracy

### 3. Integration Tests

**Purpose**: Ensure multiple components work together correctly

**Characteristics**:
- Tests across multiple layers
- Verifies component interface compatibility
- Ensures data integrity
- Tests actual API usage

**Why Round-Trip Tests Belong Here**:
Round-trip tests involve: reader → parser → converter → writer → reader → parser

This is clearly **cross-layer** testing, not unit testing of a single component.

**Example**:
```typescript
// integration/round-trip.test.ts
describe('Round-trip preservation', () => {
  test('ComfyUI PNG survives round-trip', () => {
    const original = loadSample('comfyui.png');
    const metadata = read(original);
    const rewritten = write(original, metadata);
    const reread = read(rewritten.value);
    
    expect(reread).toEqual(metadata); // Exact match
  });
});
```

## Value of Each Layer

### Unit Tests
- ✅ Fast feedback
- ✅ No dependencies
- ✅ Immediately identifies logic bugs
- ⚠️ Cannot guarantee real-world compatibility

### Sample Tests
- ✅ Prevents real-world incompatibilities
- ✅ Guarantees backward compatibility
- ✅ Documents tool-specific characteristics
- ✅ Discovers edge cases from actual files
- ⚠️ Slower than unit tests
- ⚠️ Requires user verification of expectations

### Integration Tests
- ✅ Prevents data loss
- ✅ Ensures API usability
- ✅ Verifies component interactions
- ⚠️ Slowest to execute

## Supporting New Tools

When adding support for a new tool:

1. **Add sample files** to `samples/` directory
2. **Create failing sample test** in `tests/samples/parsers/`
3. **Implement parser** in `src/parsers/`
4. **Add unit tests** in `tests/unit/parsers/` for specific logic
5. **Verify sample test passes**
6. **User reviews** and corrects expected results
7. **Add integration tests** if new format conversion is needed

## Test Maintenance

### When to Update

- **Unit tests**: When changing internal logic
- **Sample tests**: When adding new samples or when tool formats change
- **Integration tests**: When adding new API features or format conversions

### Red Flags

- ❌ Sample test with only existence checks (e.g., `expect(keywords).toContain('prompt')`)
  - Should verify actual content, not just presence
  
- ❌ Identical assertions across many samples via `test.each`
  - Each sample should have unique, meaningful assertions
  
- ❌ Round-trip tests in unit test files
  - Move to `integration/round-trip.test.ts`

## Benefits of This Strategy

1. **Clear Separation of Concerns**
   - Unit tests: fast, isolated, pinpoint bugs
   - Sample tests: real-world compatibility
   - Integration tests: data integrity

2. **Maintainability**
   - Writer bug → check `unit/writers/`
   - Data loss bug → check `integration/round-trip.test.ts`
   - Tool compatibility bug → check `samples/parsers/`

3. **Simplicity Over Optimization**
   - All tests run on every commit (~1 second total execution time)
   - No test splitting needed for this focused library
   - If execution time becomes a bottleneck in the future, consider selective execution

4. **Documentation Through Tests**
   - Sample tests serve as living documentation of tool behavior
   - Integration tests demonstrate API usage patterns
