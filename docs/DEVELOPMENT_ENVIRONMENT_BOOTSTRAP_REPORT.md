# Development Environment Bootstrap Report

Last updated: 2026-07-12 (post-restart verification)

## Status Summary

The software installation, project bootstrap, restart, and post-restart infrastructure validation phases are complete. WSL 2, Docker Desktop, the Linux Docker engine, Docker Compose, and the core Supabase local stack are operational. GitHub CLI authentication and repository access are verified. Supabase's optional Vector log collector remains degraded by the default Windows Docker TCP setting.

## 1. Git Identity

- Global `user.name`: `Bediz Oymak`.
- Global `user.email`: `bedizoymak@hotmail.com`.
- Effective repository identity: verified from `C:/Users/bediz/.gitconfig`.
- No repository-specific identity override was added.

## 2. GitHub CLI Authentication

- GitHub CLI: installed, version 2.92.0.
- Authentication status: authenticated to GitHub.com as `bedizoymak` using the Windows keyring.
- Active Git operations protocol: HTTPS.
- No personal access token was requested, printed, or stored in this report.

## 3. GitHub Username

- Authenticated username: `bedizoymak`.
- Verification through `gh api user --jq ".login"`: passed.

## 4. Repository Remote Access

- Repository: `C:\Users\bediz\Documents\dayandisli.com`.
- Branch: `main`.
- Remote: `https://github.com/bedizoymak/dayandisli.com.git`.
- Unauthenticated `git ls-remote origin HEAD`: passed; origin resolved to commit `3fc8576484a3d2099e9e338d19819a2f16cbc7e7`.
- GitHub authentication and origin HEAD access both pass; origin HEAD resolves to `3fc8576484a3d2099e9e338d19819a2f16cbc7e7`.
- Existing untracked file preserved: `docs/SECURITY_AUDIT_READ_ONLY.md`.

## 5. Windows Restart Status

- Component Based Servicing restart pending: no.
- Windows Update restart pending: no.
- Pending file rename operations: no.
- The user completed the required restart before post-restart verification.

## 6. WSL 2 Status

- WSL package version: 2.7.10.0.
- Default WSL version: 2.
- Kernel version: 6.18.33.2-2.
- Operational status: healthy.
- Docker Desktop's `docker-desktop` distribution is running under WSL version 2.
- No general-purpose Linux distribution was installed because the project does not require one.
- No pending kernel or virtualization error was reported.

## 7. Docker Engine Status

- Docker Desktop: running, version 4.81.0.
- Docker CLI and engine: version 29.6.1.
- Engine reachability: passed.
- Active context: `desktop-linux`.
- Server operating system/architecture: Linux `amd64` (`x86_64`).
- Linux containers: available.

## 8. Docker Compose Status

- Docker Compose: operational, version 5.2.0.

## 9. Supabase CLI Status

- Supabase CLI: installed, version 2.109.1.
- The repository contains `supabase/config.toml`, migrations, and Edge Functions.
- CLI status and start commands were confirmed through `--help` before use.

## 10. Supabase Local Stack Status

- The existing local stack was initially stopped and was started successfully from the repository's existing configuration and migrations.
- `supabase status` exits successfully after startup.
- Core database, API gateway, Auth, REST, Realtime, Storage, Studio, pgMeta, Inbucket, Edge Runtime, and Analytics containers started; reported health checks pass where defined.
- PostgreSQL reports ready and a read-only `select 1` verification passed.
- The optional Vector log collector repeatedly restarts because Docker daemon TCP access on `localhost:2375` is disabled on Windows. Docker settings were intentionally not changed.
- Imgproxy and connection pooler are stopped by the current local configuration.
- Security warning: local services bind to `0.0.0.0`; Studio, pgMeta, and Analytics have no authentication. Use the stack only on a trusted network.
- No database push, reset, migration repair, remote project link, migration edit, production operation, or tracked Supabase file change was performed.

## 11. Node Toolchain

- Node.js: 24.18.0 LTS.
- npm: 11.16.0.
- Corepack: 0.35.0.
- pnpm: 11.12.0.
- Yarn: 4.17.1.

## 12. PHP Toolchain

- PHP: 8.5.8.
- Composer: 2.10.2.
- Required PHP extensions verified: curl, openssl, mbstring, intl, json, mysqli, PDO, pdo_mysql, fileinfo, and zip.
- PHP source validation is not applicable because the repository contains no PHP source files.

## 13. Python

- Python: 3.14.6.
- pip: 26.1.2.
- `venv`: verified.

## 14. Typecheck

- `npm run typecheck`: passed again during post-restart validation.

## 15. Tests

- `npm test`: passed again during post-restart validation.
- Result: 22 test files and 304 tests passed.

## 16. Production Build

- `npm run build`: passed again during post-restart validation.
- Build output: `dist/erp`.
- Existing warnings include stale Browserslist data, large chunks, a deprecated Vite optimization option, and `pdfjs-dist` use of `eval`.

## 17. Existing Lint Findings

- `npm run lint`: failed with 32 errors and 40 warnings.
- These are existing application-code findings and were not modified during environment bootstrap.

## 18. Existing Dependency-Security Findings

- `npm install` completed without changing the lockfile.
- npm audit reported 29 vulnerabilities: 5 moderate, 23 high, and 1 critical.
- No forced audit fix, major-version upgrade, or application-behavior change was performed.

## 19. Remaining Manual Actions

1. Keep the local Supabase stack on a trusted network because management services bind to all interfaces without authentication.
2. If local Analytics log collection is required, separately review the security implications of Docker daemon TCP exposure before enabling it. The core application stack does not require this change.
3. Address existing lint and dependency-security findings as separate application-maintenance work.

## 20. Overall Readiness

Development/build readiness: passed. GitHub CLI authentication, origin access, WSL 2, Docker Desktop, the Linux Docker engine, Docker Compose, Supabase CLI, the core Supabase local stack, database connectivity, typecheck, tests, and production build all work. The development environment bootstrap is complete. Optional Supabase Vector log collection remains degraded, but it does not block local application development, tests, builds, deployment access, or core local database work.

This report is not committed or pushed.
