import * as vscode from "vscode";
import type { CodeCoachConfig } from "./config";
import { BranchDiffStats } from "./gitStats";

const STORAGE_KEY = "codecoach.nudgeState.v1";

interface CooldownState {
    prevLines?: number;
    prevFiles?: number;
    commitHash?: string;
    lastLinesAt?: number;
    lastFilesAt?: number;
    lastCommitAt?: number;
}

export class NudgeManager {
    private state: CooldownState = {};

    constructor(private readonly context: vscode.ExtensionContext) {
        const saved = context.workspaceState.get<CooldownState>(STORAGE_KEY);
        if (saved) {
            this.state = { ...saved };
        }
    }

    private async persist(): Promise<void> {
        await this.context.workspaceState.update(STORAGE_KEY, this.state);
    }

    private canFire(
        kind: "lines" | "files" | "commit",
        config: CodeCoachConfig
    ): boolean {
        const mins = config.nudgeCooldownMinutes;
        if (mins <= 0) {
            return true;
        }
        const ms = mins * 60 * 1000;
        const now = Date.now();
        const last = 
            kind === "lines"
            ? this.state.lastLinesAt
            : kind === "files"
            ? this.state.lastFilesAt
            : this.state.lastCommitAt;
        if (last === undefined) {
            return true;
        }
        return !last || now - last > ms;
    }

    private async mark(kind: "lines" | "files" | "commit"): Promise<void> {
        const now = Date.now();
        if (kind === "lines") {
            this.state.lastLinesAt = now;
        } else if (kind === "files") {
            this.state.lastFilesAt = now;
        } else {
            this.state.lastCommitAt = now;
        }
        await this.persist();
    }

    async evaluate(
        stats: BranchDiffStats,
        commitSubject: string | null,
        commitHash: string | null,
        isMerge: boolean,
        config: CodeCoachConfig
    ): Promise<void> {
        if (!config.enabled) {
            return;
        }
        if (stats.error) {
            return;
        }

        const lines = stats.linesChanged;
        const files = stats.filesChanged;
        const prevLines = this.state.prevLines ?? 0;
        const prevFiles = this.state.prevFiles ?? 0;
        
        const crossedLines = lines > config.lineWarningThreshold && prevLines <= config.lineWarningThreshold;
        const crossedFiles = files > config.fileWarningThreshold && prevFiles <= config.fileWarningThreshold;

        this.state.prevLines = lines;
        this.state.prevFiles = files;

        if (crossedLines && this.canFire("lines", config)) {
            await this.mark("lines");
            const action = "Open CodeCoach settings";
            const picked = await vscode.window.showInformationMessage(
                `CodeCoach: This PR is getting big (${lines} lines vs ${stats.baseBranch}). Consider splitting into smaller changes.`,
                action
            );
            if (picked === action) {
                await vscode.commands.executeCommand(
                    "workbench.action.openSettings",
                    "codecoach.lineWarningThreshold"
                );
            }
        }

        if (crossedFiles && this.canFire("files", config)) {
            await this.mark("files");
            const action = "Open CodeCoach settings";
            const picked = await vscode.window.showInformationMessage(
                `CodeCoach: This change touches too many files (${files} files vs ${stats.baseBranch}). Consider splitting into smaller changes.`,
                action
            );
            if (picked === action) {
                await vscode.commands.executeCommand(
                    "workbench.action.openSettings",
                    "codecoach.fileWarningThreshold"
                );
            }
        }
        
        if (
            !isMerge &&
            commitSubject !== null &&
            commitHash &&
            commitSubject.length < config.commitMessageMinLength
        ) {
            const newCommit = this.state.commitHash !== commitHash;
            if (newCommit && this.canFire("commit", config)) {
                await this.mark("commit");
                await vscode.window.showWarningMessage(
                    "CodeCoach: Add a descriptive commit message so collaborators understand the intent."
                );
            }
            this.state.commitHash = commitHash;
            await this.persist();
        } else if (commitHash) {
            this.state.commitHash = commitHash;
            await this.persist();
        }
    }
}