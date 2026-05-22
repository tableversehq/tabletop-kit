import { describe, expect, test } from "bun:test";
import { createInProcessClient } from "../src/adapters/in-process.ts";

interface FakeState {
  game: { counter: number };
  runtime: { tick: number };
}

interface FakeExecutorCalls {
  getView: number;
  listAvailableCommands: number;
  discover: unknown[];
  execute: unknown[];
}

function buildFakeExecutor(initialCounter = 0) {
  const calls: FakeExecutorCalls = {
    getView: 0,
    listAvailableCommands: 0,
    discover: [],
    execute: [],
  };
  const startCounter = initialCounter;

  const executor = {
    createInitialState: () => ({
      game: { counter: startCounter },
      runtime: { tick: 0 },
    }),
    getView(state: FakeState) {
      calls.getView += 1;
      return { counter: state.game.counter };
    },
    listAvailableCommands() {
      calls.listAvailableCommands += 1;
      return ["increment"];
    },
    discoverCommand(_state: FakeState, discovery: unknown) {
      calls.discover.push(discovery);
      return { complete: true, input: { delta: 1 } };
    },
    executeCommand(state: FakeState, command: unknown) {
      calls.execute.push(command);
      const cmd = command as { input: { delta: number } };
      return {
        ok: true as const,
        state: {
          game: { counter: state.game.counter + cmd.input.delta },
          runtime: { tick: state.runtime.tick + 1 },
        },
        events: [{ type: "counter_changed", delta: cmd.input.delta }],
      };
    },
  };

  return { executor, calls };
}

describe("createInProcessClient", () => {
  test("getView delegates to executor with viewer context", () => {
    const { executor, calls } = buildFakeExecutor();
    const client = createInProcessClient(executor as never, {
      viewerId: "p1",
      initialState: { game: { counter: 5 }, runtime: { tick: 0 } },
    });

    expect(client.getView()).toEqual({ counter: 5 });
    expect(calls.getView).toBe(1);
  });

  test("execute applies state, bumps version, notifies subscribers, fans out events", async () => {
    const { executor } = buildFakeExecutor();
    const client = createInProcessClient(executor as never, {
      viewerId: "p1",
      initialState: { game: { counter: 0 }, runtime: { tick: 0 } },
    });

    let subscribeCalls = 0;
    const events: unknown[] = [];
    client.subscribe(() => {
      subscribeCalls += 1;
    });
    client.onEvent((event) => {
      events.push(event);
    });

    const result = await client.execute({
      type: "increment",
      input: { delta: 3 },
    });
    expect(result).toEqual({ accepted: true });
    expect(client.getView()).toEqual({ counter: 3 });
    expect(client.getStateVersion()).toBe(1);
    expect(subscribeCalls).toBe(1);
    expect(events).toEqual([{ type: "counter_changed", delta: 3 }]);
  });

  test("execute injects actorId from viewerId", async () => {
    const { executor, calls } = buildFakeExecutor();
    const client = createInProcessClient(executor as never, {
      viewerId: "alice",
      initialState: { game: { counter: 0 }, runtime: { tick: 0 } },
    });

    await client.execute({ type: "increment", input: { delta: 1 } });
    expect(calls.execute).toEqual([
      { type: "increment", actorId: "alice", input: { delta: 1 } },
    ]);
  });

  test("execute rejection surfaces reason and does not update state", async () => {
    const { executor } = buildFakeExecutor();
    executor.executeCommand = (() => ({
      ok: false as const,
      state: {
        game: { counter: 0 },
        runtime: { tick: 0 },
      },
      reason: "not_allowed",
      events: [],
    })) as never;
    const client = createInProcessClient(executor as never, {
      viewerId: "p1",
      initialState: { game: { counter: 0 }, runtime: { tick: 0 } },
    });

    let subscribeCalls = 0;
    client.subscribe(() => {
      subscribeCalls += 1;
    });

    const result = await client.execute({ type: "bad", input: {} });
    expect(result).toEqual({ accepted: false, reason: "not_allowed" });
    expect(client.getStateVersion()).toBe(0);
    expect(subscribeCalls).toBe(0);
  });

  test("discover injects actorId and resolves with engine result", async () => {
    const { executor, calls } = buildFakeExecutor();
    const client = createInProcessClient(executor as never, {
      viewerId: "p1",
      initialState: { game: { counter: 0 }, runtime: { tick: 0 } },
    });

    const result = await client.discover({
      type: "increment",
      step: "init",
      input: {},
    });
    expect(result).toEqual({ complete: true, input: { delta: 1 } });
    expect(calls.discover).toEqual([
      { type: "increment", actorId: "p1", step: "init", input: {} },
    ]);
  });

  test("discover rejects when executor returns null", async () => {
    const { executor } = buildFakeExecutor();
    executor.discoverCommand = () => null as never;
    const client = createInProcessClient(executor as never, {
      viewerId: "p1",
      initialState: { game: { counter: 0 }, runtime: { tick: 0 } },
    });

    await expect(
      client.discover({ type: "nope", step: "init", input: {} }),
    ).rejects.toThrow(/no discovery defined/);
  });

  test("unsubscribe stops notifications", async () => {
    const { executor } = buildFakeExecutor();
    const client = createInProcessClient(executor as never, {
      viewerId: "p1",
      initialState: { game: { counter: 0 }, runtime: { tick: 0 } },
    });

    let count = 0;
    const unsubscribe = client.subscribe(() => {
      count += 1;
    });
    await client.execute({ type: "increment", input: { delta: 1 } });
    expect(count).toBe(1);
    unsubscribe();
    await client.execute({ type: "increment", input: { delta: 1 } });
    expect(count).toBe(1);
  });

  test("dispose clears listeners and getView returns null", async () => {
    const { executor } = buildFakeExecutor();
    const client = createInProcessClient(executor as never, {
      viewerId: "p1",
      initialState: { game: { counter: 0 }, runtime: { tick: 0 } },
    });

    let count = 0;
    client.subscribe(() => {
      count += 1;
    });
    client.dispose();
    expect(client.getView()).toBeNull();
    expect(client.getStateVersion()).toBeNull();
    await expect(
      client.execute({ type: "increment", input: { delta: 1 } }),
    ).rejects.toThrow(/disposed/);
    expect(count).toBe(0);
  });
});
