---
description: Draft a small, evidence-based website update for the GitHub profile integration.

on:
  schedule: weekly
  workflow_dispatch:

permissions:
  contents: read
  issues: none
  pull-requests: none

engine: copilot

network: {}

tools:
  edit:
  bash: ["cat", "find", "grep", "ls", "wc"]

safe-outputs:
  create-pull-request:
    title-prefix: "[website] "
    draft: true
    max: 1
    fallback-as-issue: false
    base-branch: main
---

# Mona's GitHub Info Website

Prepare at most one small draft pull request with a useful, verifiable improvement to the website's GitHub profile integration.

## Scope

This workflow runs in the Customer & Marketing CRM repository. Treat the GitHub-connected profile UI in `src/components/BillingManagement.tsx` as the target surface. Read related source only when needed to understand existing behavior. Do not assume this repository contains a separate Mona-owned website or that the connected GitHub account belongs to Mona.

Inspect the existing implementation and its documentation for a clear website improvement, such as making the connected profile or repository information easier to understand, improving a relevant empty/loading/error state, or correcting a demonstrable UI inconsistency. Do not make changes just to produce a pull request. If the repository does not support a specific improvement, report that and make no changes.

## Accuracy and privacy

- Use only facts already present in tracked source and documentation. Do not invent Mona's identity, GitHub handle, biography, repositories, activity, or other personal details.
- Do not call external services, read environment or secret files, or inspect customer records, runtime data, credentials, or generated build output.
- Do not broaden OAuth scopes, change authentication or server API behavior, or modify billing behavior.
- Keep changes limited to the targeted profile UI and directly related user-facing documentation. Do not change unrelated CRM features, dependencies, or generated files.
- Preserve the existing visual language and accessibility conventions. Avoid displaying private account details.

## Review and output

Make one focused change only when its value is clear from the repository. Inspect the resulting diff and run relevant checks only if their dependencies are already available; do not install packages or execute application services. Do not claim checks passed unless they actually ran.

If you make a change, request one **draft** pull request with a concise summary, rationale, affected files, and any checks not run. Never merge, publish, or mark the pull request ready for review. If there is no well-supported improvement, make no changes and summarize why in the workflow run.
