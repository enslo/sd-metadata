# Release Workflow

Workflow for publishing package releases.

For daily development workflow, see [WORKFLOW.md](./WORKFLOW.md).

## Packages and Versioning

Each package is versioned and released independently:

| Package                   | Tag format    | CHANGELOG                      |
|---------------------------|---------------|--------------------------------|
| `@enslo/sd-metadata`      | `core@X.Y.Z`  | `packages/core/CHANGELOG.md`   |
| `@enslo/sd-metadata-lite` | `lite@X.Y.Z`  | `packages/lite/CHANGELOG.md`   |

> Tags before the monorepo migration (v2.1.0 and earlier) used the
> `vX.Y.Z` format. These are legacy tags for the core package.

## Prerequisites

- All features and fixes for this release are merged to `main`
- All tests passing on `main`
- Git working directory is clean

## Steps

Throughout this guide, `<pkg>` refers to either `core` or `lite`.

### 1. Review Changes Since Last Release

```bash
git log --oneline <pkg>@X.Y.Z..HEAD -- packages/<pkg>/
```

Determine the version bump:

- **Patch** (x.x.N): Bug fixes only
- **Minor** (x.N.0): New features, backward compatible. Adding new members to
  TypeScript union types (`GenerationSoftware`, `MetadataSegmentSource`) is a
  minor change — these are documented as "Potentially Breaking Changes" in the
  CHANGELOG to alert TypeScript users with exhaustive patterns.
- **Major** (N.0.0): Breaking changes

### 2. Create Release Preparation Branch

```bash
git checkout main && git pull
git checkout -b chore/release-<pkg>-vX.Y.Z
```

### 3. Update Release Files

#### Version bump

- `packages/<pkg>/package.json`: Update `"version"` to `X.Y.Z`

#### CHANGELOG

- `packages/<pkg>/CHANGELOG.md`: Add new version entry
  (see [guidelines](#changelog-guidelines) below)

#### Documentation review

Review all user-facing documentation for the package and update as
needed. These files are frozen between releases, so this is the time
to bring them up to date:

**Core:**

- `packages/core/README.md` / `README.ja.md`: Update CDN version URL,
  and ensure API descriptions, usage examples, and feature lists reflect
  the current state of the code
- `packages/core/docs/types.md` / `types.ja.md`: Ensure type definitions
  and explanations match any added, changed, or removed types

**Lite:**

- `packages/lite/README.md` / `README.ja.md`: Update CDN version URL
  and bundle size if changed

**Root (if needed):**

- `README.md` / `README.ja.md`: Update the comparison table or package
  descriptions if a release introduces user-visible feature changes

### 4. Commit and Create PR

```bash
git add packages/<pkg>/ README.md README.ja.md
git commit -m "chore: release <pkg>@X.Y.Z"
git push -u origin chore/release-<pkg>-vX.Y.Z
gh pr create --base main --title "chore: release <pkg>@X.Y.Z" \
  --body "Release preparation for <pkg>@X.Y.Z. See CHANGELOG.md."
```

After CI passes, squash merge the PR.

### 5. Create GitHub Release

**Core:**

```bash
git checkout main && git pull
gh release create core@X.Y.Z --title "core@X.Y.Z" \
  --notes-file <(sed -n '/## \[X.Y.Z\]/,/## \[/p' packages/core/CHANGELOG.md | head -n -1)
```

**Lite:**

```bash
git checkout main && git pull
gh release create lite@X.Y.Z --title "lite@X.Y.Z" \
  --notes-file <(sed -n '/## \[X.Y.Z\]/,/## \[/p' packages/lite/CHANGELOG.md | head -n -1)
```

This creates both the Git tag and GitHub Release.
The publish workflow triggers automatically.

### 6. Verify

- **Core**: <https://www.npmjs.com/package/@enslo/sd-metadata>
- **Lite**: <https://www.npmjs.com/package/@enslo/sd-metadata-lite>
- Demo: <https://sd-metadata.pages.dev/>
- Demo (lite): <https://sd-metadata-lite.pages.dev/>
- GitHub Actions: check workflow runs

### 7. Clean Up

```bash
git branch -D chore/release-<pkg>-vX.Y.Z
```

## CHANGELOG Guidelines

Applies to both packages (`packages/*/CHANGELOG.md`).

Format: [Keep a Changelog](https://keepachangelog.com/)

Write for **library users**, not contributors:

- **Include**: features, bug fixes, breaking changes, deprecations
- **Include**: security-relevant dependency updates (with advisory ID)
- **Summarize**: routine dependency updates in a single line under
  Maintenance (e.g., "Update development dependencies")
- **Omit**: internal refactoring, CI changes, developer tooling updates
  that do not affect the published package

Example:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- **Feature name** (#PR): User-facing description

### Potentially Breaking Changes
- **New `GenerationSoftware` member** (#PR): `'new-tool'` added.
  TypeScript users with exhaustive `switch` or `Record<GenerationSoftware, ...>`
  will need to handle the new value.

### Fixed
- **Bug description** (#PR): What was wrong and how it is fixed

### Maintenance
- Update development dependencies
- **vitest**: v4.0 -> v5.0 (security fix: GHSA-xxxx)
```

## Troubleshooting

### npm Publish Fails

Check GitHub Actions logs. Common issues:

- Node.js version too old (need v24+)
- npm Trusted Publisher not configured
- Package version already exists on npm

## Notes

- **Never commit directly to `main`** — always use PRs
- **Test locally** before creating release
- **Version numbers** follow semantic versioning strictly
- **Release preparation PRs** contain only version-related file updates
  and documentation updates; code changes must be merged in separate PRs
  beforehand
- Each package has its own publish workflow
  (`publish-core.yml` / `publish-lite.yml`)
