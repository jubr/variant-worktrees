import { execFileSync } from "node:child_process";

export interface GitResult {
  ok: boolean;
  status: number;
  stdout: string;
  stderr: string;
}

/** Runs git in `cwd` and reports the outcome instead of throwing; output is kept as git prints it. */
export const runGit = (cwd: string, args: string[]): GitResult => {
  try {
    const stdout = execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, status: 0, stdout, stderr: "" };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { ok: false, status: failure.status ?? 1, stdout: failure.stdout ?? "", stderr: failure.stderr ?? "" };
  }
};

/** Runs git in `cwd` and returns its output; throws with git's message on failure. */
export const git = (cwd: string, args: string[]): string => {
  const result = runGit(cwd, args);
  if (!result.ok) {
    throw new Error(`git ${args.join(" ")} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout;
};
