# STEP 03 Uploads Build Fix v4.4

Vercel build failed at `services/uploads/parse.ts:70:15` because the PapaParse error callback parameter implicitly had an `any` type under strict TypeScript checks.

Fix: explicitly type the callback parameter as `Error`.

Apply this package, run local `pnpm dev` or `pnpm build`, then commit and push.
