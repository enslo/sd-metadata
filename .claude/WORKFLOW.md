# Development Workflow

Daily development workflow for this project.

## Branch Strategy

| Branch                                     | Purpose           |
|--------------------------------------------|-------------------|
| `main`                                     | Production-ready  |
| `feat/*`, `fix/*`, `refactor/*`, `chore/*` | Work branches     |

All work branches branch from and merge back to `main`.
There are no long-lived development or release branches.

## PR Rules

### Merge Method

All PRs are **squash merged**. Merge commits and rebase merges are
disabled at the repository level.

This means:

- Each PR becomes exactly one commit on `main`.
- Commits inside a work branch are free-form (wip, fixup, etc.) —
  they disappear on merge.
- The **PR title** becomes the commit message on `main`.

### PR Title Convention

PR titles MUST follow Conventional Commits:

```text
<type>: <description>
```

| Type       | When to use                            |
|------------|----------------------------------------|
| `feat`     | New feature or capability              |
| `fix`      | Bug fix                                |
| `refactor` | Code change that is not feat nor fix   |
| `docs`     | Documentation only                     |
| `test`     | Adding or updating tests               |
| `chore`    | Maintenance (deps, CI, config, release)|
| `perf`     | Performance improvement                |

Scope is optional: `feat(comfyui): support ControlNet` is fine.

### File Change Constraints

Certain files are only modified in specific PR types.

**Release-only files** — touched exclusively in release preparation PRs:

- `package.json` `"version"` field
- `CHANGELOG.md`
- `README.md` / `README.ja.md` (all changes, including CDN version)
- `docs/**`

Rationale: these files are visible to users on GitHub and npmjs.com.
Changes must correspond to a published version on npm; updating them
between releases would describe code that users cannot install yet.

**Development infrastructure** — may be changed in any PR:

- `.claude/**` (developer workflow docs)
- `.github/**` (CI, dependabot config)
- `CONTRIBUTING.md`

**Everything else** (source, tests, samples, config, deps) is modified
in regular work PRs.

## Development Cycle

```text
1. Start from main:

       git checkout main && git pull
       git checkout -b feat/my-feature

2. Work, commit freely, push:

       git push -u origin feat/my-feature

3. Open a PR targeting main:

       gh pr create --base main

   Set the PR title to Conventional Commits format.

4. After CI passes, squash merge the PR.

5. Clean up locally:

       git checkout main && git pull --prune
       git branch -D feat/my-feature
```

## Post-Merge Cleanup

When a PR is merged, clean up immediately without waiting for
instructions:

```bash
git checkout main && git pull --prune
git branch -D <merged-branch>
```

Remote branches are deleted automatically by GitHub ("Automatically
delete head branches" is enabled). The `--prune` flag removes stale
remote-tracking references from the local repository.

## Important Notes

- **Never commit directly to `main`** — always use PRs
- **Delete local branches** after they are merged
- Work branch names should follow conventional prefixes:
  `feat/`, `fix/`, `refactor/`, `chore/`, `docs/`, `test/`

## When Ready to Release

See [RELEASE.md](./RELEASE.md) for the release workflow.
