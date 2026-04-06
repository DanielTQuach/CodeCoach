import * as vscode from "vscode";
import type { CodeCoachConfig } from "./config";
import type { BranchDiffStats } from "./gitStats";
import { computeHealthScore } from "./healthScore";

export class CodeCoachStatusBar implements vscode.Disposable {
    private item: vscode.StatusBarItem | undefined;
    private layoutKey = "";

    dispose(): void {
        this.item?.dispose();
        this.item = undefined;
    }

    update(stats: BranchDiffStats, config: CodeCoachConfig): void {
        if (!config.enabled) {
            this.item?.hide();
            return;
        }

        const key = `${config.statusBarAlignment}-${config.statusBarPriority}`;
        if (!this.item || key !== this.layoutKey) {
            this.item?.dispose();
            const alignment =
                config.statusBarAlignment === "right"
                ? vscode.StatusBarAlignment.Right
                : vscode.StatusBarAlignment.Left;
            this.item = vscode.window.createStatusBarItem(
                alignment,
                config.statusBarPriority
            );
            this.item.command = "codecoach.showDetails";
            this.layoutKey = key;
        }

        const bar = this.item;

        if (stats.error) {
            bar.text = "$(info) CodeCoach: -";
            bar.tooltip = `CodeCoach\n${stats.error}`;
            bar.backgroundColor = undefined;
            bar.show();
            return;
        }

        const health = computeHealthScore(
            stats.linesChanged,
            stats.filesChanged,
            config
        );

        const dirty = stats.isDirty ? " • working tree dirty" : "";
        bar.text = `$(pulse) ${stats.linesChanged}Δ ${stats.filesChanged}f · ${health}`;
        bar.tooltip = [
            "CodeCoach - change vs base branch",
            `Base: ${stats.baseBranch ?? "?"}`,
            `Branch: ${stats.currentBranch ?? "?"}`,
            `Lines changed: ${stats.linesChanged} (+${stats.insertions} / -${stats.deletions})`,
            `Files changed: ${stats.filesChanged}`,
            `Health score: ${health}/100${dirty}`,
            "",
        ].join("\n")

        const warnLine = stats.linesChanged > config.lineWarningThreshold;
        const warnFiles = stats.filesChanged > config.fileWarningThreshold;
        if (warnLine || warnFiles) {
            bar.backgroundColor = new vscode.ThemeColor(
                "statusBarItem.warningBackground"
            );
        } else {
            bar.backgroundColor = undefined;
        }

        bar.show();
    }
}