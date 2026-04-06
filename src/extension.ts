import * as vscode from "vscode";
import { getBranchDiffStats } from "./gitStats";

function getWorkspaceRoot(): string | undefined {
    const editor = vscode.window.activeTextEditor;
    if (editor?.document.uri.scheme === "file") {
        const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
        if (folder) return folder.uri.fsPath;
    }
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export function activate(context: vscode.ExtensionContext): void {
    const disposable = vscode.commands.registerCommand("codecoach.hello", () => {
        vscode.window.showInformationMessage("CodeCoach says hello!");
    });
    context.subscriptions.push(disposable);

    const item = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100
    );
    item.text = "$(pulse) CodeCoach";
    item.command = "codecoach.hello";

    const enabled = vscode.workspace
        .getConfiguration("codecoach")
        .get<boolean>("enabled", true);
    if (enabled) {
        item.show();
    }

    context.subscriptions.push(item);

    const refresh = async (): Promise<void> => {
        const root = getWorkspaceRoot();
        if (!root) {
            item.text = "$(info) CodeCoach: no folder";
            item.show();
            return;
        }

        const stats = await getBranchDiffStats(root, ["main", "master"]);
        
        if (stats.error) {
            item.text = "$(warning) CodeCoach: error";
            item.tooltip = stats.error;
        } else {
            item.text = `$(pulse) ${stats.linesChanged}Δ ${stats.filesChanged}f`;
            item.tooltip = `vs ${stats.baseBranch}\nbranch: ${stats.currentBranch}`;
        }
        item.show();
    };

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(() => {
            void refresh();
        })
    )

    void refresh();

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (!e.affectsConfiguration("codecoach.enabled")) {
                return;
            }
            const on = vscode.workspace
                .getConfiguration("codecoach")
                .get<boolean>("enabled", true);
            if (on) {
                item.show();
            } else {
                item.hide();
            }
        })
    );
}

export function deactivate(): void { }