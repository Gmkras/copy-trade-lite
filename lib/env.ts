import "server-only";

import { loadEnv, type Env } from "./env.schema";

/**
 * Validated, frozen environment for server code.
 *
 * `server-only` makes the Next.js build fail if any Client Component imports
 * this module, so secrets can never reach the browser (constitution E3).
 * Route Handlers and server components import `env` from here; nothing else
 * reads `process.env` directly.
 */
export const env: Env = loadEnv();
