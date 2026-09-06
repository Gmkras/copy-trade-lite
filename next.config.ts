import type { NextConfig } from "next";

import { loadEnv } from "./lib/env.schema";

// Fail fast: validate the environment when the Next CLI loads this config, so
// `pnpm dev` / `pnpm build` refuse to start on a bad or non-testnet config
// before any page or route is compiled.
loadEnv();

const nextConfig: NextConfig = {
  // Next 16 rewrites CLAUDE.md / AGENTS.md with its own agent rules on `next dev`.
  // Our CLAUDE.md is the project constitution and must not be touched.
  agentRules: false,
};

export default nextConfig;
