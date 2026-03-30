import { describe, it, expect } from "@effect/vitest";
import { Cause, Effect, Exit, Layer } from "effect";
import { DatabaseDumpService, withDatabaseDump } from "./dump-service";

const succeedingDumpLayer = Layer.succeed(DatabaseDumpService, {
  dump: () => Effect.void,
} as any);

const failingDumpLayer = Layer.succeed(DatabaseDumpService, {
  dump: () => Effect.fail(new Error("dump failed") as never),
} as any);

describe("withDatabaseDump", () => {
  it.effect(
    "does not propagate errors when dump fails, preserving the main effect's value",
    () =>
      Effect.gen(function* () {
        const result =
          yield* Effect.succeed("main-result").pipe(withDatabaseDump);
        expect(result).toBe("main-result");
      }).pipe(Effect.provide(failingDumpLayer))
  );

  it.effect("returns the main effect's value when dump succeeds", () =>
    Effect.gen(function* () {
      const result =
        yield* Effect.succeed("main-result").pipe(withDatabaseDump);
      expect(result).toBe("main-result");
    }).pipe(Effect.provide(succeedingDumpLayer))
  );

  it.effect(
    "propagates the main effect's failure even when dump succeeds",
    () =>
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
      }).pipe(Effect.provide(succeedingDumpLayer))
  );

  it.effect(
    "propagates defects from the dump (Effect.ignore only swallows typed errors)",
    () =>
      Effect.gen(function* () {
        const exit = yield* Effect.succeed("main-result")
          .pipe(withDatabaseDump)
          .pipe(Effect.exit);
        expect(Exit.isFailure(exit)).toBe(true);
        if (Exit.isFailure(exit)) {
          const defect = Cause.dieOption(exit.cause);
          expect(defect._tag).toBe("Some");
          if (defect._tag === "Some") {
            expect(defect.value).toBe("dump-defect");
          }
        }
      }).pipe(
        Effect.provide(
          Layer.succeed(DatabaseDumpService, {
            dump: () => Effect.die("dump-defect"),
          } as any)
        )
      )
  );
});
