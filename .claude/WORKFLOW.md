# Development Workflow

Daily development workflow for this project.

## Branch Strategy

| Branch                                     | Purpose                           |
|--------------------------------------------|-----------------------------------|
| `main`                                     | Production-ready code             |
| `release/vX.Y.Z`                           | Development base for next release |
| `feat/*`, `fix/*`, `refactor/*`, `chore/*` | Work branches                     |

## Development Cycle

```text
┌─────────────────────────────────────────────────────┐
│  1. Create work branch from release branch          │
│     git checkout release/vX.Y.Z                     │
│     git checkout -b feat/my-feature                 │
├─────────────────────────────────────────────────────┤
│  2. Make changes                                    │
│     - Write code                                    │
│     - Run tests: pnpm test                          │
│     - Commit changes                                │
├─────────────────────────────────────────────────────┤
│  3. Push and create PR                              │
│     git push -u origin feat/my-feature              │
│     gh pr create --base release/vX.Y.Z              │
├─────────────────────────────────────────────────────┤
│  4. After PR is merged: cleanup                     │
│     git checkout release/vX.Y.Z                     │
│     git pull                                        │
│     git branch -d feat/my-feature                   │
├─────────────────────────────────────────────────────┤
│  5. Next task? Go back to step 1                    │
└─────────────────────────────────────────────────────┘
```

## Important Notes

- **Never commit directly to `main`** - always use PRs
- **Never commit directly to `release/vX.Y.Z`** - use work branches
- **Always return to release branch** after PR merge
- **Delete local branches** after they're merged (cleanup)
- Work branch names should follow conventional prefixes: `feat/`, `fix/`, `refactor/`, `chore/`, `docs/`, `test/`

## When Ready to Release

See [RELEASE.md](./RELEASE.md) for the release workflow.
