import { Console, Effect } from "effect";
import type { Route } from "./+types/api.sections.$sectionId.unlinked-directories";
import { DBFunctionsService } from "@/services/db-service.server";
import { runtimeLive } from "@/services/layer.server";
import { FileSystem } from "@effect/platform";
import { data } from "react-router";
import {
  getSectionAndLessonNumberFromPath,
  notFound,
} from "@/services/repo-parser";

export const loader = async (args: Route.LoaderArgs) => {
  return Effect.gen(function* () {
    const db = yield* DBFunctionsService;
    const fs = yield* FileSystem.FileSystem;

    const section = yield* db.getSectionWithHierarchyById(
      args.params.sectionId
    );

    const repoPath = section.repoVersion.repo.filePath;
    const sectionDir = `${repoPath}/${section.path}`;

    // Read all directories in the section
    const entries = yield* fs
      .readDirectory(sectionDir)
      .pipe(Effect.catchAll(() => Effect.succeed([] as string[])));

    // Filter to only lesson-like directories (start with a number)
    const lessonDirs = entries.filter((entry) => {
      const parsed = getSectionAndLessonNumberFromPath(
        `${section.path}/${entry}`
      );
      return parsed !== notFound;
    });

    // Get all real lessons in this section to find which dirs are already linked
    const lessons = yield* db.getLessonsBySectionId(args.params.sectionId);
    const linkedPaths = new Set(
      lessons.filter((l) => l.fsStatus === "real").map((l) => l.path)
    );

    // Return directories not linked to any lesson
    const unlinkedDirs = lessonDirs.filter((dir) => !linkedPaths.has(dir));

    return { directories: unlinkedDirs };
  }).pipe(
    Effect.tapErrorCause((e) => Console.dir(e, { depth: null })),
    Effect.catchTag("NotFoundError", () => {
      return Effect.die(data("Section not found", { status: 404 }));
    }),
    Effect.catchAll(() => {
      return Effect.die(data("Internal server error", { status: 500 }));
    }),
    runtimeLive.runPromise
  );
};
