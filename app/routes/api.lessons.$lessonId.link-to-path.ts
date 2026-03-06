import { Console, Effect, Schema } from "effect";
import type { Route } from "./+types/api.lessons.$lessonId.link-to-path";
import { DBFunctionsService } from "@/services/db-service.server";
import { runtimeLive } from "@/services/layer.server";
import { withDatabaseDump } from "@/services/dump-service";
import { FileSystem } from "@effect/platform";
import { data } from "react-router";
import { parseLessonPath } from "@/services/lesson-path-service";

const linkToPathSchema = Schema.Struct({
  path: Schema.String.pipe(
    Schema.minLength(1, { message: () => "Path is required" })
  ),
});

export const action = async (args: Route.ActionArgs) => {
  const formData = await args.request.formData();
  const formDataObject = Object.fromEntries(formData);

  return Effect.gen(function* () {
    const { path: dirPath } =
      yield* Schema.decodeUnknown(linkToPathSchema)(formDataObject);

    const db = yield* DBFunctionsService;
    const fs = yield* FileSystem.FileSystem;

    const lesson = yield* db.getLessonWithHierarchyById(args.params.lessonId);

    if (lesson.fsStatus !== "ghost") {
      return Effect.die(data("Lesson is already on disk", { status: 400 }));
    }

    // Verify the directory exists on disk
    const repoPath = lesson.section.repoVersion.repo.filePath;
    const sectionPath = lesson.section.path;
    const fullPath = `${repoPath}/${sectionPath}/${dirPath}`;

    const exists = yield* fs.exists(fullPath);
    if (!exists) {
      return Effect.die(
        data("Directory does not exist on disk", { status: 400 })
      );
    }

    // Parse the lesson number from the directory name
    const parsed = parseLessonPath(dirPath);
    const lessonNumber = parsed?.lessonNumber;

    // Update lesson: set fsStatus to real and update path
    yield* db.updateLesson(args.params.lessonId, {
      fsStatus: "real",
      path: dirPath,
      sectionId: lesson.sectionId,
      ...(lessonNumber != null ? { lessonNumber } : {}),
    });

    return { success: true, path: dirPath };
  }).pipe(
    withDatabaseDump,
    Effect.tapErrorCause((e) => Console.dir(e, { depth: null })),
    Effect.catchTag("ParseError", () => {
      return Effect.die(data("Invalid request", { status: 400 }));
    }),
    Effect.catchTag("NotFoundError", () => {
      return Effect.die(data("Lesson not found", { status: 404 }));
    }),
    Effect.catchAll(() => {
      return Effect.die(data("Internal server error", { status: 500 }));
    }),
    runtimeLive.runPromise
  );
};
