import { Console, Effect } from "effect";
import type { Route } from "./+types/api.lessons.$lessonId.create-on-disk";
import { DBFunctionsService } from "@/services/db-service.server";
import { RepoWriteService } from "@/services/repo-write-service";
import { runtimeLive } from "@/services/layer.server";
import { withDatabaseDump } from "@/services/dump-service";
import {
  toSlug,
  computeInsertionPlan,
  parseLessonPath,
} from "@/services/lesson-path-service";
import { data } from "react-router";

const parseSectionNumber = (sectionPath: string): number => {
  const match = sectionPath.match(/^(\d+)/);
  return match ? Number(match[1]) : 1;
};

export const action = async (args: Route.ActionArgs) => {
  return Effect.gen(function* () {
    const db = yield* DBFunctionsService;
    const repoWrite = yield* RepoWriteService;

    const lesson = yield* db.getLessonWithHierarchyById(args.params.lessonId);

    if (lesson.fsStatus !== "ghost") {
      return Effect.die(data("Lesson is already on disk", { status: 400 }));
    }

    const repoPath = lesson.section.repoVersion.repo.filePath;
    const sectionPath = lesson.section.path;
    const sectionNumber = parseSectionNumber(sectionPath);
    const slug =
      toSlug(lesson.title || "") || toSlug(lesson.path) || "untitled";

    // Get all lessons in the section to determine insert position
    const sectionLessons = yield* db.getLessonsBySectionId(lesson.sectionId);
    const ghostOrder = lesson.order;

    // Find the ghost's position among real lessons only (sorted by order)
    const realLessons = sectionLessons.filter((l) => l.fsStatus !== "ghost");
    let insertAtIndex = realLessons.length; // default: append at end
    for (let i = 0; i < realLessons.length; i++) {
      if (realLessons[i]!.order > ghostOrder) {
        insertAtIndex = i;
        break;
      }
    }

    const existingRealLessons = realLessons.map((l) => ({
      id: l.id,
      path: l.path,
    }));

    const plan = computeInsertionPlan({
      existingRealLessons,
      insertAtIndex,
      sectionNumber,
      slug,
    });

    // Rename shifted lessons on disk first
    if (plan.renames.length > 0) {
      yield* repoWrite.renameLessons({
        repoPath,
        sectionPath,
        renames: plan.renames.map((r) => ({
          oldPath: r.oldPath,
          newPath: r.newPath,
        })),
      });

      // Update DB paths for renamed lessons
      for (const rename of plan.renames) {
        const parsed = parseLessonPath(rename.newPath);
        if (parsed) {
          yield* db.updateLesson(rename.id, {
            path: rename.newPath,
          });
        }
      }
    }

    // Create the lesson directory on the filesystem
    yield* repoWrite.createLessonDirectory({
      repoPath,
      sectionPath,
      lessonDirName: plan.newLessonDirName,
    });

    // Update lesson: set fsStatus to real and update path
    // Note: do NOT pass lessonNumber here — it would overwrite the order field
    yield* db.updateLesson(args.params.lessonId, {
      fsStatus: "real",
      path: plan.newLessonDirName,
      sectionId: lesson.sectionId,
    });

    return { success: true, path: plan.newLessonDirName };
  }).pipe(
    withDatabaseDump,
    Effect.tapErrorCause((e) => Console.dir(e, { depth: null })),
    Effect.catchTag("NotFoundError", () => {
      return Effect.die(data("Lesson not found", { status: 404 }));
    }),
    Effect.catchAll(() => {
      return Effect.die(data("Internal server error", { status: 500 }));
    }),
    runtimeLive.runPromise
  );
};
