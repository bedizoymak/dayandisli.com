# Deployment & Rollback Runbook (Phase 14)

Scope: the manual FTP pipeline that ships this repo's static build to the
production host serving `dayandisli.com`, `erp.dayandisli.com` and
`qr.dayandisli.com`. This document standardizes the procedure, adds release
identification, checksum verification and a tested rollback path. **It changes
no deployment behavior by itself; it documents and hardens it.**

---

## 1. Topology

| Host/path | Content | Source |
|---|---|---|
| `REMOTE_ROOT/index.html` (+ assets) | marketing site | `dist/` |
| `REMOTE_ROOT/erp/index.html` (+ assets) | ERP SPA | `dist/erp/` (created by `scripts/nest-erp-build.mjs` during `npm run build`) |
| `REMOTE_ROOT/qr/` | QR contact-card microsite | `public_html/qr/` (second deploy pass) |
| Supabase project `meauutjsnnggzcigyvfp` | DB + Edge Functions (deployed SEPARATELY via Supabase CLI — not part of FTP deploys) |

Hostname routing happens client-side (`src/lib/domains.ts`): one SPA bundle,
three virtual apps.

## 2. Release artifact (build once, ship that)

```
npm ci                 # clean tree only
npm run typecheck && npm run typecheck:server
npm test
npm run build          # vite build -> nest-erp-build -> verify-production-bundle
```

After a green build, produce the immutable release record:

```
node scripts/make-release-manifest.mjs     # writes dist/release-manifest.json
```

The manifest contains: git commit SHA, build timestamp, Node/npm versions,
and SHA-256 for every file in `dist/`. `dist/` is then treated as frozen —
never rebuild between manifest creation and upload.

## 3. Pre-deploy verification (all mandatory)

1. Working tree clean at a tagged commit (`git status` empty; commit pushed).
2. Full gate ran green **on the release commit** (CI quality workflow or locally).
3. Bundle safeguard passed (it runs inside `npm run build`; failure = stop).
4. `DEPLOY\deploy-dayan-dry-run.bat` (or `python scripts/deploy_ftp.py --dry-run`)
   reviewed line-by-line: file count delta sane, NO deletions outside
   generated asset dirs, remote root resolved as expected.

## 4. Deploy

- Preferred cadence: `--diff` mode (uploads changed/missing files only).
- Use `--full` when: asset filename strategy changed, OR a rollback is being
  re-applied, OR after any incident affecting remote state.
- `--checksum` forces full binary comparison when server-side hashes are
  distrusted.
- The deployer refuses known-bad remote roots and protects critical names
  (see PROTECTED_NAMES / validate_remote_root in deploy_ftp.py) — never bypass.
- Record in the ops log: release commit SHA, mode used, start/end time,
  dry-run diff summary.

## 5. Post-deploy health verification

1. `https://dayandisli.com` and `https://erp.dayandisli.com` return HTTP 200
   with the new `index.html` (check the hashed main asset name matches the
   manifest entry).
2. Login smoke on ERP domain (real credentials, human-performed).
3. Customer statement screen for one golden contact renders "reconciled"
   (authoritative path healthy) and print parity holds.
4. If sync was un-paused at this point: `parasut-api sync-status` →
   `health.status` is not `critical`; no `[ALERT]` lines in function logs.
5. Watch edge-function logs for 15 minutes for SMTP/auth errors.

## 6. Rollback

Trigger conditions (any): statement print blocked for golden contacts,
login broken, finance screens erroring, bundle safeguard-class leak
discovered post-release.

Procedure:
1. **Freeze**: announce deploy freeze; no further uploads.
2. **Revert source**: `git revert <release-commit>` (or check out the previous
   release tag), rebuild exactly per §2, regenerate the manifest.
3. **Ship backwards**: `python scripts/deploy_ftp.py --full` with the reverted
   `dist/`. Full mode resets generated asset dirs so stale hashed chunks from
   the bad release cannot be served again.
4. **Verify** per §5 (steps 1–4 minimum).
5. **Supabase-side rollback**: Edge Functions are versioned by redeploying the
   previous commit (`supabase functions deploy <name> --project-ref …` from
   the prior tag). Database migrations are NEVER rolled back automatically —
   compensating migrations only, prepared under
   docs/database-generation-retirement.md rules.
6. Post-mortem note appended to docs/architecture-remediation.md.

## 7. Known limitations (documented, accepted for now)

- FTP is not atomic: brief windows can serve mixed old/new hashed assets.
  Mitigated by content-hashed filenames + index.html uploaded last by the
  differ; `--full` minimizes skew during rollbacks.
- No server-side canary: verification is manual (§5). The ratcheted CI gate
  plus the bundle safeguard are the automated front line.
- `PARASUT_SYNC_EMERGENCY_PAUSE` is independent of FTP deploys — a frontend
  rollback never re-enables sync by accident.
