# GitHub release workflow setup

1. Copy .github/workflows/release-extension.yml into the root of your extension repository.
2. Make sure all files referenced by manifest.json are committed, including popup.html, popup JS/CSS, minixlsx.js, content.js, page_bridge.js, and any icons.
3. Commit and push the workflow to main.
4. For normal pushes to main, GitHub Actions creates a downloadable ZIP artifact for testing.
5. To publish an official GitHub Release, make sure manifest.json has the intended version, then create and push a matching tag.

Example for version 1.5.0:

git add .

git commit -m "Release v1.5.0"

OR

git commit -m "Fix release tag trigger"

git push origin main
git tag v1.5.0
git push origin v1.5.0

The workflow checks that v1.5.0 matches "version": "1.5.0" in manifest.json.
It then creates:

LinkedIn-Search-Post-Extractor-v1.5.0.zip

and attaches it to the GitHub Release automatically.

If you already created that release tag, push a new version/tag instead (for example 1.5.1 / v1.5.1), or rerun after recreating the tag as appropriate for your repository history.
