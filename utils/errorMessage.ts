// Same as `err?.message` for a caught value of unknown type (an Error, a string, an SDK object, ...)
export const messageOf = (err: unknown): string | undefined =>
  (err as { message?: string } | null | undefined)?.message;

// Same as `err?.code`, e.g. Firebase's 'permission-denied'
export const codeOf = (err: unknown): string | undefined =>
  (err as { code?: string } | null | undefined)?.code;
