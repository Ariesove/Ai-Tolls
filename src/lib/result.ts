export type Result<T, E = string> =
  | { success: true; data: T }
  | { success: false; error: E };

export const Ok = <T>(data: T): Result<T, never> => ({ success: true, data });
export const Err = <E>(error: E): Result<never, E> => ({ success: false, error });

export const isOk = <T, E>(r: Result<T, E>): r is { success: true; data: T } => r.success;
export const isErr = <T, E>(r: Result<T, E>): r is { success: false; error: E } => !r.success;