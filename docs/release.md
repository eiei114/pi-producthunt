# Release

This package uses npm Trusted Publishing with GitHub Actions OIDC.

Do not add `NPM_TOKEN` or long-lived npm tokens to GitHub Secrets.

## One-time npm setup

On npmjs.com, configure Trusted Publishing for this package:

- Publisher: GitHub Actions
- Repository: this GitHub repository
- Workflow filename: `publish.yml`

## Release and publish

Merging a package version bump does not create a tag, release, or npm publication.
The release workflow is manually dispatched, and publication is a separate action.

1. After release approval, run **Manual Release** from the `main` branch. It creates a `v<version>` tag and GitHub Release if the tag does not already exist.
2. Separately run **Publish to npm** with `ref` set to that tag (for example, `v0.3.11`). Publishing is started only by this explicit dispatch; publishing a GitHub Release does not trigger npm publication.

The publish workflow runs CI and skips `name@version` if that exact package version already exists on npm.

## GitHub Actions requirements

- `permissions: id-token: write`
- `permissions: contents: write` on Manual Release so it can create a tag and GitHub Release
- GitHub-hosted runner
- Node.js 24, so the release job uses a current npm CLI for Trusted Publishing
- No `NPM_TOKEN`
- `npm publish` from the configured workflow file

## First release checklist

- [ ] `package.json` name is final
- [ ] `repository.url` points to the real GitHub repository
- [ ] npm Trusted Publisher is configured
- [ ] `npm run ci` passes
- [ ] `npm pack --dry-run` contains only intended files
- [ ] `CHANGELOG.md` has the release date
