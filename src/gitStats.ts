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

export async function getBranchDiffStats(
  cwd: string,
  mainBranchNames: string[]
): Promise<BranchDiffStats> {
  const empty: BranchDiffStats = {
    baseBranch: null,
    mergeBase: null,
    filesChanged: 0,
    linesChanged: 0,
    insertions: 0,
    deletions: 0,
    currentBranch: null,
    isDirty: false,
    error: null,
  };

  try {
    await runGit(cwd, ["rev-parse", "--is-inside-work-tree"]);
  } catch {
    return { ...empty, error: "Not a git repository" };
  }

  let currentBranch: string | null = null;
  try {
    const { stdout } = await runGit(cwd, [
      "rev-parse",
      "--abbrev-ref",
      "HEAD",
    ]);
    currentBranch = stdout.trim() || null;
  } catch {
    currentBranch = null;
  }

  const baseBranch = await resolveLocalBaseBranch(cwd, mainBranchNames);
  if (!baseBranch) {
    return {
      ...empty,
      currentBranch,
      error: `No base branch found (tried: ${mainBranchNames.join(", ")})`,
    };
  }

  let mergeBase: string | null = null;
  try {
    const { stdout } = await runGit(cwd, ["merge-base", "HEAD", baseBranch]);
    mergeBase = stdout.trim() || null;
  } catch {
    mergeBase = null;
  }

  if (!mergeBase) {
    return {
      ...empty,
      baseBranch,
      currentBranch,
      error: "Could not compute merge-base with base branch",
    };
  }

  try {
    const { stdout: wtOut } = await runGit(cwd, [
      "diff",
      "--shortstat",
      mergeBase,
    ]);
    const workingTree = parseShortstat(wtOut);

    const linesChanged = workingTree.insertions + workingTree.deletions;
    let isDirty = false;
    try {
      const { stdout: statusOut } = await runGit(cwd, ["status", "--porcelain"]);
      isDirty = statusOut.trim().length > 0;
    } catch {
      isDirty = true;
    }

    return {
      baseBranch,
      mergeBase,
      filesChanged: workingTree.files,
      linesChanged,
      insertions: workingTree.insertions,
      deletions: workingTree.deletions,
      currentBranch,
      isDirty,
      error: null,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      ...empty,
      baseBranch,
      mergeBase,
      currentBranch,
      error: message,
    };
  }
}

export async function getLatestCommitInfo(cwd: string): Promise<CommitInfo> {
  try {
    const { stdout } = await runGit(cwd, [
      "log",
      "-1",
      "--pretty=format:%H%x00%s%x00%P",
    ]);
    const parts = stdout.trim().split("\0");
    const hash = parts[0] || null;
    const subject = parts[1] || null;
    const parents = (parts[2] || "").trim().split(/\s+/).filter(Boolean);
    const isMerge = parents.length > 1;
    return { hash, subject, isMerge };
  } catch {
    return { hash: null, subject: null, isMerge: false };
  }
}

export function workspaceFolderPath(folder: vscode.WorkspaceFolder): string {
  return folder.uri.fsPath;
}
