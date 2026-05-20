# Releasing

This project uses semantic versioning and GitHub Releases.

## Version Numbers

Use `MAJOR.MINOR.PATCH`:

- `PATCH`, such as `0.1.1`, for bug fixes, documentation updates worth publishing, dependency maintenance, and non-breaking polish.
- `MINOR`, such as `0.2.0`, for new backwards-compatible tools, endpoint coverage, or configuration options.
- `MAJOR`, such as `1.0.0`, for breaking tool schemas, renamed environment variables without aliases, changed defaults that can affect behavior, or removed capabilities.

While the package is pre-`1.0.0`, still treat changes carefully. A breaking change should usually move at least the minor version, for example `0.1.0` to `0.2.0`.

## Tags and Releases

A Git tag marks the exact commit for a version, for example `v0.1.0`.

A GitHub Release is built from a tag and adds human-readable release notes plus downloadable source archives. The release is what users see on GitHub; the tag is what Git, npm Git installs, and automation can target.

## Checklist

1. Make sure `main` is clean and up to date.
2. Use the repository Node version from `.node-version`:

   ```bash
   node --version
   ```

   Release tooling expects Node 24. Older Node 20 builds can fail in Vitest/Rolldown before publishing.

3. Update `CHANGELOG.md`.
4. Run:

   ```bash
   npm run check
   ```

5. Choose the right version bump:

   ```bash
   npm run version:patch
   npm run version:minor
   npm run version:major
   ```

   These wrap `npm version` and create a commit plus matching Git tag.

6. Push the commit and tag:

   ```bash
   git push origin main --follow-tags
   ```

7. Create a GitHub Release from the tag:

   ```bash
   gh release create vX.Y.Z --title "vX.Y.Z" --notes-file CHANGELOG.md
   ```

   For small releases, writing concise release notes manually is better than pasting the full changelog.

8. Publish to npm:

   ```bash
   npm publish --access public
   ```

   For future releases, prefer the GitHub Actions release workflow with npm trusted publishing enabled for this repository. Trusted publishing uses OIDC and npm generates provenance automatically for public packages. The workflow skips versions that are already present on npm.

9. Verify install:

   ```bash
   npx -y sendpro-flowmailer-mcp
   ```

## Remembering to Version

Do not publish or create a release from an unversioned commit. For this repo, a release always means all three line up:

- `package.json` version
- Git tag, such as `v0.1.0`
- GitHub Release, such as `v0.1.0`

If only code changed on `main`, no release version is needed yet. If users should install a new stable version, create a version tag and release.
