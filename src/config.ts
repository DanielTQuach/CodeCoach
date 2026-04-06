import * as vscode from "vscode";

const SECTION = "codecoach";

export interface CodeCoachConfig {
    enabled: boolean;
    lineWarningThreshold: number;
    fileWarningThreshold: number;
    mainBranchNames: string[];
    commitMessageMinLength: number;
    nudgeCooldownMinutes: number;
    statusBarAllignment: "left" | "right";
    statusBarPriority: number;
}

export function getConfig(): CodeCoachConfig {
    const c = vscode.workspace.getConfiguration(SECTION);
    return {
        enabled: c.get<boolean>("enabled", true),
        lineWarningThreshold: c.get<number>("lineWarningThreshold", 400),
        fileWarningThreshold: c.get<number>("fileWarningThreshold", 10),
        mainBranchNames: c.get<string[]>("mainBranchNames", ["main", "master"]),
        commitMessageMinLength: c.get<number>("commitMessageMinLength", 10),
        nudgeCooldownMinutes: c.get<number>("nudgeCooldownMinutes", 45),
        statusBarAllignment: c.get<"left" | "right">("statusBarAllignment", "left"),
        statusBarPriority: c.get<number>("statusBarPriority", 100),
    };
}