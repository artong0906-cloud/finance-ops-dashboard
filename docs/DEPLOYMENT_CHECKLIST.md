# FinanceOps Deployment Checklist

This folder is the clean deployment source for the FinanceOps dashboard.

## Current Source Status

- Base UI: PR #3, `feature/ui-dashboard-shell`
- Upload auth fix: PR #1, `feature/fix-upload-save-auth`
- README-only GitHub connection test PR #2 is intentionally excluded
- Local build command verified:

```bash
pnpm install --frozen-lockfile
pnpm build
```

## Required Environment Variables

Set these in both local `.env.local` and Vercel Project Settings.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
INITIAL_ADMIN_SETUP_KEY=
```

Optional Google Sheets variables can remain empty until that integration is built:

```env
GOOGLE_SHEETS_CLIENT_EMAIL=
GOOGLE_SHEETS_PRIVATE_KEY=
GOOGLE_SHEETS_SPREADSHEET_ID=
```

## GitHub Flow

Recommended branch name:

```text
feature/merge-auth-fix-dashboard-shell
```

Recommended PR title:

```text
[codex] Merge upload auth fix with dashboard UI shell
```

Recommended PR summary:

```text
Summary
- Uses dashboard UI shell work from PR #3 as the base.
- Applies upload save auth changes from PR #1.
- Fixes unauthenticated landing/login card sizing for reliable rendering.

Validation
- pnpm install --frozen-lockfile
- pnpm build
```

## Vercel Flow

1. In Vercel, create a New Project from the GitHub repository.
2. Select `artong0906-cloud/finance-ops-dashboard`.
3. Use the Next.js framework preset.
4. Keep the root directory as repository root.
5. Add the required Supabase environment variables.
6. Deploy a preview branch first.
7. Promote to production after login, upload, and admin setup are verified.

## Supabase Flow

1. Apply SQL migrations in `database/migrations`.
2. Set the Vercel environment variables.
3. Visit `/setup-admin` with `INITIAL_ADMIN_SETUP_KEY`.
4. Create the first admin user.
5. Log in at `/login`.

## Notes

- Without Supabase environment variables, protected pages redirect to `/login?error=missing-env`.
- The login UI can render without env vars, but actual login requires Supabase.
- Vercel should be connected to GitHub so future pushes automatically create Preview or Production deployments.
