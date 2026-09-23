import {
  TaskCardFieldsSchema,
  type TaskCard,
  type TaskCardFields,
  type TaskField,
} from "@/shared/contracts";

// Read the same limits as the API so generated and loaded values stay editable.
export const descriptionMinLength =
  TaskCardFieldsSchema.shape.initialDescription.minLength ?? 0;

export function fieldMaxLength(field: TaskField) {
  return TaskCardFieldsSchema.shape[field].maxLength ?? undefined;
}

export function validBuilderDescription(description: string) {
  return TaskCardFieldsSchema.shape.initialDescription.safeParse(description).success;
}

export function canSaveDraft(fields: TaskCardFields) {
  // A draft may have no title. Publishing has an additional human-review gate.
  return TaskCardFieldsSchema.safeParse(fields).success;
}

export async function publishSavedCard(
  task: TaskCard,
  publish: (id: string, expectedVersion?: number) => Promise<TaskCard>,
): Promise<TaskCard> {
  // PATCH already updates a published task publicly. A second request can fail
  // after the update succeeded and incorrectly turn that success into an error.
  return task.status === "published" ? task : publish(task.id, task.version);
}
