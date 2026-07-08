# Migration: Bun → pnpm + Node (local dev + tests)

Status: **done** (2026-07-07).

## Outcome / deviations from the original plan

- **`examples/splendor/server` and `examples/splendor/web` were deleted**
  (decision during execution — not in use). The server ran on Elysia, a
  Bun-first framework whose `app.listen()` needs the `@elysiajs/node` adapter to
  serve on Node; web was an Elysia Eden client of it and could not build without
  it. Deleting both removed the `Bun.CryptoHasher` leak and ~16 server test
  files, so Step 3's server change and the server/web entries in Steps 4–5 no
  longer applied.
- **Extra Bun couplings the audit missed** (not `Bun.*`-prefixed, so invisible to
  the original grep) were found and fixed: `import.meta.dir` (12 sites across 5
  cli tests) → `fileURLToPath(new URL(".", import.meta.url))`, and
  `import.meta.main` (`packages/cli/src/main.ts`) → the portable
  `process.argv[1] === fileURLToPath(import.meta.url)` guard (Node <24 has no
  `import.meta.main`).
- **Bun-extended `expect` matchers** Vitest lacks were codemodded:
  `toBeTrue/toBeFalse` → `toBe(true/false)`, `toBeNumber/toBeObject/toBeFunction`
  → `toBeTypeOf(...)`.
- **No `vitest.config.ts` was needed** — config-less Vitest scopes per-package
  `vitest run` correctly and a root `vitest run` covers the whole repo.
- **`.husky/pre-commit`** `bunx lint-staged` → `pnpm exec lint-staged`.
- **Out of scope (unchanged):** `packages/cli/src/main.ts` keeps its
  `#!/usr/bin/env bun` shebang (and `main.test.ts` still asserts it) — the
  publish/build story below.
- Per-package `CLAUDE.md` copies were deleted and the root `CLAUDE.md` rewritten
  for the pnpm/Node/tsx/Vitest toolchain.

Verified green: `pnpm install --frozen-lockfile`, `pnpm exec tsc -b`,
`pnpm lint`, `pnpm test` (18 files / 99 tests), and
`pnpm -C examples/splendor/terminal start` (decorator entry under tsx).

---

Original plan (execution handoff) follows.

## Why

The Tableverse platform runs on **pnpm + Node** (Node in production for maturity,
not Bun). `tableverse-kit` currently develops and tests on **Bun**. The shipped
packages already run under Node in practice:

- `@tableverse-kit/engine` runs inside the platform's sandbox workers
  (`isolated-vm` / V8 — an even stricter bar than Node).
- `@tableverse-kit/cli` (`tvk`) runs on creators' machines, who mostly have Node.

So we should **develop and test on the runtime we ship to**, rather than ship to
Node while validating on Bun. This migration switches local dev, the test runner,
and the example apps to pnpm + Node.

Scope decision (agreed): do the full switch — package manager (pnpm), runtime
(Node via a transpiling runner), and test runner (Vitest). This is not a
CI-only "verify on Node" job; Node becomes the actual dev runtime.

## The one real gotcha: legacy decorators

`tsconfig.json` sets `"experimentalDecorators": true`. The engine's state-authoring
facade (`GameState`, `@field(...)`) is built on **legacy TypeScript decorators**.

- Node **cannot run this source directly**. `node file.ts` type-stripping only
  _removes_ types; it does not _transform_ decorators, and V8 has no native
  decorator support. Bun has been silently transpiling them.
- Therefore "develop on Node" means **Node + a transpiling runner**, not bare
  `node file.ts`. Use:
  - **`tsx`** (esbuild-based; honors `experimentalDecorators`) to run/watch TS.
  - **Vitest** (also esbuild) for tests — handles decorators in tests too.
- esbuild/tsx/Vitest all read `experimentalDecorators` from tsconfig, so no source
  changes are needed for decorators — only the runner changes.

Do a spike first (see Step 0) to confirm decorators transpile correctly under
`tsx` and Vitest before doing the bulk work.

## Current Bun coupling (audit results)

Shipped runtime source uses **zero** Bun runtime APIs. The coupling is:

1. **Test runner** — 36 files import from `bun:test`. This is the bulk of the work.
   API maps almost 1:1 to Vitest (`describe` / `it` / `test` / `expect`).
2. **Two real `Bun.*` global leaks:**
   - `examples/splendor/server/src/modules/player-session/service.ts`
     `new Bun.CryptoHasher("sha256")` → replace with `node:crypto`
     (`crypto.createHash("sha256").update(token).digest("hex")`).
   - `packages/cli/tests/main.test.ts` — `Bun.file(...)` → `node:fs`
     (`fs.readFileSync(path, "utf8")` or `fs/promises.readFile`).
3. **Package manager** — `bun.lock`, root `workspaces` field, `@types/bun`,
   `bun run --cwd`, `bun run --watch`.
4. **tsconfig** — `"types": ["bun"]` in root `tsconfig.json`.

The web example (`examples/splendor/web`) already builds with Vite + `tsc`; no
runtime change needed there beyond its test script.

## Execution steps

Do this on a branch. Land it in reviewable chunks if possible (tooling first,
then test migration, then examples).

### Step 0 — Decorator spike (de-risk before bulk work)

- Add `tsx`, `vitest`, `@types/node` at the root.
- Convert **one** engine test that exercises `@field` / `GameState`
  (e.g. `packages/engine/tests/state-builder.test.ts`) to Vitest and run it.
- Run one decorator-using entrypoint under `tsx` (e.g. the terminal example
  `examples/splendor/terminal/src/main.ts`).
- Confirm both work before continuing. If decorators misbehave, stop and
  reassess the runner choice.

### Step 1 — Package manager: Bun → pnpm

- Add `pnpm-workspace.yaml` at repo root (pnpm ignores the `workspaces` field):
  ```yaml
  packages:
    - "packages/*"
    - "examples/*/*"
  ```
- Remove the `"workspaces"` array from root `package.json`.
- Delete `bun.lock`; run `pnpm install` to generate `pnpm-lock.yaml`.
- Replace `@types/bun` with `@types/node` (root + `packages/engine`,
  `packages/cli`, and any package that lists `@types/bun`).
- `workspace:*` protocol is supported by pnpm as-is; no change needed.

### Step 2 — tsconfig

- Root `tsconfig.json`: remove `"types": ["bun"]` (add `"node"` only where a
  package actually needs Node globals; the engine should stay clean/portable).
- Leave `experimentalDecorators`, `target`, `module`, `moduleResolution`
  untouched.

### Step 3 — Fix the two `Bun.*` leaks

- `player-session/service.ts`: `Bun.CryptoHasher` → `node:crypto`.
- `packages/cli/tests/main.test.ts`: `Bun.file` → `node:fs` (also gets migrated
  to Vitest in Step 4).

### Step 4 — Test runner: bun:test → Vitest

- Add root `vitest.config.ts` (workspace-aware). Keep test file globs matching
  existing `tests/**/*.test.ts` and `src/**/__tests__/*.test.ts` layouts.
- Codemod the import line across all 36 files:
  `import { ... } from "bun:test"` → `import { ... } from "vitest"`.
  The named imports (`describe`, `it`, `test`, `expect`) are the same.
- Watch for Bun-test-only APIs (e.g. `mock`, `spyOn`, lifecycle hook names). Most
  map directly to Vitest (`vi.fn`, `vi.spyOn`, `beforeEach`, etc.) — fix any that
  don't.
- Update each package's `"test"` script: `bun test` → `vitest run`
  (packages/engine, packages/cli, packages/client, examples/splendor/engine,
  examples/splendor/terminal, examples/splendor/web).

### Step 5 — Scripts (root `package.json`)

- `"test": "bun test --cwd packages/engine"` → `"vitest run"` (or
  `pnpm -r test` to run all packages).
- `"typecheck": "bun run --cwd packages/engine typecheck"` →
  `"pnpm -C packages/engine typecheck"` (unchanged tool: `tsc --noEmit`).
- `"dev:splendor"`: replace `bun run --cwd X dev` with
  `pnpm -C examples/splendor/server dev` etc.
- Example run scripts using Bun:
  - `examples/splendor/server`: `"dev": "bun run --watch src/index.ts"`
    → `"tsx watch src/index.ts"`.
  - `examples/splendor/terminal`: `"start": "bun run ./src/main.ts"`
    → `"tsx ./src/main.ts"`.
- Add `tsx` and `vitest` to root `devDependencies`.

### Step 6 — Husky / lint-staged / CI

- `husky` + `lint-staged` + `prettier` + `eslint` are runtime-agnostic; keep.
- Update any CI workflow and `AGENTS.md` "Verification" section that reference
  `bun run lint`, `bunx tsc -b`, `bun test --cwd ...` to the pnpm/Vitest
  equivalents (`pnpm lint`, `pnpm exec tsc -b`, `pnpm -C <pkg> test`).

## Verification (definition of done)

Run and confirm green:

```bash
pnpm install
pnpm exec tsc -b            # typecheck all references
pnpm lint
pnpm -r test               # or run per package
pnpm -C examples/splendor/terminal start   # decorator-using entry runs under tsx
```

- No `bun.lock`, no `@types/bun`, no `"types": ["bun"]` remain.
- `grep -rn "bun:test\|\\bBun\\.\|from ['\"]bun['\"]"` over `packages` + `examples`
  returns nothing.
- Update `AGENTS.md` verification commands to the new toolchain.

## Out of scope (separate follow-up, do NOT block this migration)

**Publish build.** `@tableverse-kit/engine` currently publishes **raw `.ts`**
(`exports` → `./src/index.ts`, `files: ["src"]`) with legacy decorators. Any
external consumer (including the platform) therefore needs a decorator-aware
transpiler to import it. Bun let us skip having a build step entirely. This is a
pre-existing condition, not caused by this migration. A real `tsc`/`tsup` build
emitting JS + `.d.ts` should be tracked as its own task. Local dev and tests here
do not need it (`tsx` / Vitest transpile on the fly), and the platform bundles
the engine in its builder per the platform `design.md §8`.
