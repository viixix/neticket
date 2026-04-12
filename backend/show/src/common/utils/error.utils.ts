export interface MySqlDuplicateEntryError extends Error {
  code: string;
  errno: number;
}

export function isMySqlDuplicateEntryError(
  error: unknown,
): error is MySqlDuplicateEntryError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'errno' in error &&
    (error as Record<string, unknown>).code === 'ER_DUP_ENTRY' &&
    (error as Record<string, unknown>).errno === 1062
  );
}
