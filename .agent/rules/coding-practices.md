---
trigger: model_decision
description: When writing code
---

# TypeScript

## Principles

- Define types and function interfaces first
- Prefer functions over classes when no internal state is needed
- Use adapter pattern to abstract external dependencies for testability

## Type Usage

- Avoid `any`, use `unknown` and narrow types
- Leverage Utility Types
- Use meaningful type alias names

```typescript
// Good
type UserId = string;
type UserData = { id: UserId; createdAt: Date };

// Bad
type Data = any;
```

## Error Handling

Use Result type for explicit error handling:

```typescript
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

type ParseError =
  | { type: 'invalidFormat'; message: string }
  | { type: 'unsupported'; message: string };

function parseMetadata(data: unknown): Result<Metadata, ParseError> {
  // ...
}
```

## Branded Types

```typescript
type Branded<T, B> = T & { _brand: B };
type Seed = Branded<number, 'Seed'>;
```

# Coding Practices

## Functional Programming

- Prefer pure functions
- Use immutable data structures
- Isolate side effects at function boundaries
- Ensure type safety

## Code Style

- Prefer functions (use classes only when necessary)
- Use immutable update patterns
- Flatten conditionals with early returns
- Keep files under 500 lines

## Implementation Steps

1. **Type Design** - Define types first, express domain in types
2. **Pure Functions First** - Write tests first, implement without external dependencies
3. **Isolate Side Effects** - Push IO operations to boundaries

# Testing (TDD)

## Red-Green-Refactor Cycle

1. **Red**: Write a failing test first
2. **Green**: Implement minimum code to pass
3. **Refactor**: Improve the code

## Writing Tests

Use Arrange-Act-Assert pattern:

```typescript
import { describe, it, expect } from 'vitest';

describe('readMetadata', () => {
  it('should detect NovelAI format', async () => {
    // Arrange
    const sampleData = loadSample('novelai.png');

    // Act
    const result = await readMetadata(sampleData);

    // Assert
    expect(result.tool).toBe('novelai');
  });
});
```

## When Tests Fail

1. Check the failing test and reference the implementation
2. Think step-by-step about why it failed (don't fix blindly)
3. Fix the implementation, add debug logging if needed
4. Remove debug logging after fixing
5. Run full test suite

## Commands

```bash
npm run test        # Watch mode
npm run test:run    # Single run
npm run lint        # Lint check
npm run typecheck   # Type check
```

Pre-commit hooks automatically run lint + typecheck.
