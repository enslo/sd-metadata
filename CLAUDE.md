# sd-metadata Project Instructions

Project-specific instructions for Claude Code.

## Language

This is a globally released npm package. All content committed to the repository must be in **English**:

- Code comments (including JSDoc)
- Commit messages
- Documentation (README.md, etc.)
- Identifiers (variables, functions, classes)
- Error messages and test descriptions

## Key Documents

- [Release Workflow](.claude/RELEASE.md) - How to create and publish releases
- [Testing Strategy](.claude/TESTING.md) - Three-layer testing approach
- [Metadata Research](.claude/RESEARCH.md) - How to investigate unknown metadata formats

## Sample Files

- `samples/` - Known/classified samples (Git-managed, source of truth)
- `local_samples/` - Unknown/unclassified samples (.gitignore, for research)

## Result Type Pattern

This project uses Result types for explicit error handling:

```typescript
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
```

Always check `result.ok` before accessing `result.value` or `result.error`.
