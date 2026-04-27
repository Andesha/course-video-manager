import { Config, Effect, Queue } from "effect";
import { DBFunctionsService } from "./db-service.server";
import { FileSystem } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";

export class DatabaseDumpService extends Effect.Service<DatabaseDumpService>()(
  "DatabaseDumpService",
  {
    effect: Effect.gen(function* () {
      const db = yield* DBFunctionsService;
      const fs = yield* FileSystem.FileSystem;
      const DUMP_FILE_LOCATION = yield* Config.string("DUMP_FILE_LOCATION");

      const runDump = Effect.fn("dump")(function* () {
        const courses = yield* db.getCourses();

        const courseDumps = yield* Effect.all(
          courses.map((course) => db.getCourseWithSectionsById(course.id)),
          { concurrency: "unbounded" }
        );

        yield* fs.writeFileString(
          DUMP_FILE_LOCATION,
          JSON.stringify(courseDumps)
        );
      });

      // Sliding(1) coalesces bursts: while a dump is running, additional
      // requests collapse into a single trailing dump. Worst case per burst:
      // one in-flight dump + one queued. Last write always reflects latest state.
      const queue = yield* Queue.sliding<void>(1);

      yield* Effect.forkDaemon(
        Queue.take(queue).pipe(
          Effect.zipRight(runDump().pipe(Effect.ignore)),
          Effect.forever
        )
      );

      const requestDump = Queue.offer(queue, undefined).pipe(Effect.asVoid);

      return {
        requestDump,
      };
    }),
    dependencies: [NodeFileSystem.layer, DBFunctionsService.Default],
  }
) {}

export const withDatabaseDump = Effect.tap(() =>
  Effect.gen(function* () {
    const dbService = yield* DatabaseDumpService;
    yield* dbService.requestDump;
  })
);
