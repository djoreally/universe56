import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Declare your Neon services here
  preview: {
    realtime: true,
  },
  auth: true,
  // aiGateway: true,  // PAUSED 2026-11-05: Neon Free plan refuses to apply aiGateway (deploy error). The gateway endpoint + token already exist in .env.local and the app uses them directly; re-enable this line after the plan upgrade and re-run neon deploy.
  functions: {
    hello: { name: "Hello World", source: "./hello.ts" },
    reach: { name: "Reach", source: "./functions/reach.ts" },
    studio: { name: "Studio", source: "./functions/studio.ts" },
    ops: { name: "Ops", source: "./functions/ops.ts" },
  },
  buckets: {
    // "private" is the default; use "public_read" for anonymous reads
    assets: { access: "private" },
  },
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (!branch.exists) {
      // New non-default branches: auto-expire
      // Run `neon checkout <name>` to create a new branch with these settings
      return { ttl: "7d" };
    }
    // Existing branch: no changes
    return {};
  },
});
