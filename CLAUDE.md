# Navelix · Development & Architecture Guidelines

This codebase follows standard Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4 architecture.

## 🛠️ Quick Commands

- `pnpm dev`: Start local development server on port 3721
- `pnpm build`: Next.js production build
- `pnpm lint`: Run ESLint checks
- `pnpm test`: Run native Node.js test runner (`node --experimental-strip-types --test src/**/*.test.ts`)

## 🧱 Architecture & Key Rules

1. **Database & Storage**:
   - Primary database is SQLite with WAL mode via `node:sqlite` (`src/lib/db.ts`).
   - Foreign keys and CASCADE constraints are enforced (`PRAGMA foreign_keys = ON`).
   - Database migrations are sequential in `src/lib/migrations/index.ts`.

2. **Authentication & Security**:
   - HttpOnly Cookie sessions with rate limiting and CSRF protection (`src/lib/auth.ts`, `src/lib/csrf.ts`).
   - Personal API Token Bearer authentication (`nvx_live_...`).
   - SSRF protection via `safeFetch` (`src/lib/ssrf.ts`).

3. **Styling & UI**:
   - Modern Tailwind CSS 4 with custom dark mode theme variables.
   - Iconify icon framework integration.
