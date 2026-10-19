# GitHub Agentic Workflows

This repository includes a manually triggered, read-only repository baseline workflow at `.github/workflows/repository-baseline.md`. It summarizes the project structure and configured development checks without changing files or opening issues or pull requests.

It also includes `.github/workflows/mona-github-info-website.md`, which reviews the CRM's GitHub-connected profile UI weekly or on manual dispatch and can prepare at most one draft PR for a grounded, focused website improvement. Its PR body cites the tracked source files and line ranges actually reviewed, explains how that evidence supports the proposed change, and records files changed and validation. It does not assume the app is a separate Mona-owned site or invent personal profile details.

## Set up

1. Enable GitHub Actions for the repository.
2. Install the GitHub CLI and the official Agentic Workflows extension:

   ```sh
   gh extension install github/gh-aw
   ```

3. Configure Copilot authentication for Actions. One option is to create a fine-grained personal access token with the **Copilot Requests: Read** account permission and save it as the repository Actions secret `COPILOT_GITHUB_TOKEN`.
4. Compile the workflow and commit both its Markdown source and generated lock file:

   ```sh
   gh aw compile repository-baseline
   gh aw compile mona-github-info-website
   git add .gitattributes .github/workflows/repository-baseline.md .github/workflows/repository-baseline.lock.yml .github/workflows/mona-github-info-website.md .github/workflows/mona-github-info-website.lock.yml docs/agentic-workflows.md
   ```

After the compiled workflow is available on GitHub, run **Repository Baseline** manually from the repository's **Actions** tab. It does not run on a schedule or on code changes.

The Markdown file is the editable source. Re-run `gh aw compile repository-baseline` after changing its YAML frontmatter, and commit the regenerated `.lock.yml` file with the source.

The website-update workflow uses a draft-only pull-request safe output and does not fall back to creating issues. Review each proposed draft before marking it ready or merging it.

## Safety policy

Both workflows deny agent network access and give the agent only the repository permissions required for their task. The baseline workflow runs only on manual dispatch. The website-update workflow runs weekly or manually; its write-capable safe-output job can create only one draft PR, and the PR fallback to an issue is disabled. The gh-aw v0.92 compiler also assigns `issues: write` to activation and conclusion helper jobs; these do not process agent output. The baseline workflow explicitly gates off its generated safe-output job.
