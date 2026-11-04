// A catalog has the same shape as English with every leaf a plain string.
export type DeepString<T> = {
  readonly [K in keyof T]: T[K] extends string ? string : DeepString<T[K]>;
};
