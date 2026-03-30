import { describe, it, expect } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { DatabaseDumpService, withDatabaseDump } from "./dump-service";

describe("withDatabaseDump", () => {
  it.effect(
    "does not propagate errors when dump fails, preserving the main effect's value",
    () =>
      Effect.gen(function* () {
        const result =
          yield* Effect.succeed("main-result").pipe(withDatabaseDump);
        expect(result).toBe("main-result");
      }).pipe(
        Effect.provide(
          Layer.succeed(DatabaseDumpService, {
            dump: () => Effect.fail(new Error("dump failed") as never),
          } as any)
        )
      )
  );

  it.effect("returns the main effect's value when dump succeeds", () =>
    Effect.gen(function* () {
      const result =
        yield* Effect.succeed("main-result").pipe(withDatabaseDump);
      expect(result).toBe("main-result");
    }).pipe(
      Effect.provide(
        Layer.succeed(DatabaseDumpService, {
          dump: () => Effect.void,
        } as any)
      )
    )
  );
});
