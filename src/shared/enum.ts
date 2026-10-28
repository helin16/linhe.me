// Helpers for const-object enums (constitution VIII): `export const X = { A: 'a' } as const;`
// plus `export type X = typeof X[keyof typeof X];`.

/** The enum's values, in declaration order. */
export const values = <E extends Record<string, string>>(e: E) => Object.values(e) as E[keyof E][];

/** True if `v` is one of the enum's values (for untrusted data such as saves or network messages). */
export const isMember = <E extends Record<string, string>>(e: E, v: unknown): v is E[keyof E] =>
  typeof v === 'string' && (Object.values(e) as string[]).includes(v);
