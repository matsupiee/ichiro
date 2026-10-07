import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = realpathSync(fileURLToPath(new URL("../", import.meta.url)));
const processes = execFileSync("ps", ["-axo", "pid=,ppid=,command="], {
  encoding: "utf8",
})
  .trim()
  .split("\n")
  .map((line) => {
    const [, pid, ppid, command] = line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/);
    return { pid: Number(pid), ppid: Number(ppid), command };
  });

const targets = new Set();
for (const { pid, command } of processes) {
  if (
    pid === process.pid ||
    !/(?:\bturbo(?: run)? dev\b|\balchemy(?:\.ts)? dev\b|\bbun(?:\.exe)? (?:run )?dev(?::server)?(?:\s|$))/.test(
      command,
    )
  )
    continue;
  // Match the checkout by its working directory, including orphaned children.
  let cwd;
  try {
    cwd = execFileSync("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split("\n")
      .find((line) => line.startsWith("n"))
      ?.slice(1);
  } catch (error) {
    if (error.status === 1) continue; // Process already exited.
    throw error;
  }
  if (cwd === root || cwd?.startsWith(`${root}/`)) targets.add(pid);
}

// Include workers and other subprocesses so they do not keep ports occupied.
let previousSize;
do {
  previousSize = targets.size;
  for (const { pid, ppid } of processes) {
    if (targets.has(ppid) && pid !== process.pid) targets.add(pid);
  }
} while (targets.size !== previousSize);

function signal(pid, value) {
  try {
    process.kill(pid, value);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
}

if (targets.size === 0) {
  console.log("起動中の開発サーバーはありません。");
} else {
  for (const pid of targets) signal(pid, "SIGINT");
  for (let attempt = 0; attempt < 30 && targets.size > 0; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    for (const pid of targets) if (!signal(pid, 0)) targets.delete(pid);
  }
  if (targets.size > 0) {
    console.error(`停止しなかったプロセスがあります: ${[...targets].join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log("開発サーバーを停止しました。");
  }
}
