export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: { path: string; message: string }[] = [],
  ) { super(message); }
}

export function notFound(entity: string): never {
  throw new AppError(404, "NOT_FOUND", `${entity} не найдена`);
}
