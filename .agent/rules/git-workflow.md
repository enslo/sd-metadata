---
trigger: model_decision
description: When working with git
---

# Git Workflow

## Branches

- `main` - Production-ready code
- `feat/*` - Feature additions
- `fix/*` - Bug fixes
- `docs/*` - Documentation only
- `refactor/*` - Code refactoring
- `chore/*` - Maintenance tasks

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <description>
```

Prefixes:

- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Refactoring
- `test:` - Test additions/modifications
- `docs:` - Documentation
- `chore:` - Other changes

## Commit Squashing

Write commit messages based on "what this commit does alone".

When squashing commits via amend or fixup rebase, do not include fix history in the message. Always update the message to reflect the final squashed content.

## Pull Requests

### Workflow

1. Create a feature branch from `main`
2. Make commits following the conventions above
3. Open a PR targeting `main`
4. Request review if needed
5. Squash merge after approval

### Merge Strategy

- Use **squash merge** for feature branches
- PR title should follow Conventional Commits format
- Delete branch after merge

## Releases

For npm package releases:

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Commit: `chore: release vX.Y.Z`
4. Tag: `git tag vX.Y.Z`
5. Push with tags: `git push --follow-tags`

## On Task Completion

```bash
git status
git add <related files>
git commit -m "<appropriate commit message>"
```
