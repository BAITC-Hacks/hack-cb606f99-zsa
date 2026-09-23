import { z } from "zod";
import {
  AiMetadataSchema,
  ClarifyingQuestionSchema,
  IdSchema,
  TASK_FIELDS,
  TaskCardFieldsSchema,
  TaskFieldSchema,
} from "@/shared/contracts";

const PREFIX = "task-hub:builder-draft:v1:";
const MAX_AGE = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 3;
const MAX_CHARACTERS = 160_000;

// A local draft can be incomplete. Preserve whitespace and allow an empty
// description without weakening the API's validation when the user saves it.
const rawFields = z.object(Object.fromEntries(TASK_FIELDS.map((field) => [
  field,
  z.string().max(TaskCardFieldsSchema.shape[field].maxLength ?? 10000),
])) as Record<(typeof TASK_FIELDS)[number], z.ZodString>);

const SnapshotSchema = z.object({
  taskId: IdSchema.nullable(),
  expectedVersion: z.number().int().positive().nullable(),
  step: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  draft: z.object({
    description: z.string().max(10000),
    industry: z.string().max(200),
    questions: z.array(ClarifyingQuestionSchema).max(12),
    answers: z.partialRecord(TaskFieldSchema, z.string().max(10000)),
    analysisInvalidated: z.boolean(),
  }),
  fields: rawFields,
  confirmed: z.array(TaskFieldSchema).max(TASK_FIELDS.length),
  aiMetadata: AiMetadataSchema.nullable(),
}).refine((value) => (value.taskId === null) === (value.expectedVersion === null));

const StoredSchema = z.object({
  format: z.literal(1),
  savedAt: z.number().int().nonnegative(),
  snapshot: SnapshotSchema,
});

export type BuilderSessionSnapshot = z.infer<typeof SnapshotSchema>;
type SessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

export function getBuilderSessionStorage(): SessionStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

function storageKey(taskId: string | null) {
  return `${PREFIX}${taskId === null ? "new" : `task:${taskId}`}`;
}

function parseStored(raw: string | null, now: number) {
  if (!raw || raw.length > MAX_CHARACTERS) return null;
  try {
    const parsed = StoredSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.savedAt > now || now - parsed.data.savedAt > MAX_AGE) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function readBuilderSession(
  taskId: string | null,
  storage = getBuilderSessionStorage(),
  now = Date.now(),
): BuilderSessionSnapshot | null {
  if (!storage) return null;
  try {
    const key = storageKey(taskId);
    const stored = parseStored(storage.getItem(key), now);
    if (!stored || stored.snapshot.taskId !== taskId) {
      storage.removeItem(key);
      return null;
    }
    return stored.snapshot;
  } catch {
    return null;
  }
}

export function clearBuilderSession(taskId: string | null, storage = getBuilderSessionStorage()) {
  try {
    storage?.removeItem(storageKey(taskId));
  } catch {
    // Storage can be unavailable or become read-only during the session.
  }
}

export function writeBuilderSession(
  snapshot: BuilderSessionSnapshot,
  storage = getBuilderSessionStorage(),
  now = Date.now(),
): boolean {
  if (!storage) return false;
  try {
    const parsed = SnapshotSchema.safeParse(snapshot);
    if (!parsed.success) return false;
    const key = storageKey(snapshot.taskId);
    const serialized = JSON.stringify({ format: 1, savedAt: now, snapshot: parsed.data });
    if (serialized.length > MAX_CHARACTERS) return false;

    // Bound this feature's own records; never remove another feature's storage.
    const older: { key: string; savedAt: number }[] = [];
    for (let index = storage.length - 1; index >= 0; index--) {
      const otherKey = storage.key(index);
      if (!otherKey?.startsWith(PREFIX) || otherKey === key) continue;
      const stored = parseStored(storage.getItem(otherKey), now);
      if (!stored) storage.removeItem(otherKey);
      else older.push({ key: otherKey, savedAt: stored.savedAt });
    }
    older.sort((a, b) => b.savedAt - a.savedAt);
    for (const item of older.slice(MAX_ENTRIES - 1)) storage.removeItem(item.key);
    storage.setItem(key, serialized);
    return true;
  } catch {
    return false;
  }
}

export function builderSessionConflict(snapshot: BuilderSessionSnapshot, currentVersion: number) {
  return snapshot.expectedVersion !== currentVersion;
}
