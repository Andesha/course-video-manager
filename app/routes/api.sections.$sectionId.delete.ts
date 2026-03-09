import { Console, Effect } from "effect";
import type { Route } from "./+types/api.sections.$sectionId.delete";
import { CourseWriteService } from "@/services/course-write-service";
import { runtimeLive } from "@/services/layer.server";
import { withDatabaseDump } from "@/services/dump-service";
import { withSyncValidation } from "@/services/repo-sync-validation";
import { data } from "react-router";

export const action = async (args: Route.ActionArgs) => {
  return Effect.gen(function* () {
    const service = yield* CourseWriteService;
    return yield* service.deleteSection(args.params.sectionId);
  }).pipe(
    withSyncValidation,
    withDatabaseDump,
    Effect.tapErrorCause((e) => Console.dir(e, { depth: null })),
    Effect.catchTag("RepoSyncError", (e) => {
      return Effect.die(data(e.message, { status: 409 }));
    }),
    Effect.catchTag("NotFoundError", () => {
      return Effect.die(data("Section not found", { status: 404 }));
    }),
    Effect.catchTag("CourseWriteError", (e) => {
      return Effect.die(data(e.message, { status: 400 }));
    }),
    Effect.catchAll(() => {
      return Effect.die(data("Internal server error", { status: 500 }));
    }),
    runtimeLive.runPromise
  );
};
