import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type UnaryFunction<Input, Output> = (input: Input) => Output;

export function pipe<A>(value: A): A;
export function pipe<A, B>(value: A, ab: UnaryFunction<A, B>): B;
export function pipe<A, B, C>(value: A, ab: UnaryFunction<A, B>, bc: UnaryFunction<B, C>): C;
export function pipe<A, B, C, D>(
  value: A,
  ab: UnaryFunction<A, B>,
  bc: UnaryFunction<B, C>,
  cd: UnaryFunction<C, D>
): D;
export function pipe<A, B, C, D, E>(
  value: A,
  ab: UnaryFunction<A, B>,
  bc: UnaryFunction<B, C>,
  cd: UnaryFunction<C, D>,
  de: UnaryFunction<D, E>
): E;
export function pipe(value: unknown, ...fns: Array<UnaryFunction<unknown, unknown>>) {
  return fns.reduce((acc, fn) => fn(acc), value);
}

export function compose<A>(): UnaryFunction<A, A>;
export function compose<A, B>(ab: UnaryFunction<A, B>): UnaryFunction<A, B>;
export function compose<A, B, C>(bc: UnaryFunction<B, C>, ab: UnaryFunction<A, B>): UnaryFunction<A, C>;
export function compose<A, B, C, D>(
  cd: UnaryFunction<C, D>,
  bc: UnaryFunction<B, C>,
  ab: UnaryFunction<A, B>
): UnaryFunction<A, D>;
export function compose<A, B, C, D, E>(
  de: UnaryFunction<D, E>,
  cd: UnaryFunction<C, D>,
  bc: UnaryFunction<B, C>,
  ab: UnaryFunction<A, B>
): UnaryFunction<A, E>;
export function compose(...fns: Array<UnaryFunction<unknown, unknown>>) {
  return (value: unknown) => fns.reduceRight((acc, fn) => fn(acc), value);
}

export async function pipeAsync<A>(value: A): Promise<A>;
export async function pipeAsync<A, B>(value: A, ab: UnaryFunction<A, B | Promise<B>>): Promise<B>;
export async function pipeAsync<A, B, C>(
  value: A,
  ab: UnaryFunction<A, B | Promise<B>>,
  bc: UnaryFunction<B, C | Promise<C>>
): Promise<C>;
export async function pipeAsync<A, B, C, D>(
  value: A,
  ab: UnaryFunction<A, B | Promise<B>>,
  bc: UnaryFunction<B, C | Promise<C>>,
  cd: UnaryFunction<C, D | Promise<D>>
): Promise<D>;
export async function pipeAsync<A, B, C, D, E>(
  value: A,
  ab: UnaryFunction<A, B | Promise<B>>,
  bc: UnaryFunction<B, C | Promise<C>>,
  cd: UnaryFunction<C, D | Promise<D>>,
  de: UnaryFunction<D, E | Promise<E>>
): Promise<E>;
export async function pipeAsync(value: unknown, ...fns: Array<UnaryFunction<unknown, unknown>>) {
  let current = value;
  for (const fn of fns) {
    if (isResult(current) && !current.success) return current;
    const input = isResult(current) ? current.data : current;
    const out = await fn(input);
    current = out;
  }
  return current;
}

function isResult(x: unknown): x is { success: boolean; data?: unknown; error?: unknown } {
  return (
    typeof x === "object" &&
    x !== null &&
    "success" in x &&
    typeof (x as any).success === "boolean"
  );
}

export interface Chain<T> {
  map<U>(fn: UnaryFunction<T, U>): Chain<U>;
  tap(fn: UnaryFunction<T, void>): Chain<T>;
  value(): T;
}

export function chain<T>(value: T): Chain<T> {
  return {
    map(fn) {
      return chain(fn(value));
    },
    tap(fn) {
      fn(value);
      return chain(value);
    },
    value() {
      return value;
    }
  };
}
