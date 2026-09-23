import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { AppError } from "../errors";
import { DatabaseSchema, type Database, type Repository } from "./database";
import { withFileLock } from "./file-lock";
import { createSeed } from "./seed";

function hasCode(error: unknown, code: string) {
  return error instanceof Error && "code" in error && error.code === code;
}

export class JsonRepository implements Repository {
  readonly filePath: string;
  constructor(filePath: string, private readonly seed: () => Database = createSeed) {
    this.filePath = resolve(filePath);
  }

  private async load(): Promise<Database> {
    const source = await readFile(this.filePath, "utf8");
    try {
      return DatabaseSchema.parse(JSON.parse(source));
    } catch {
      // Never silently replace a damaged or incompatible user database with demo data.
      throw new AppError(503, "STORAGE_INVALID", "Файл данных повреждён или имеет неподдерживаемый формат.");
    }
  }

  private async write(database: Database) {
    const validated = DatabaseSchema.parse(database);
    const temporary = `${this.filePath}.${randomUUID()}.tmp`;
    try {
      const file = await open(temporary, "wx", 0o600);
      try {
        await file.writeFile(JSON.stringify(validated, null, 2), "utf8");
        await file.sync();
      } finally { await file.close(); }
      await rename(temporary, this.filePath);
    } finally {
      await unlink(temporary).catch((error) => { if (!hasCode(error, "ENOENT")) throw error; });
    }
  }

  private async locked<T>(operation: () => Promise<T>): Promise<T> {
    await mkdir(dirname(this.filePath), { recursive: true });
    return withFileLock(`${this.filePath}.lock`, operation);
  }

  async read(): Promise<Database> {
    try { return await this.load(); }
    catch (error) { if (!hasCode(error, "ENOENT")) throw error; }
    return this.locked(async () => {
      try { return await this.load(); }
      catch (error) { if (!hasCode(error, "ENOENT")) throw error; }
      const database = this.seed();
      await this.write(database);
      return database;
    });
  }

  async transaction<T>(change: (database: Database) => T): Promise<T> {
    return this.locked(async () => {
      let database: Database;
      try { database = await this.load(); }
      catch (error) {
        if (!hasCode(error, "ENOENT")) throw error;
        database = this.seed();
      }
      const result = change(database);
      await this.write(database);
      return result;
    });
  }
}
