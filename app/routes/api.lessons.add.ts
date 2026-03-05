import { Console, Effect, Schema } from "effect";
import type { Route } from "./+types/api.lessons.add";
import { DBFunctionsService } from "@/services/db-service.server";
import { RepoWriteService } from "@/services/repo-write-service";
import { runtimeLive } from "@/services/layer.server";
import { withDatabaseDump } from "@/services/dump-service";
import { data } from "react-router";

const addLessonSchema = Schema.Struct({
  sectionId: Schema.String.pipe(
    Schema.minLength(1, { message: () => "Section ID is required" })
  ),
  slug: Schema.String.pipe(
    Schema.minLength(1, { message: () => "Slug is required" }),
    Schema.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: () =>
        "Slug must contain only lowercase letters, digits, and dashes",
    })
  ),
});

const parseSectionNumber = (sectionPath: string): number => {
  const match = sectionPath.match(/^(\d+)/);
  return match ? Number(match[1]) : 1;
};

export const action = async (args: Route.ActionArgs) => {
  const formData = await args.request.formData();
  const formDataObject = Object.fromEntries(formData);

  return Effect.gen(function* () {
    const { sectionId, slug } =
      yield* Schema.decodeUnknown(addLessonSchema)(formDataObject);

    const db = yield* DBFunctionsService;
    const repoWrite = yield* RepoWriteService;

    // Get section with its hierarchy to find repo path
    const section = yield* db.getSectionWithHierarchyById(sectionId);
    const repoPath = section.repoVersion.repo.filePath;
    const sectionPath = section.path;
    const sectionNumber = parseSectionNumber(sectionPath);

    // Create the lesson directory on the filesystem
    const { lessonDirName, lessonNumber } = yield* repoWrite.addLesson({
      repoPath,
      sectionPath,
      sectionNumber,
      slug,
    });

    // Create the lesson in the database
    const [newLesson] = yield* db.createLessons(sectionId, [
      {
        lessonPathWithNumber: lessonDirName,
        lessonNumber,
      },
    ]);

    return { success: true, lessonId: newLesson!.id, path: lessonDirName };
  }).pipe(
    withDatabaseDump,
    Effect.tapErrorCause((e) => Console.dir(e, { depth: null })),
    Effect.catchTag("ParseError", () => {
      return Effect.die(data("Invalid request", { status: 400 }));
    }),
    Effect.catchTag("NotFoundError", () => {
      return Effect.die(data("Section not found", { status: 404 }));
    }),
    Effect.catchAll(() => {
      return Effect.die(data("Internal server error", { status: 500 }));
    }),
    runtimeLive.runPromise
  );
};
