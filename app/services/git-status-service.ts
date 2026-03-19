import { execFile } from "node:child_process";

export type GitStatus = {
  modified: number;
  added: number;
  deleted: number;
  untracked: number;
  total: number;
};

export function getGitStatusAsync(repoPath: string): Promise<GitStatus | null> {
  return new Promise((resolve) => {
    execFile(
      "git",
      ["status", "--porcelain"],
      { cwd: repoPath, encoding: "utf-8" },
      (error, stdout) => {
        if (error) {
          resolve(null);
          return;
        }
        const lines = stdout.split("\n").filter((l) => l.length > 0);
        let modified = 0;
        let added = 0;
        let deleted = 0;
        let untracked = 0;
        for (const line of lines) {
          const code = line.substring(0, 2);
          if (code === "??") {
            untracked++;
          } else if (code.includes("D")) {
            deleted++;
          } else if (code.includes("A")) {
            added++;
          } else {
            modified++;
          }
        }
        resolve({ modified, added, deleted, untracked, total: lines.length });
      }
    );
  });
}
