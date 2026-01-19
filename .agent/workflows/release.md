---
description: How to create and publish a new release
---

# Release Workflow

Complete workflow for creating and publishing a new package release.

## Prerequisites

- All PRs for the release are merged to `main`
- All tests passing
- Git working directory is clean

## Steps

### 1. Plan the Release

Determine version number using semantic versioning:

- **Patch** (x.x.N): Bug fixes only
- **Minor** (x.N.0): New features, backward compatible
- **Major** (N.0.0): Breaking changes

Review merged PRs and prepare CHANGELOG entries.

### 2. Create Release Branch

```bash
git checkout main
git pull
git checkout -b release/vX.Y.Z
```

Replace `X.Y.Z` with your version number (e.g., `1.0.2`).

### 3. Update CHANGELOG.md

Add new version entry at the top:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Fixed
- Description of bug fixes (#PR)

### Added
- Description of new features (#PR)

### Changed
- Description of changes (#PR)
```

Don't forget to add version link at the bottom:

```markdown
[X.Y.Z]: https://github.com/enslo/sd-metadata/releases/tag/vX.Y.Z
```

### 4. Update package.json

Update version in `package.json`:

```json
{
  "version": "X.Y.Z"
}
```

### 5. Update Demo Site Package

Update demo site to use the new version:

```bash
cd demo
```

Edit `demo/package.json`:

```json
{
  "dependencies": {
    "@enslo/sd-metadata": "X.Y.Z"
  }
}
```

Regenerate lockfile:

```bash
npm install
cd ..
```

### 6. Commit and Create PR

```bash
git add CHANGELOG.md package.json demo/package.json demo/package-lock.json
git commit -m "chore: release vX.Y.Z"
git push -u origin release/vX.Y.Z
```

Create PR:

```bash
gh pr create --title "chore: release vX.Y.Z" --body "Release vX.Y.Z

See CHANGELOG.md for details."
```

### 7. Merge Release PR

After review, merge the PR:

```bash
gh pr merge <PR_NUMBER> --squash
```

### 8. Create GitHub Release

Switch to main and create release:

```bash
git checkout main
git pull
gh release create vX.Y.Z --title "vX.Y.Z" --notes-file <(sed -n '/## \[X.Y.Z\]/,/## \[/p' CHANGELOG.md | head -n -1)
```

Or manually copy CHANGELOG content to release notes.

**Note**: `gh release create` automatically creates both the Git tag and the GitHub release.
No need to create the tag separately.

### 9. Verify Publish & Deploy

**Automated steps** (triggered by release):

1. GitHub Actions publishes to npm
2. Demo site deploys after npm publish completes

**Manual verification**:

- Check npm: <https://www.npmjs.com/package/@enslo/sd-metadata>
- Check demo site: <https://sd-metadata.pages.dev/>
- Verify GitHub Actions succeeded

### 10. Cleanup

```bash
git branch -d release/vX.Y.Z
```

## Troubleshooting

### npm Publish Fails

Check GitHub Actions logs. Common issues:

- Node.js version too old (need v24+)
- npm Trusted Publisher not configured
- Package version already exists

### Demo Site Not Updated

Check:

1. Demo site PR merged?
2. Cloudflare Pages deployment succeeded?
3. Browser cache cleared?

## Notes

- **Never commit directly to `main`** - always use PRs
- **Test locally** before creating release
- **Version numbers** follow semantic versioning strictly
- **CHANGELOG** should be user-facing (no internal refactorings unless significant)
