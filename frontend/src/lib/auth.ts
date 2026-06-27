// src/lib/auth.ts
// Thin re-exports so existing import paths (src/lib/auth) still resolve.
// Real token logic lives in src/lib/api.ts → tokens object.

export { tokens } from "./api";
export type { User, AuthResponse } from "./api";