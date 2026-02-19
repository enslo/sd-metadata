# Release Workflow

Workflow for publishing a new package release.

For daily development workflow, see [WORKFLOW.md](./WORKFLOW.md).

## Prerequisites

- All features and fixes for this release are merged to `main`
- All tests passing on `main`
- Git working directory is clean

## Steps

### 1. Review Changes Since Last Release

```bash
git log --oneline vX.Y.Z..HEAD
```

Determine the version bump:

- **Patch** (x.x.N): Bug fixes only
- **Minor** (x.N.0): New features, backward compatible
- **Major** (N.0.0): Breaking changes

### 2. Create Release Preparation Branch

```bash
git checkout main && git pull
git checkout -b chore/release-vX.Y.Z
```

### 3. Update Release Files

#### Version bump

- **package.json**: Update `"version"` to `X.Y.Z`

#### CHANGELOG

- **CHANGELOG.md**: Add new version entry (see [guidelines](#changelog-guidelines) below)

#### Documentation review

Review all user-facing documentation against the upcoming release and
update as needed. These files are frozen between releases, so this is
the time to bring them up to date:

- **README.md** / **README.ja.md**: Update CDN version URL, and ensure
  API descriptions, usage examples, and feature lists reflect the
  current state of the code
- **docs/types.md** / **docs/types.ja.md**: Ensure type definitions and
  explanations match any added, changed, or removed types

### 4. Commit and Create PR

```bash
git add CHANGELOG.md package.json README.md README.ja.md docs/
git commit -m "chore: release vX.Y.Z"
git push -u origin chore/release-vX.Y.Z
gh pr create --base main --title "chore: release vX.Y.Z" \
  --body "Release preparation for vX.Y.Z. See CHANGELOG.md."
```

After CI passes, squash merge the PR.

### 5. Create GitHub Release

```bash
git checkout main && git pull
gh release create vX.Y.Z --title "vX.Y.Z" \
  --notes-file <(sed -n '/## \[X.Y.Z\]/,/## \[/p' CHANGELOG.md | head -n -1)
```

This creates both the Git tag and GitHub Release.
The publish workflow triggers automatically.

### 6. Verify

- npm: <https://www.npmjs.com/package/@enslo/sd-metadata>
- Demo: <https://sd-metadata.pages.dev/>
- GitHub Actions: check workflow runs

### 7. Clean Up

```bash
git branch -d chore/release-vX.Y.Z
```

## CHANGELOG Guidelines

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
