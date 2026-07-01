import "dotenv/config";

import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";

const databaseUrl = process.env.DATABASE_URL ?? "";

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to back up the database.");
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function pgDumpDatabaseUrl(url: string) {
  const parsed = new URL(url);

  parsed.searchParams.delete("schema");

  return parsed.toString();
}

function databaseConnectionParts(url: string) {
  const parsed = new URL(url);

  return {
    database: parsed.pathname.replace(/^\//, ""),
    password: decodeURIComponent(parsed.password),
    user: decodeURIComponent(parsed.username),
  };
}

const outputPath = resolve(
  process.argv[2] ?? `backups/intranet-${timestamp()}.dump`
);

await mkdir(dirname(outputPath), { recursive: true });

const commonArgs = [
  "--format=custom",
  "--blobs",
  "--verbose",
  "--no-owner",
  "--no-privileges",
];

function runCommand(command: string, args: string[], outputFile?: string) {
  const child = spawn(command, args, {
    stdio: outputFile ? ["ignore", "pipe", "inherit"] : "inherit",
    windowsHide: true,
  });

  if (outputFile && child.stdout) {
    child.stdout.pipe(createWriteStream(outputFile));
  }

  return new Promise<number>((resolveExitCode, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => resolveExitCode(code ?? 1));
  });
}

async function runLocalBackup() {
  return runCommand("pg_dump", [
    ...commonArgs,
    "--file",
    outputPath,
    pgDumpDatabaseUrl(databaseUrl),
  ]);
}

async function runDockerBackup() {
  const { database, password, user } = databaseConnectionParts(databaseUrl);

  return runCommand(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "-e",
      `PGPASSWORD=${password}`,
      "postgres",
      "pg_dump",
      ...commonArgs,
      "-U",
      user,
      "-d",
      database,
    ],
    outputPath
  );
}

let exitCode = 1;

try {
  exitCode = await runLocalBackup();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
    throw error;
  }

  console.log("pg_dump was not found locally. Trying docker compose postgres service...");
  exitCode = await runDockerBackup();
}

if (exitCode !== 0) {
  throw new Error("Database backup failed. Confirm that Postgres is reachable.");
}

console.log(`Database backup saved to ${outputPath}`);
