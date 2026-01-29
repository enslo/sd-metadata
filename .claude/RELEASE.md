# Release Workflow

Workflow for publishing a new package release.

For daily development workflow, see [WORKFLOW.md](./WORKFLOW.md).

## Prerequisites

- All features for this release are merged to `release/vX.Y.Z`
- All tests passing
- Git working directory is clean

## Steps

### 1. Finalize Version

Review the changes and determine the appropriate version:

- **Patch** (x.x.N): Bug fixes only
- **Minor** (x.N.0): New features, backward compatible
- **Major** (N.0.0): Breaking changes

If the release branch name needs to change (e.g., `release/v1.6.0` → `release/v2.0.0`):

```bash
git checkout release/vOLD
git branch -m release/vNEW
git push origin -u release/vNEW
git push origin --delete release/vOLD
```

### 2. Create Release Work Branch

```bash
git checkout release/vX.Y.Z
git pull
git checkout -b chore/release-vX.Y.Z
```

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

Add version link at the bottom:

```markdown
[X.Y.Z]: https://github.com/enslo/sd-metadata/releases/tag/vX.Y.Z
```

### 4. Update package.json

```json
{
  "version": "X.Y.Z"
}
```

### 5. Update README CDN Version

Update the pinned version example in both README files:

- `README.md`
- `README.ja.md`

```markdown
> https://cdn.jsdelivr.net/npm/@enslo/sd-metadata@X.Y.Z/dist/index.js
```

### 6. Commit and Push

```bash
git add CHANGELOG.md package.json README.md README.ja.md
git commit -m "chore: release vX.Y.Z"
git push -u origin chore/release-vX.Y.Z
```

### 7. Create PR to Release Branch

```bash
gh pr create --base release/vX.Y.Z --title "chore: release vX.Y.Z" --body "Release preparation for vX.Y.Z

See CHANGELOG.md for details."
```

After review, merge the PR.

### 8. Create PR to Main

```bash
git checkout release/vX.Y.Z
git pull
gh pr create --base main --title "release vX.Y.Z" --body "Release vX.Y.Z

See CHANGELOG.md for details."
```

After review, merge the PR.

### 9. Create GitHub Release

```bash
git checkout main
git pull
gh release create vX.Y.Z --title "vX.Y.Z" --notes-file <(sed -n '/## \[X.Y.Z\]/,/## \[/p' CHANGELOG.md | head -n -1)
```

`gh release create` automatically creates both the Git tag and the GitHub release.

### 10. Verify Publish & Deploy

**Automated** (triggered by release):

- GitHub Actions publishes to npm
- Cloudflare Pages deploys demo site

**Manual verification**:

- Check npm: <https://www.npmjs.com/package/@enslo/sd-metadata>
- Check demo site: <https://sd-metadata.pages.dev/>
- Verify GitHub Actions succeeded

### 11. Cleanup

```bash
git branch -d release/vX.Y.Z
git branch -d chore/release-vX.Y.Z
```

## Troubleshooting

### npm Publish Fails

Check GitHub Actions logs. Common issues:

- Node.js version too old (need v24+)
- npm Trusted Publisher not configured
- Package version already exists

## Notes

- **Never commit directly to `main` or `release/vX.Y.Z`** - always use PRs
- **Test locally** before creating release
- **Version numbers** follow semantic versioning strictly
- **CHANGELOG** should be user-facing (no internal refactorings unless significant)
