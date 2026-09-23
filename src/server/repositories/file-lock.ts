import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, readdir, rename, rmdir, unlink } from "node:fs/promises";
import { hostname } from "node:os";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { AppError } from "../errors";

interface LockOwner {
  version: 1;
  token: string;
  pid: number;
  hostname: string;
}

function hasCode(error: unknown, ...codes: string[]) {
  return error instanceof Error && "code" in error && codes.includes(String(error.code));
}

function invalidLock(): never {
  // Unknown ownership is NOT evidence that a lock is stale (including legacy empty files).
  throw new AppError(503, "STORAGE_LOCK_INVALID", "Не удалось проверить владельца блокировки хранилища. Остановите все экземпляры сервера и проверьте lock-файл перед повторным запуском.");
}

function parseOwner(source: string, filename: string): LockOwner {
  let value: unknown;
  try { value = JSON.parse(source); } catch { return invalidLock(); }
  if (!value || typeof value !== "object") return invalidLock();
  const owner = value as Partial<LockOwner>;
  if (owner.version !== 1 || typeof owner.token !== "string"
    || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(owner.token)
    || filename !== `owner-${owner.token}.json`
    || !Number.isSafeInteger(owner.pid) || owner.pid! <= 0 || owner.pid! > 0x7fffffff
    || owner.hostname !== hostname()) return invalidLock();
  return owner as LockOwner;
}

function ownerIsDead(pid: number) {
  try { process.kill(pid, 0); return false; }
  catch (error) {
    // EPERM/unknown errors, or a reused PID, must fail closed: never evict a possibly live owner.
    return hasCode(error, "ESRCH");
  }
}

async function removeEmptyDirectory(path: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try { await rmdir(path); return; }
    catch (error) {
      // Another contender can already have atomically published its NONEMPTY lock here.
      if (hasCode(error, "ENOENT", "ENOTEMPTY", "EEXIST")) return;
      // Windows can temporarily keep a just-unlinked directory in delete-pending state.
      if (!hasCode(error, "EPERM", "EACCES")) throw error;
      await setTimeout(5);
    }
  }
}

async function lockExists(lockPath: string) {
  let existing;
  try { existing = await lstat(lockPath); }
  catch (error) {
    if (hasCode(error, "ENOENT")) return false;
    if (hasCode(error, "EPERM", "EACCES")) return true;
    throw error;
  }
  if (!existing.isDirectory()) invalidLock();
  return true;
}

async function recoverDeadOwner(lockPath: string) {
  let filenames: string[];
  try { filenames = await readdir(lockPath); }
  catch (error) {
    if (hasCode(error, "ENOENT", "EPERM", "EACCES")) return;
    if (hasCode(error, "ENOTDIR")) return invalidLock();
    throw error;
  }
  // Only removal/recovery can leave an empty directory: acquisition publishes it fully populated.
  if (filenames.length === 0) return removeEmptyDirectory(lockPath);
  if (filenames.length !== 1) return invalidLock();
  const filename = filenames[0];
  let source: string;
  try { source = await readFile(join(lockPath, filename), "utf8"); }
  catch (error) {
    // A concurrent release can leave a Windows file temporarily delete-pending. Retry the lock.
    if (hasCode(error, "ENOENT", "EPERM", "EACCES")) return;
    throw error;
  }
  const owner = parseOwner(source, filename);
  if (!ownerIsDead(owner.pid)) return;
  try { await unlink(join(lockPath, filename)); }
  catch (error) {
    // A competing recovery already removed THIS owner. Do not touch its replacement.
    if (hasCode(error, "ENOENT", "EPERM", "EACCES")) return;
    throw error;
  }
  await removeEmptyDirectory(lockPath);
}

/** Single-host filesystem mutex. A live owner is never evicted merely for being slow. */
export async function withFileLock<T>(
  lockPath: string,
  operation: () => Promise<T>,
  options: { timeoutMs?: number; retryMs?: number } = {},
): Promise<T> {
  const owner: LockOwner = { version: 1, token: randomUUID(), pid: process.pid, hostname: hostname() };
  const filename = `owner-${owner.token}.json`;
  const candidate = `${lockPath}.${owner.token}.candidate`;
  const deadline = Date.now() + (options.timeoutMs ?? 5000);
  let acquired = false;
  await mkdir(candidate, { mode: 0o700 });
  try {
    const file = await open(join(candidate, filename), "wx", 0o600);
    try {
      await file.writeFile(JSON.stringify(owner), "utf8");
      await file.sync();
    } finally { await file.close(); }

    while (!acquired) {
      // Do not rename over a legacy file (Windows permits directory-to-file replacement).
      // Upgrades must stop old servers first; mixed legacy/new locking protocols are unsupported.
      if (await lockExists(lockPath)) {
        await recoverDeadOwner(lockPath);
      } else {
        try {
          // Atomic publication avoids a window with an empty, apparently ownerless active lock.
          // Renaming a directory cannot replace another nonempty lock directory.
          await rename(candidate, lockPath);
          acquired = true;
        } catch (error) {
          if (!hasCode(error, "EEXIST", "ENOTEMPTY", "EPERM", "EACCES")) throw error;
        }
      }
      if (acquired) break;
      if (Date.now() >= deadline) {
        throw new AppError(503, "STORAGE_BUSY", "Хранилище занято. Повторите запрос позже.");
      }
      await setTimeout(options.retryMs ?? 20);
    }
    return await operation();
  } finally {
    const directory = acquired ? lockPath : candidate;
    // The unique filename prevents delayed cleanup from deleting a subsequent owner's metadata.
    await unlink(join(directory, filename)).catch((error) => { if (!hasCode(error, "ENOENT")) throw error; });
    await removeEmptyDirectory(directory);
  }
}
