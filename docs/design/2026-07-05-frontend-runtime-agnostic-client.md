# Frontend-Runtime-Agnostic Client

Status: accepted
Date: 2026-07-05

Amends:

- [2026-05-26 Tableverse Client SDK And Transport Boundary](./2026-05-26-tableverse-client-sdk-and-transport-boundary.md)
  — same transport boundary, but the consumer is no longer assumed to be React.
- [2026-05-01 Tabletop UI Library Design](./2026-05-01-tabletop-ui-library-design.md)
  — the shadcn-style styled/copy-in component half is dropped (see §4).
- [2026-05-19 Tabletop UI Hooks Design](./2026-05-19-tabletop-ui-hooks-design.md)
  — hooks remain valid but are re-scoped as _one optional binding_ over the
  framework-neutral client, not the primary consumption path.

Companion (platform side, `tableverse` repo):
`docs/design/2026-07-05-frontend-artifact-design.md`.

## Context

Tableverse is relaxing the uploaded frontend from "a React SPA" to "any static
web bundle" — DOM/React, canvas, WebGL/WebGPU, or WASM (Unity, Godot,
Rust+wgpu). The only contract the platform enforces is the **I/O boundary**: the
frontend talks to the world only through the client bridge and has no network
access of its own.

Today `tableverse-kit` ships the client **only** as React hooks in
`@tableverse-kit/ui`:

- `TTKitClient<G>` — the transport-agnostic client interface
  (`packages/ui/src/client/types.ts`). This doc renames it to
  `TableverseClient<G>` (see Decision §0).
- `createInProcessClient` — the in-process adapter
  (`packages/ui/src/adapters/in-process.ts`).
- `DiscoveryState<G>` — the framework-neutral selection/discovery state machine
  (`packages/ui/src/client/discovery-state.ts`).
- `createGameHooks<G>()` — the React binding over the client.

Three of those four are already framework-neutral plain JS. They are just
packaged behind a React-flavored name (`@tableverse-kit/ui`) and only documented
as a hooks product. A canvas/WebGL/WASM game cannot consume React hooks, so the
neutral core must become a first-class, React-free consumption path.

## Decision

### 0. Rename `TTKitClient` → `TableverseClient`

`TTKit` is the stale "TableTop Kit" abbreviation and is the one cryptic prefix
that breaks the kit's full-word public naming convention (`GameExecutor`,
`GameEvent`, `GameState`, `GameDefinitionBuilder`), which `AGENTS.md` asks us to
preserve. Rename the interface and its siblings to full-word `Tableverse*`
names:

- `TTKitClient<G>` → `TableverseClient<G>`
- `TTKitGame` → `TableverseGame`
- `TTKitProvider` / `TTKitProviderProps` → `TableverseProvider` / `TableverseProviderProps`
- `useTTKitClient` → `useTableverseClient`

This also pairs the interface cleanly with the platform factory:
`createTableverseClient<G>(): TableverseClient<G>`. The existing `TTKit`-named
code in `packages/ui` is unchanged by this doc; the rename is a follow-up code
pass. The rest of this doc uses the new names.

### 1. The product is the framework-neutral client, not the hooks

`TableverseClient<G>` is the real deliverable a frontend consumes. Its surface
is already renderer-neutral plain JS:

- sync, local-mirror reads: `getView`, `getStateVersion`, `viewerId`,
  `subscribe`, `onEvent`
- async, boundary-crossing calls: `getAvailableCommands`, `discover`, `execute`
- `dispose`

A canvas/WebGL/WASM game drives its own loop off this object:

```ts
const client = createTableverseClient<MyGame>();

const unsubscribe = client.subscribe(() => {
  const view = client.getView();
  if (view) scene.applyView(view);
});
client.onEvent((event) => scene.playEffect(event));

canvas.addEventListener("pointerdown", async (e) => {
  const command = hitTest(e);
  if (command) await client.execute(command);
});
```

No React anywhere in that path.

### 2. Expose the neutral core React-free

The neutral core (`TableverseClient<G>` type, `createInProcessClient`,
`DiscoveryState<G>`) must be importable without pulling in React. Two viable
packagings:

- **(A, recommended) Extract `@tableverse-kit/client`** holding the interface,
  the in-process adapter, and the discovery state machine. `@tableverse-kit/ui`
  depends on it and adds only the React bindings.
- **(B) Keep one package, add a React-free entry.** `@tableverse-kit/ui`
  exposes the neutral core from a subpath with no React import
  (`@tableverse-kit/ui/client`) and the hooks from the root. React stays a
  `peerDependency` only the hooks entry needs.

Recommendation: **(A)**. Once a WebGL/WASM game is a real consumer, "the client"
and "the React hooks" have genuinely different dependency footprints and
audiences; a `react`-named package as the home of the non-React client is
misleading. (A) also matches the platform-side framing where the private
`@tableverse/client` wraps the neutral core, not the hooks.

The discovery/selection logic (`DiscoveryState`, and the `useSelectable`
decision table) must live in the neutral core, so a canvas/WebGL game gets the
same selection/discovery state machine a React game gets. `useSelectable`
becomes a thin React projection of a neutral `selectable(state, isTarget)`
helper.

### 3. React hooks stay, re-scoped as one optional binding

`createGameHooks<G>()` and the hooks in
[2026-05-19](./2026-05-19-tabletop-ui-hooks-design.md) remain supported for
React consumers. They are no longer _the_ way to use the client — they are a
convenience layer over `TableverseClient<G>`, on equal footing with "use the client
directly in a game loop." Nothing about the hooks changes mechanically; only
their status in the story does.

### 4. Drop the shadcn-style styled/copy-in component kit

The [2026-05-01](./2026-05-01-tabletop-ui-library-design.md) design had two
halves: React **hooks** (interaction logic) and React **components** copied in
via `ttk ui add` (a shadcn-style styled vocabulary). The components half was
justified by giving a codegen agent "a fixed vocabulary of React UI building
blocks" so generated games render consistently.

That justification does not survive the pivot: if a frontend can be canvas /
WebGL / WASM, a **React-component** vocabulary cannot be the universal rendering
substrate. Consistency, where it matters, has to come from the neutral client
and interaction model, not from shipped DOM components.

Decision: **drop the styled/copy-in component kit and `ttk ui add`** as a
planned deliverable. Keep the interaction _logic_ (discovery/selection) in the
neutral core. `@tableverse-kit/ui` narrows to React bindings over the client —
hooks, provider, and at most unstyled headless helpers — with no styled visual
identity and no copy-in registry.

This also resolves the still-open `@tableverse-kit/ui` implementation deferral
in `AGENTS.md`: the package's remaining scope is the thin hooks binding, not a
component library.

## Architecture

```txt
@tableverse-kit/engine (OSS)
  - GameExecutor, schemas, runtime

@tableverse-kit/client (OSS)          <-- neutral core, React-free (recommended split)
  - TableverseClient<G> interface
  - createInProcessClient             (ttk dev / offline / 3rd-party)
  - DiscoveryState / selectable()     (framework-neutral interaction logic)

@tableverse-kit/ui (OSS)              <-- React bindings ONLY (thin)
  - createGameHooks<G>() over TableverseClient<G>
  - NO styled component kit, NO `ttk ui add`

@tableverse/client (PRIVATE, tableverse repo)
  - createTableverseClient<G>() -> TableverseClient<G>
      dev build  -> wraps createInProcessClient
      prod build -> postMessage bridge
  - consumed directly by canvas/WebGL/WASM games;
    React games layer @tableverse-kit/ui on top
```

The transport boundary from
[2026-05-26](./2026-05-26-tableverse-client-sdk-and-transport-boundary.md) is
unchanged. The only correction there: every mention of "uploaded **React**
games" should read "uploaded games (any renderer)", and the consumer of the
returned `TableverseClient<G>` is not assumed to be React.

## Non-Goals

- No change to `GameExecutor`, the engine, or the transport wire protocol.
- No change to the `TableverseClient<G>` method contract (the `getAvailableCommands`
  async change from the 2026-05-26 doc still stands; nothing new here).
- This doc does not specify the extract-vs-subpath packaging mechanics beyond
  the recommendation in §2; that is a follow-up once a real non-React consumer
  exists.

## Consequences

- A canvas/WebGL/WASM game can consume the client directly, with no React.
- The neutral core (interface + in-process adapter + discovery state machine)
  becomes the headline surface; hooks become an optional binding.
- The planned styled/copy-in component library is cancelled; `@tableverse-kit/ui`
  narrows to React bindings.
- `AGENTS.md` should reflect: `@tableverse-kit/ui` is a thin React binding over a
  framework-neutral client; the client core is the primary surface; the
  styled-component kit is no longer planned.
