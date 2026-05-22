# Typed `getView()` via `static configureVisibility`

## Context

`GameExecutor.getView(state, viewer)` currently returns `VisibleState<object>`.
The `object` placeholder erases everything about the projected shape — which
fields are hidden, which are derived, which are visible-to-self. Consumers
either work with `unknown`-equivalent values or import a hand-written /
codegen-emitted view type and assert it at the boundary.

This doc proposes deriving the projected view type _statically_ from the state
class itself, so `executor.getView()` returns the right type without codegen.

## Current State

State authoring uses class extension (see
`2026-05-16-game-state-base-class-migration.md`):

```ts
class SplendorState extends GameState {
  @field(t.number())
  gems!: number;

  @field(t.number())
  hiddenScore!: number;
}

configureVisibility(SplendorState, (b) => ({
  fields: [
    b.field.hiddenScore.hidden({
      schema: t.object({ scoreRange: t.string() }),
      derive: (v) => ({ scoreRange: v < 10 ? "low" : "high" }),
    }),
  ],
}));
```

The `configureVisibility(MyState, ...)` call is a side-effecting module-scope
registration. Its return is `void` — no type-level signal that the class is
visibility-configured, and no way for TS to know what the projection looks like.

The codegen path (`generate-types`) reads the runtime metadata and emits a
flat `VisibleState` interface per game (see
`examples/splendor/engine/generated/visible-state.generated.d.ts`). Consumers
import that to type `getView()` returns. This works but creates a separate
build artifact to keep in sync.

## Design

Move visibility configuration onto the class as a `static configureVisibility`
method. The method is named after its action — it _configures_ visibility,
matching the existing `configureVisibility(...)` free function — so the rename
is purely a relocation, not a semantic shift.

```ts
class SplendorState extends GameState {
  @field(t.number())
  gems!: number;

  @field(t.number())
  hiddenScore!: number;

  static configureVisibility(b: VisibilityBuilder<SplendorState>) {
    return {
      fields: [
        b.field.hiddenScore.hidden({
          schema: t.object({ scoreRange: t.string() }),
          derive: (v) => ({ scoreRange: v < 10 ? "low" : "high" }),
        }),
      ],
    };
  }
}
```

The engine reads `Class.configureVisibility(builder)` when compiling the state
facade — same data as today's free-function call, just sourced from the class.

### Type-level derivation

The crucial property: the _return type_ of `configureVisibility` is reachable
from the class type. The engine declares a conditional type that extracts the
visibility config from a class and applies it to the instance shape:

```ts
type VisibilityOf<C> = C extends { configureVisibility(b: never): infer R }
  ? R
  : null;

type ProjectedView<C> = ApplyVisibility<InstanceType<C>, VisibilityOf<C>>;
```

`ApplyVisibility<TState, Config>` walks `TState`'s fields and, for each field
named in `Config["fields"]`, replaces the field type with the visibility-aware
projection:

- `mode: "hidden"` with `schema` + `derive` → `HiddenValue<ReturnType<typeof derive>>`
- `mode: "hidden"` without derive → `HiddenValue<never>`
- `mode: "visible_to_self"` → the original field type _or_ `HiddenValue<...>`
  depending on viewer (encoded as a union at the type level)

Nested `GameState` subclasses (e.g. `players: Record<string, PlayerState>`)
recurse: `ApplyVisibility` invokes `ProjectedView<PlayerState>` for each nested
class field.

The executor signature then becomes:

```ts
interface GameExecutor<GameState, SetupInput, View = VisibleState<object>> {
  getView(state, viewer): View;
}

function createGameExecutor<C extends typeof GameState>(
  game: GameExecutorDefinition<InstanceType<C>, ...>,
): GameExecutor<..., VisibleState<ProjectedView<C>>>;
```

A typed `getView()` falls out automatically — no codegen, no manual type
assertions, no separate `.d.ts` to maintain.

### Migration

- `configureVisibility(MyState, ...)` calls become `static configureVisibility`
  methods on the class. Body is identical; signature lifts `MyState` to
  `VisibilityBuilder<Self>` (must be written explicitly — TS can't infer
  `Self` for statics).
- The runtime metadata pipeline reads `Class.configureVisibility?.(builder)`
  instead of looking up the WeakMap registered by the free function. The
  metadata shape on the receiving side stays unchanged.
- Codegen (`generate-types`) becomes optional. Existing consumers can drop the
  generated import; new consumers don't need to wire it.

## Trade-offs

### Wins

- **No codegen for view types.** The runtime config is the source of truth at
  both type and value level; staying in sync is automatic.
- **Visibility config lives next to the state class** — discoverability
  improves; module-scope side effects go away.
- **OOP-native.** Pure inheritance, no decorators added, no global
  registrations. Reads as "this class extends `GameState` and configures its
  own visibility."
- **One source of truth in the engine.** Type-level and runtime-level
  visibility derive from the same `configureVisibility` body.

### Costs

- **Adds one more type-level pass over the state tree.** The engine already
  walks the tree via `CanonicalGameState<TState>` (canonical.ts:17) to strip
  methods and produce the plain-data shape. `ApplyVisibility` does another
  walk of the same shape — same nesting, same recursion structure — with a
  per-field lookup against the visibility config tuple
  (`Extract<Config["fields"][number], { fieldName: K }>`). Cost is roughly
  additive (≈2× the existing walk), not compounding. TS's instantiation
  depth limit is unaffected unless the state tree is already brushing the
  limit for canonical-state derivation.
- **Type-error messages get harder to read.** When a `derive` return doesn't
  match its `schema`, the error surfaces through `ApplyVisibility`'s
  conditional chain — multi-line, deeply nested types that consumers will
  have to learn to parse. Codegen-emitted flat types fail more clearly.
- **`Self` cannot be inferred for statics.** Each class has to write
  `VisibilityBuilder<TheClassName>` in its static signature. Mechanical, but
  a small papercut compared to today's `configureVisibility<MyState>(...)`
  free-function generic.
- **No type-level reflection for non-class consumers.** Anything outside
  TypeScript (other generators, schemas, documentation tools) still needs
  the runtime metadata path. Codegen remains the answer for those use
  cases.
- **TS can't statically catch a missing static method.** Classes without
  `static configureVisibility` are treated as "no visibility config" — same
  as today's classes without a `configureVisibility(...)` call. Compile-time
  forgetfulness is on par with today.

### Decision criteria

Adopt this design if:

- View-type accuracy matters more than codegen tooling investment.
- Non-TS consumers of the view shape are minimal or already served by
  codegen as a separate output.

Keep codegen as the source of truth if:

- The view shape needs to be consumed by non-TS tooling (e.g. JSON Schema,
  OpenAPI, AsyncAPI, other generators downstream).

The two are not mutually exclusive — type-level derivation can be the default
authoring story, while codegen continues to emit flat `.d.ts` files for
non-TS consumers who need them.

## Open Questions

- Does `ApplyVisibility` cleanly handle `Record<string, NestedClass>` and
  arrays of nested classes? Should mirror `CanonicalGameState`'s recursion
  pattern. Needs a prototype on the Splendor state to confirm the lookup
  shape `Extract<Config["fields"][number], { fieldName: K }>` cooperates
  with TS inference for nested classes.
- How does `visible_to_self` typecheck at the consumer? `T | HiddenValue<...>`
  forces consumers to narrow on every read — acceptable, or do we want a
  viewer-parameterized projection?
- Should `static configureVisibility` be optional or required? Optional keeps
  migration painless; required gives a stronger "every state class is
  explicit" signal.
