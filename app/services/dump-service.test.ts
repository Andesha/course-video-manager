import { describe, it, expect } from "@effect/vitest";
import { Effect, Exit, Layer, Cause } from "effect";
import { DatabaseDumpService, withDatabaseDump } from "./dump-service";

const noopDumpLayer = Layer.succeed(DatabaseDumpService, {
  requestDump: Effect.void,
} as any);

describe("withDatabaseDump", () => {
  it.effect("returns the main effect's value", () =>
    Effect.gen(function* () {
      const result =
        yield* Effect.succeed("main-result").pipe(withDatabaseDump);
      expect(result).toBe("main-result");
    }).pipe(Effect.provide(noopDumpLayer))
  );

  it.effect("propagates the main effect's failure", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.fail("main-error")
        .pipe(withDatabaseDump)
        .pipe(Effect.exit);
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const failure = Cause.failureOption(exit.cause);
        expect(failure._tag).toBe("Some");
        if (failure._tag === "Some") {
          expect(failure.value).toBe("main-error");
        }
      }
    }).pipe(Effect.provide(noopDumpLayer))
  );
});
