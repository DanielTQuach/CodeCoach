import * as vscode from "vscode";
import { runGit } from "./gitRunner";

export interface BranchDiffStats {
    baseBranch: string | null;
    mergeBase: string | null;
    filesChanged: number;
    linesChanged: number;
    insertions: number;
    deletions: number;
    currentBranch: string | null;
    isDirty: boolean;
    error: string | null;
}

export interface CommitInfo {
    hash: string | null;
    subject: string | null;
    isMerge: boolean;
}

function parseShortstat(stdout: string): {
    files: number;
    insertions: number;
    deletions: number;
} {
    const text = stdout.trim();
    if (!text) {
        return { files: 0, insertions: 0, deletions: 0 };
    }
    let files = 0;
    const fileMatch = text.match(/(\d+) file(?:s)? changed/);
    if (fileMatch) {
        files = parseInt(fileMatch[1], 10);
    }
    let insertions = 0;
    const insMatch = text.match(/(\d+) insertion(?:s)?/);
    if (insMatch) {
        insertions = parseInt(insMatch[1], 10);
    }
    let deletions = 0;
    const delMatch = text.match(/(\d+) deletion(?:s)?/);
    if (delMatch) {
        deletions = parseInt(delMatch[1], 10);
    }
    return { files, insertions, deletions };
}

async function resolveLocalBaseBranch(
  cwd: string,
  candidates: string[]
): Promise<string | null> {
  for (const name of candidates) {
    try {
      await runGit(cwd, ["rev-parse", "--verify", name]);
      return name;
    } catch {
      // try next
    }
  }
  return null;
}