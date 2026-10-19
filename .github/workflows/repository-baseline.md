---
description: Manually review the repository structure and development commands without making changes.

on:
  workflow_dispatch:

permissions:
  contents: read
  issues: none
  pull-requests: none

engine: copilot

network: {}

tools:
  bash: ["cat", "find", "grep", "ls", "wc"]

jobs:
  safe_outputs:
    if: "false"
---

# Repository Baseline

Provide maintainers with a concise, factual snapshot of this repository.

Inspect only tracked documentation, source, and configuration files needed to identify:

- The application's purpose and main technologies.
- Its top-level structure and important entry points.
- Available build, lint, and test commands.
- Existing CI or GitHub Actions checks, if present.

Use read-only inspection only. Do not execute project scripts, read environment or secret files, inspect customer or user data, access external services, or modify the repository. If a requested detail is not documented or configured, say so rather than guessing.

Return the findings as a short report in the workflow run output, with a separate note for any missing baseline checks.
