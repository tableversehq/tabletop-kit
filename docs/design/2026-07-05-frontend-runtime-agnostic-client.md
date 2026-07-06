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

### 2. Rename `/ui` → `@tableverse-kit/client`, one package, React-free root

Rename the existing `@tableverse-kit/ui` package to **`@tableverse-kit/client`**.
It is a single package with a React-free root and an optional React entry:

- root (`@tableverse-kit/client`) — the neutral core: `TableverseClient<G>`,
  `createInProcessClient`, the interaction state machine, and neutral client
  sugar. Imports no React.
- an optional React entry — the hooks (`createGameHooks`, etc.). React is an
  **optional** peer dependency (`peerDependenciesMeta`), so a canvas/WebGL/WASM
  consumer installs the package and imports the root without React ever entering
  its dependency tree or bundle.

The invariant that makes this honest: **the root must never import React, even
transitively.** Enforce it, don't trust it — an import-boundary test that
imports the root in a React-free context and asserts nothing pulls React in.

### 2a. Abstract the interaction state machine out of the hooks

This is the load-bearing part of the pivot. The genuinely hard, valuable logic
is the multi-step **discovery / selection / confirm** state machine — today
split between the framework-neutral `DiscoveryState<G>`
(`client/discovery-state.ts`) and the React-shaped `useSelectable` decision
table inside `create-game-hooks.tsx`.

All of that interaction logic must live in the **neutral core**, so a
canvas/WebGL/WASM game gets exactly the same selection/discovery behavior a
React game gets:

- keep `DiscoveryState<G>` in the neutral core,
- lift the `useSelectable` decision table into a neutral, framework-agnostic
  helper (e.g. `selectable(discoveryState, isTarget)` returning
  `idle | selectable | selected | unselectable` + an `onPick`),
- the React hooks (`useDiscovery`, `useSelectable`) become thin projections of
  those neutral primitives — they adapt to React's render model
  (`useSyncExternalStore`, etc.) and add nothing that a non-React consumer
  cannot get from the neutral helpers directly.

If interaction logic stays trapped in the hooks, non-React frontends re-derive a
subtle state machine by hand and get it wrong. Pushing it down is what lets the
hooks be genuinely optional.

### 3. React hooks stay, re-scoped as one optional binding

`createGameHooks<G>()` and the hooks in
[2026-05-19](./2026-05-19-tabletop-ui-hooks-design.md) remain supported for
React consumers, shipped from the optional React entry of
`@tableverse-kit/client`. They are no longer _the_ way to use the client — they
are a convenience layer over `TableverseClient<G>` and the neutral interaction
helpers (§2a), on equal footing with "use the client directly in a game loop."
Mechanically the hooks barely change; their job narrows to React-render
adaptation now that the interaction logic lives in the neutral core.

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
neutral core (§2a). The React entry of `@tableverse-kit/client` narrows to thin
bindings over the client — hooks, provider, and at most unstyled headless
helpers — with no styled visual identity and no copy-in registry.

This also resolves the still-open `@tableverse-kit/ui` implementation deferral
in `AGENTS.md`: the remaining scope is the thin React hooks binding, not a
component library.

## Architecture

```txt
@tableverse-kit/engine (OSS)
  - GameExecutor, schemas, runtime

@tableverse-kit/client (OSS)          <-- renamed from /ui; single package
  root (React-free):
    - TableverseClient<G> interface
    - createInProcessClient           (ttk dev / offline / 3rd-party)
    - DiscoveryState / selectable()   (framework-neutral interaction logic)
    - client sugar (onView, ...)
  optional React entry:
    - createGameHooks<G>() + hooks     (thin, react = optional peer dep)
    - NO styled component kit, NO `ttk ui add`

@tableverse/client (PRIVATE, tableverse repo)
  - createTableverseClient<G>() -> TableverseClient<G>
      dev build  -> wraps createInProcessClient
      prod build -> postMessage bridge
  - consumed directly by canvas/WebGL/WASM games;
    React games add the optional React entry on top
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
- No separate framework-adapter package. React ships as an optional entry of the
  single `@tableverse-kit/client` package; a dedicated adapter package is out of
  scope for now.

## Consequences

- A canvas/WebGL/WASM game can consume the client directly, with no React.
- `@tableverse-kit/ui` is renamed to `@tableverse-kit/client`: a single package
  with a React-free root (the headline surface) and an optional React entry.
- The interaction state machine (discovery/selection) is abstracted into the
  neutral core so every renderer shares it; the React hooks become thin
  projections of it.
- The planned styled/copy-in component library is cancelled.
- `AGENTS.md` should reflect: the package is `@tableverse-kit/client`; its
  neutral root is the primary surface; React hooks are an optional entry; the
  styled-component kit is no longer planned.
