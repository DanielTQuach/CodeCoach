# CodeCoach

## Purpose

Early in collaborative Git work I optimized for shipping fast and treated one issue as one big PR. Reviews got painful, and those long PRs were one version of a broader issue: large diffs and vague commit messages slow down review and make history harder to trust. So I built CodeCoach.

**CodeCoach** is a [Visual Studio Code](https://code.visualstudio.com/) extension. It compares your work to a configurable base branch (for example `main` or `master`), shows line and file scope in the status bar with a simple health score, and nudges you while you work when thresholds or commit-message length suggest splitting the change or writing a clearer message.

## Install

Install from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=daniel-quach.codecoach-me).

In VS Code you can also open the Extensions view, search for **CodeCoach**, or run Quick Open (**Ctrl+P** / **Cmd+P**) and paste:

`ext install daniel-quach.codecoach-me`

## Features

- **Status bar**: Shows lines changed (Δ), files touched, and a **health score** (0–100) derived from how your diff compares to your warning thresholds. Click the item to open the **CodeCoach** output channel with full details (base branch, merge-base, insertions/deletions, dirty state, latest commit).
- **Warnings**: When line or file counts exceed your thresholds, the status bar uses the editor’s warning styling so oversized changes are easy to spot.
- **Nudges**: Optional in-editor messages when you cross line or file thresholds (with a cooldown so you are not spammed), plus a reminder when the latest non-merge commit message is shorter than a minimum length.
- **Live updates**: Refreshes when you save files, switch editors or folders, change settings, or when Git metadata changes (including integration with the built-in Git extension when available).

## Requirements

- VS Code **1.85.0** or newer.
- A **folder workspace** that is a **Git** repository.
- A **local** base branch that exists in that repo (see `codecoach.mainBranchNames` below).

## Development

```bash
npm install
npm run compile
```

Press **F5** in VS Code to launch an **Extension Development Host** with CodeCoach loaded (see `.vscode/launch.json`).

- `npm run watch` runs TypeScript in watch mode while you develop.

## Configuration

All settings live under the `codecoach` section (Settings UI or `settings.json`).

| Setting | Default | Description |
|--------|---------|-------------|
| `codecoach.enabled` | `true` | Master switch for status bar and nudges. |
| `codecoach.lineWarningThreshold` | `400` | Line change count (insertions + deletions vs merge-base) above which the status bar warns and a nudge may fire. |
| `codecoach.fileWarningThreshold` | `10` | File count above which the status bar warns and a nudge may fire. |
| `codecoach.mainBranchNames` | `["main", "master"]` | First name that resolves locally is used as the base branch for diffs. |
| `codecoach.commitMessageMinLength` | `10` | Minimum length for the latest commit subject before a short-message nudge (non-merge commits). |
| `codecoach.nudgeCooldownMinutes` | `45` | Minimum minutes between the same kind of nudge; set to `0` to disable cooldown. |
| `codecoach.statusBarAllignment` | `"left"` | Status bar side: `"left"` or `"right"`. |
| `codecoach.statusBarPriority` | `100` | Priority within that side (higher appears closer to the center). |

**Health score**: Starts at 100 when line and file counts are within thresholds and decreases as counts approach and exceed them (see `src/healthScore.ts`).

## Commands

| Command | ID | Description |
|--------|-----|-------------|
| **CodeCoach: Show details** | `codecoach.showDetails` | Opens the CodeCoach output channel with branch and diff summary. |
| **CodeCoach: Refresh** | `codecoach.refresh` | Forces a refresh of stats and nudges. |

Run **Developer: Reload Window** after local changes if the host does not pick them up.

## How diffs are computed

Stats use `git merge-base HEAD <base>` and then `git diff --shortstat <merge-base>` so you see **all changes on your branch relative to the merge-base** with the chosen mainline branch, not only uncommitted edits.
