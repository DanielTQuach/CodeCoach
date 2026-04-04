import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function runGit(
  cwd: string,
  args: string[],
  options?: { maxBuffer?: number }
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync("git", args, {
    cwd,
    maxBuffer: options?.maxBuffer ?? 10 * 1024 * 1024,
  });
}
