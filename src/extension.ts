import * as vscode from "vscode";
import { getConfig } from "./config";
import {
    getBranchDiffStats,
    getLatestCommitInfo,
} from "./gitStats";
import { CodeCoachStatusBar } from "./statusBar";
import { NudgeManager } from "./nudges";
import { watch } from "fs";

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
    const nudges = new NudgeManager(context);
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
        const commit = await getLatestCommitInfo(root);
        statusBar.update(stats, config);
        await nudges.evaluate(stats, commit.subject, commit.hash, commit.isMerge, config);
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

    watchGitMetadata(context, scheduleRefresh);
    subscribeBuiltInGit(context, scheduleRefresh);

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
            const commit = await getLatestCommitInfo(root);
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

/* for when git changes without files being saved */
function watchGitMetadata(
    context: vscode.ExtensionContext,
    onChange: () => void
): void {
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
        const head = new vscode.RelativePattern(folder, ".git/HEAD");
        const refs = new vscode.RelativePattern(folder, ".git/refs/heads/**");
        const w1 = vscode.workspace.createFileSystemWatcher(head);
        const w2 = vscode.workspace.createFileSystemWatcher(refs);
        w1.onDidChange(() => onChange());
        w1.onDidCreate(() => onChange());
        w2.onDidChange(() => onChange());
        w2.onDidCreate(() => onChange());
        w2.onDidDelete(() => onChange());
        context.subscriptions.push(w1, w2);
    }
}

function subscribeBuiltInGit(
    context: vscode.ExtensionContext,
    onChange: () => void
): void {
    const ext = vscode.extensions.getExtension("vscode.git");
    if (!ext) {
        return;
    }
    void ext.activate().then(() => {
        const api = ext.exports?.getAPI?.(1) as |
        {
            repositories: unknown[];
            onDidOpenRepository?: (
                cb: (repo: unknown) => void
            ) => vscode.Disposable;
        }
            | undefined;
        if (!api) {
            return;
        }
        const attach = (repo: unknown): void => {
            const r = repo as {
                onDidChange?: (cb: () => void) => vscode.Disposable | void;
            };
            if (!r.onDidChange) {
                return;
            }
            const sub = r.onDidChange(() => onChange());
            if (sub) {
                context.subscriptions.push(sub);
            }
        };
        for (const repo of api.repositories) {
            attach(repo);
        }
        if (api.onDidOpenRepository) {
            context.subscriptions.push(api.onDidOpenRepository(attach));
        }
    });
}

export function deactivate(): void {
    if (refreshTimer) {
        clearTimeout(refreshTimer);
    }
}
