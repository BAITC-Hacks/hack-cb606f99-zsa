import { FIELD_LABELS, type FieldKey } from "./model";

// Shared by HTTP and offline adapters so forms can handle the same error codes.
export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public details: { path: string; message: string }[] = [],
  ) {
    const hints = details.map(
      ({ path, message }) => `${FIELD_LABELS[path as FieldKey] ?? path}: ${message}`,
    );
    super([message, ...hints].join(" "));
    this.name = "ApiClientError";
  }
}
