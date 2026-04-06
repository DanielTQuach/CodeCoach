import * as vscode from "vscode";
import { getConfig } from "./config";
import { 
    getBranchDiffStats,
    getLatestCommitInfo,
} from "./gitStats";
import { CodeCoachStatusBar } from "./statusBar";

let refreshTimer: ReturnType<typeof setTimeout> | undefined;

function getWorkspaceRoot(): string | undefined {
    const editor = vscode.window.activeTextEditor;
    if (editor?.document.uri.scheme === "file") {
        const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
        if (folder) return folder.uri.fsPath;
    }
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export function activate(context: vscode.ExtensionContext): void {
    const statusBar = new CodeCoachStatusBar();
    const output = vscode.window.createOutputChannel("CodeCoach");

    const runRefresh = async (): Promise<void> => {
        const config = getConfig();
        const root = getWorkspaceRoot();
        if (!root) {
            statusBar.update(
                {
                    baseBranch: null,
                    mergeBase: null,
                    filesChanged: 0,
                    linesChanged: 0,
                    insertions: 0,
                    deletions: 0,
                    currentBranch: null,
                    isDirty: false,
                    error: "Open a folder in VS Code to track git changes",
                },
                config
            );
            return;
        }

        const stats = await getBranchDiffStats(root, config.mainBranchNames);
        statusBar.update(stats, config);
    };

    const scheduleRefresh = (): void => {
        if (refreshTimer) {
            clearTimeout(refreshTimer);
        }
        refreshTimer = setTimeout(() => {
            void runRefresh();
        }, 250);
    };

    context.subscriptions.push(
        statusBar,
        output,
        vscode.workspace.onDidSaveTextDocument(() => scheduleRefresh()),
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("codecoach")) {
                scheduleRefresh();
            }
        }),
        vscode.window.onDidChangeActiveTextEditor(() => scheduleRefresh()),
        vscode.workspace.onDidChangeWorkspaceFolders(() => scheduleRefresh())
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("codecoach.refresh", async () => {
            await runRefresh();
        }),
        vscode.commands.registerCommand("codecoach.showDetails", async () => {
            const config = getConfig();
            const root = getWorkspaceRoot();
            output.clear();
            output.appendLine("CodeCoach - change details");
            output.appendLine("");
            if (!root) {
                output.appendLine("No workspace folder.");
                output.show();
                return;
            }
            const stats = await getBranchDiffStats(root, config.mainBranchNames);
            if (stats.error) {
                output.appendLine(stats.error);
            } else {
                output.appendLine(`Workspace: ${root}`);
                output.appendLine(`Base branch: ${stats.baseBranch}`);
                output.appendLine(`Current branch: ${stats.currentBranch}`);
                output.appendLine(`Merge-base: ${stats.mergeBase}`);
                output.appendLine(
                `Lines: ${stats.linesChanged} (+${stats.insertions} / -${stats.deletions})`
                );
                output.appendLine(`Files: ${stats.filesChanged}`);
                output.appendLine(`Working tree dirty: ${stats.isDirty}`);
                output.appendLine("");
                output.appendLine(
                `Latest commit: ${commit.hash?.slice(0, 7) ?? "?"} ${commit.subject ?? ""}`
                );
            }
            output.show(true);
        })
    );

    void runRefresh();
}

export function deactivate(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }
}
