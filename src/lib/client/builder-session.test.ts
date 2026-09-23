import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyTaskFields } from "@/shared/contracts";
import { PlatformService } from "@/server/services/platform";
import { createSeed } from "@/server/repositories/seed";
import type { Database, Repository } from "@/server/repositories/database";
import {
  builderSessionConflict,
  clearBuilderSession,
  getBuilderSessionStorage,
  readBuilderSession,
  writeBuilderSession,
  type BuilderSessionSnapshot,
} from "./builder-session";

class MemoryStorage {
  entries = new Map<string, string>();
  get length() { return this.entries.size; }
  key(index: number) { return [...this.entries.keys()][index] ?? null; }
  getItem(key: string) { return this.entries.get(key) ?? null; }
  setItem(key: string, value: string) { this.entries.set(key, value); }
  removeItem(key: string) { this.entries.delete(key); }
}

class MemoryRepository implements Repository {
  data = createSeed();
  async read() { return structuredClone(this.data); }
  async transaction<T>(change: (data: Database) => T) {
    const copy = structuredClone(this.data);
    const result = change(copy);
    this.data = copy;
    return result;
  }
}

const now = 100_000_000;
function snapshot(taskId: string | null = null): BuilderSessionSnapshot {
  return {
    taskId,
    expectedVersion: taskId ? 1 : null,
    step: 1,
    draft: {
      description: "Нужен учёт заявок сервисного центра",
      industry: "Сервисы",
      questions: [{ id: "result", field: "expectedResult", question: "Что нужно получить?", reason: "Определить результат" }],
      answers: { expectedResult: "  Таблица заявок  " },
      analysisInvalidated: false,
    },
    fields: emptyTaskFields(""),
    confirmed: [],
    aiMetadata: null,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("builder session recovery", () => {
  it("preserves incomplete questions, answers and exact input across navigation", () => {
    const storage = new MemoryStorage();
    const local = snapshot();
    expect(writeBuilderSession(local, storage, now)).toBe(true);
    expect(readBuilderSession(null, storage, now + 1000)).toEqual(local);
    expect(readBuilderSession("other-task", storage, now + 1000)).toBeNull();
  });

  it("keeps editor fields, confirmations and the source version but no publication consent", () => {
    const storage = new MemoryStorage();
    const local = snapshot("task-1");
    local.step = 2;
    local.expectedVersion = 7;
    local.fields = { ...emptyTaskFields(local.draft.description), title: "Заявки", expectedResult: "Нужен список заявок\nс фильтрами  " };
    local.confirmed = ["title", "expectedResult"];
    local.aiMetadata = { provider: "mock", fallback: true, warning: "Проверьте черновик" };
    writeBuilderSession({ ...local, publishConsent: true } as BuilderSessionSnapshot, storage, now);
    expect(readBuilderSession("task-1", storage, now)).toEqual(local);
    expect(builderSessionConflict(local, 7)).toBe(false);
    expect(builderSessionConflict(local, 8)).toBe(true);
    expect([...storage.entries.values()][0]).not.toContain("publishConsent");
  });

  it("cannot overwrite a newer server revision with restored local edits", async () => {
    const service = new PlatformService(new MemoryRepository());
    const { task } = await service.getTask("task-1");
    const local = snapshot(task.id);
    local.expectedVersion = task.version;
    local.fields = { ...emptyTaskFields(task.initialDescription), title: "Локальная правка" };
    const storage = new MemoryStorage();
    writeBuilderSession(local, storage, now);
    const { task: newer } = await service.updateTask(task.id, {
      title: "Изменение коллеги", expectedVersion: task.version,
    });
    const restored = readBuilderSession(task.id, storage, now)!;
    expect(builderSessionConflict(restored, newer.version)).toBe(true);
    await expect(service.updateTask(task.id, {
      ...restored.fields, expectedVersion: restored.expectedVersion,
    })).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    expect((await service.getTask(task.id)).task.title).toBe("Изменение коллеги");
  });

  it("clears only the saved editor's backup", () => {
    const storage = new MemoryStorage();
    writeBuilderSession(snapshot(), storage, now);
    writeBuilderSession(snapshot("task-1"), storage, now);
    clearBuilderSession(null, storage);
    expect(readBuilderSession(null, storage, now)).toBeNull();
    expect(readBuilderSession("task-1", storage, now)).not.toBeNull();
  });

  it("bounds storage to three editors and expires drafts after a day", () => {
    const storage = new MemoryStorage();
    storage.setItem("unrelated-feature", "keep");
    for (let index = 0; index < 4; index++) {
      writeBuilderSession(snapshot(`task-${index}`), storage, now + index);
    }
    expect(storage.length).toBe(4);
    expect(readBuilderSession("task-0", storage, now + 4)).toBeNull();
    expect(readBuilderSession("task-3", storage, now + 4)).not.toBeNull();
    expect(readBuilderSession("task-3", storage, now + 86_400_004)).toBeNull();
    expect(storage.getItem("unrelated-feature")).toBe("keep");
  });

  it("ignores corrupted, oversized and wrongly identified records", () => {
    const storage = new MemoryStorage();
    writeBuilderSession(snapshot(), storage, now);
    const key = storage.key(0)!;
    for (const raw of ["{bad json", "x".repeat(160001), JSON.stringify({ format: 1, savedAt: now, snapshot: snapshot("task-1") })]) {
      storage.setItem(key, raw);
      expect(readBuilderSession(null, storage, now)).toBeNull();
    }
    expect(writeBuilderSession({ ...snapshot(), expectedVersion: 3 }, storage, now)).toBe(false);
  });

  it("does not throw with denied storage or while rendering on the server", () => {
    expect(getBuilderSessionStorage()).toBeUndefined();
    const denied = {
      get length(): number { throw new Error("Denied"); },
      getItem(): string { throw new Error("Denied"); },
      setItem() { throw new Error("Quota exceeded"); },
      removeItem() { throw new Error("Denied"); },
      key(): string { throw new Error("Denied"); },
    };
    expect(readBuilderSession(null, denied)).toBeNull();
    expect(writeBuilderSession(snapshot(), denied)).toBe(false);
    expect(() => clearBuilderSession(null, denied)).not.toThrow();
    vi.stubGlobal("window", { get sessionStorage() { throw new Error("Denied"); } });
    expect(getBuilderSessionStorage()).toBeUndefined();
  });
});
