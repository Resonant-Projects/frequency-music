import { Accessor } from "solid-js";

export function isFunction<T>(value: unknown): value is Accessor<T> {
  return typeof value === "function";
}

export function safeAccess<T>(value: T | Accessor<T>): T {
  return isFunction<T>(value) ? value() : value;
}
