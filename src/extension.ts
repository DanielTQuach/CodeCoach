import * as vscode from "vscode";

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