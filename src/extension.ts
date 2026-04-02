import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {
    const disposable = vscode.commands.registerCommand("codecoach.hello", () => {
        vscode.window.showInformationMessage("CodeCoach says hello!");
    });

    context.subscriptions.push(disposable);
}

export function deactivate(): void { }