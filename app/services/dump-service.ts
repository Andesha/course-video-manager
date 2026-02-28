import { Config, Effect } from "effect";
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

      const dump = Effect.fn("dump")(function* () {
        const repos = yield* db.getRepos();

        const repoDumps = yield* Effect.all(
          repos.map((repo) => db.getRepoWithSectionsById(repo.id))
        );

        yield* fs.writeFileString(
          DUMP_FILE_LOCATION,
          JSON.stringify(repoDumps, null, 2)
        );
      });

      return {
        dump,
      };
    }),
    dependencies: [NodeFileSystem.layer, DBFunctionsService.Default],
  }
) {}

export const withDatabaseDump = Effect.tap(() =>
  Effect.gen(function* () {
    const dbService = yield* DatabaseDumpService;
    yield* dbService.dump();
  })
);
