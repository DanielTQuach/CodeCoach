import type { CodeCoachConfig } from "./config";

/*
 * 0 - 100 score: 100 when both line and file ratios are at or below 1,
 * decreasing as changes grow past configuration thresholds
*/

export function computeHealthScore(
    linesChanged: number,
    filesChanged: number,
    config: CodeCoachConfig
): number {
    const lineRatio = config.lineWarningThreshold > 0 
    ? linesChanged / config.lineWarningThreshold 
    : 0;
    const fileRatio = config.fileWarningThreshold > 0
    ? filesChanged / config.fileWarningThreshold 
    : 0;

    const lineStress = Math.min(1, Math.max(0, lineRatio));
    const fileStress = Math.min(1, Math.max(0, fileRatio));
    const raw = 100 - 45 * lineStress - 45 * fileStress;
    return Math.max(0, Math.min(100, Math.round(raw)));
}