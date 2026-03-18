import { Effect } from "effect";
import { FileSystem } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import { execFileSync } from "node:child_process";
import nodePath from "node:path";
import { DBFunctionsService } from "./db-service.server";
import { CourseRepoWriteService } from "./course-repo-write-service";
import {
  toSlug,
  computeInsertionPlan,
  computeRenumberingPlan,
  parseLessonPath,
  buildLessonPath,
} from "./lesson-path-service";
import {
  parseSectionPath,
  buildSectionPath,
  titleFromSlug,
} from "./section-path-service";
import { createSectionOps } from "./course-write-service.helpers";
import { CourseWriteError } from "./course-write-service.types";
import {
  CourseRepoSyncValidationService,
  CourseRepoSyncError,
} from "./course-repo-sync-validation";

export { CourseWriteError } from "./course-write-service.types";
export { CourseRepoSyncError } from "./course-repo-sync-validation";

export class CourseWriteService extends Effect.Service<CourseWriteService>()(
  "CourseWriteService",
  {
    effect: Effect.gen(function* () {
      const db = yield* DBFunctionsService;
      const repoWrite = yield* CourseRepoWriteService;
      const syncService = yield* CourseRepoSyncValidationService;
      const fileSystem = yield* FileSystem.FileSystem;

      const runValidation = syncService.validate().pipe(
        Effect.catchAll((e) => {
          if (e._tag === "CourseRepoSyncError") return Effect.fail(e);
          return Effect.fail(
            new CourseRepoSyncError({
              cause: e,
              message: `Sync validation encountered an error: ${String(e)}`,
            })
          );
        })
      );

      const withSyncValidation = <A, E>(
        effect: Effect.Effect<A, E>
      ): Effect.Effect<A, E | CourseRepoSyncError> =>
        Effect.gen(function* () {
          yield* runValidation;
          const result = yield* effect;
          yield* runValidation;
          return result;
        });

      const { renumberSections, reorderSections, renameSection } =
        createSectionOps(db, repoWrite);

      /** Materializes a ghost lesson to disk. */
      const materializeGhost = Effect.fn("materializeGhost")(function* (
        lessonId: string
      ) {
        const lesson = yield* db.getLessonWithHierarchyById(lessonId);

        if (lesson.fsStatus !== "ghost") {
          return yield* new CourseWriteError({
            cause: null,
            message: "Lesson is already on disk",
          });
        }

        const repoPath = lesson.section.repoVersion.repo.filePath!;
        const repoVersionId = lesson.section.repoVersionId;
        let sectionPath = lesson.section.path;
        const parsed = parseSectionPath(sectionPath);
        const slug =
          toSlug(lesson.title || "") || toSlug(lesson.path) || "untitled";

        // If the section path is not a valid NN-slug format, it's a ghost section
        // that needs to be materialized (title → slugified path)
        let sectionMaterialized = false;
        let sectionNumber: number;
        if (!parsed) {
          // Compute the correct section number: count real sections before
          // this one, plus 1 for itself.
          const allSections =
            yield* db.getSectionsByRepoVersionId(repoVersionId);
          const positionIndex = allSections.findIndex(
            (s) => s.id === lesson.sectionId
          );
          let realBefore = 0;
          for (let i = 0; i < positionIndex; i++) {
            if (parseSectionPath(allSections[i]!.path)) realBefore++;
          }
          sectionNumber = realBefore + 1;

          const sectionSlug = toSlug(sectionPath) || "untitled";
          sectionPath = buildSectionPath(sectionNumber, sectionSlug);
          yield* db.updateSectionPath(lesson.sectionId, sectionPath);
          sectionMaterialized = true;
        } else {
          sectionNumber = parsed.sectionNumber;
        }

        // Get all lessons in the section to determine insert position
        const sectionLessons = yield* db.getLessonsBySectionId(
          lesson.sectionId
        );
        const ghostOrder = lesson.order;

        // Find the ghost's position among real lessons only (sorted by order)
        const realLessons = sectionLessons.filter(
          (l) => l.fsStatus !== "ghost"
        );
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
            const renamedParsed = parseLessonPath(rename.newPath);
            if (renamedParsed) {
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
        yield* db.updateLesson(lessonId, {
          fsStatus: "real",
          path: plan.newLessonDirName,
          sectionId: lesson.sectionId,
        });

        // If a ghost section was materialized, renumber other sections
        if (sectionMaterialized) {
          yield* renumberSections(repoVersionId, repoPath);
        }

        return { success: true, path: plan.newLessonDirName };
      });

      /** Creates a ghost section in the database (no filesystem operations). */
      const addGhostSection = Effect.fn("addGhostSection")(function* (
        repoVersionId: string,
        title: string,
        maxOrder: number = 0
      ) {
        const sectionNumber = maxOrder + 1;
        const [newSection] = yield* db.createSections({
          repoVersionId,
          sections: [
            {
              sectionPathWithNumber: title,
              sectionNumber,
            },
          ],
        });

        return { success: true, sectionId: newSection!.id };
      });

      /** Creates a real lesson on disk + DB in one step (no ghost intermediate). */
      const createRealLesson = Effect.fn("createRealLesson")(function* (
        sectionId: string,
        title: string,
        opts?: { adjacentLessonId?: string; position?: "before" | "after" }
      ) {
        const section = yield* db.getSectionWithHierarchyById(sectionId);
        const repoPath = section.repoVersion.repo.filePath;

        if (!repoPath) {
          return yield* new CourseWriteError({
            cause: null,
            message:
              "Cannot create a real lesson in a ghost course",
          });
        }

        let sectionPath = section.path;
        const parsed = parseSectionPath(sectionPath);
        const slug = toSlug(title) || "untitled";
        const repoVersionId = section.repoVersionId;

        // If section is ghost, materialize it
        let sectionMaterialized = false;
        let sectionNumber: number;
        if (!parsed) {
          const allSections =
            yield* db.getSectionsByRepoVersionId(repoVersionId);
          const positionIndex = allSections.findIndex(
            (s) => s.id === sectionId
          );
          let realBefore = 0;
          for (let i = 0; i < positionIndex; i++) {
            if (parseSectionPath(allSections[i]!.path)) realBefore++;
          }
          sectionNumber = realBefore + 1;

          const sectionSlug = toSlug(sectionPath) || "untitled";
          sectionPath = buildSectionPath(sectionNumber, sectionSlug);
          yield* db.updateSectionPath(sectionId, sectionPath);
          sectionMaterialized = true;
        } else {
          sectionNumber = parsed.sectionNumber;
        }

        // Get all lessons in section
        const lessons = yield* db.getLessonsBySectionId(sectionId);
        const maxOrder =
          lessons.length > 0 ? Math.max(...lessons.map((l) => l.order)) : 0;
        let insertOrder = maxOrder + 1;

        const realLessons = lessons.filter((l) => l.fsStatus !== "ghost");
        let insertAtIndex = realLessons.length;

        if (opts?.adjacentLessonId && opts?.position) {
          const adjLesson = lessons.find(
            (l) => l.id === opts.adjacentLessonId
          );
          if (adjLesson) {
            const adjOrder = adjLesson.order;

            // Determine insert position among real lessons
            for (let i = 0; i < realLessons.length; i++) {
              if (
                opts.position === "before"
                  ? realLessons[i]!.order >= adjOrder
                  : realLessons[i]!.order > adjOrder
              ) {
                insertAtIndex = i;
                break;
              }
              if (i === realLessons.length - 1) {
                insertAtIndex = realLessons.length;
              }
            }

            // Shift orders for subsequent lessons
            const adjIdx = lessons.findIndex(
              (l) => l.id === opts.adjacentLessonId
            );
            if (adjIdx !== -1) {
              const idx = opts.position === "after" ? adjIdx + 1 : adjIdx;
              for (let i = idx; i < lessons.length; i++) {
                yield* db.updateLessonOrder(
                  lessons[i]!.id,
                  lessons[i]!.order + 1
                );
              }
              insertOrder = lessons[idx]
                ? lessons[idx]!.order
                : maxOrder + 1;
            }
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

        // Rename shifted lessons on disk
        if (plan.renames.length > 0) {
          yield* repoWrite.renameLessons({
            repoPath,
            sectionPath,
            renames: plan.renames.map((r) => ({
              oldPath: r.oldPath,
              newPath: r.newPath,
            })),
          });

          for (const rename of plan.renames) {
            yield* db.updateLesson(rename.id, { path: rename.newPath });
          }
        }

        // Create directory on disk
        yield* repoWrite.createLessonDirectory({
          repoPath,
          sectionPath,
          lessonDirName: plan.newLessonDirName,
        });

        // Create DB entry as ghost, then update to real
        const [newLesson] = yield* db.createGhostLesson(sectionId, {
          title,
          path: plan.newLessonDirName,
          order: insertOrder,
        });

        yield* db.updateLesson(newLesson!.id, { fsStatus: "real" });

        // Renumber sections if we materialized one
        if (sectionMaterialized) {
          yield* renumberSections(repoVersionId, repoPath);
        }

        return {
          success: true,
          lessonId: newLesson!.id,
          path: plan.newLessonDirName,
        };
      });

      /** Materialization Cascade: assigns filePath to a ghost course, then creates a real lesson.
       *  Materializes the section and lesson in one flow. */
      const materializeCourseWithLesson = Effect.fn(
        "materializeCourseWithLesson"
      )(function* (
        sectionId: string,
        title: string,
        filePath: string,
        opts?: { adjacentLessonId?: string; position?: "before" | "after" }
      ) {
        const section = yield* db.getSectionWithHierarchyById(sectionId);
        const courseId = section.repoVersion.repo.id;
        const originalSectionPath = section.path;

        if (section.repoVersion.repo.filePath) {
          return yield* new CourseWriteError({
            cause: null,
            message: "Course already has a file path — use createRealLesson instead",
          });
        }

        // Validate filePath points to an existing directory
        const stat = yield* fileSystem.stat(filePath).pipe(
          Effect.catchAll(() =>
            Effect.fail(
              new CourseWriteError({
                cause: null,
                message: `File path does not exist: ${filePath}`,
              })
            )
          )
        );

        if (stat.type !== "Directory") {
          return yield* new CourseWriteError({
            cause: null,
            message: `File path is not a directory: ${filePath}`,
          });
        }

        // Validate filePath is a git repository before making any changes
        yield* Effect.try({
          try: () =>
            execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
              cwd: filePath,
              stdio: "pipe",
            }),
          catch: () =>
            new CourseWriteError({
              cause: null,
              message: `Directory is not a git repository: ${filePath}`,
            }),
        });

        // Snapshot directory contents before making changes, for cleanup on failure
        const entriesBefore = yield* fileSystem
          .readDirectory(filePath)
          .pipe(Effect.catchAll(() => Effect.succeed([] as string[])));

        // Assign file path to the ghost course — this makes it permanently real
        yield* db.updateCourseFilePath({ repoId: courseId, filePath });

        // Delegate to createRealLesson; rollback DB + filesystem changes if it fails
        return yield* createRealLesson(sectionId, title, opts).pipe(
          Effect.catchAll((error) =>
            Effect.gen(function* () {
              // Rollback: revert course filePath to null
              yield* db.updateCourseFilePath({ repoId: courseId, filePath: null });
              // Rollback: revert section path if it was changed
              yield* db.updateSectionPath(sectionId, originalSectionPath);
              // Cleanup: remove any new directories created inside the repo
              const entriesAfter = yield* fileSystem
                .readDirectory(filePath)
                .pipe(Effect.catchAll(() => Effect.succeed([] as string[])));
              const beforeSet = new Set(entriesBefore);
              for (const entry of entriesAfter) {
                if (!beforeSet.has(entry)) {
                  yield* fileSystem
                    .remove(nodePath.join(filePath, entry), { recursive: true })
                    .pipe(Effect.catchAll(() => Effect.void));
                }
              }
              return yield* Effect.fail(error);
            })
          )
        );
      });

      /** Creates a ghost lesson. Supports optional insertion before/after a lesson. */
      const addGhostLesson = Effect.fn("addGhostLesson")(function* (
        sectionId: string,
        title: string,
        opts?: { adjacentLessonId?: string; position?: "before" | "after" }
      ) {
        const lessons = yield* db.getLessonsBySectionId(sectionId);
        const maxOrder =
          lessons.length > 0 ? Math.max(...lessons.map((l) => l.order)) : 0;
        let insertOrder = maxOrder + 1;

        if (opts?.adjacentLessonId && opts?.position) {
          const adjIdx = lessons.findIndex(
            (l) => l.id === opts.adjacentLessonId
          );
          if (adjIdx !== -1) {
            const idx = opts.position === "after" ? adjIdx + 1 : adjIdx;
            for (let i = idx; i < lessons.length; i++) {
              yield* db.updateLessonOrder(
                lessons[i]!.id,
                lessons[i]!.order + 1
              );
            }
            insertOrder = lessons[idx] ? lessons[idx]!.order : maxOrder + 1;
          }
        }

        const [newLesson] = yield* db.createGhostLesson(sectionId, {
          title,
          path: toSlug(title) || "untitled",
          order: insertOrder,
        });
        return { success: true, lessonId: newLesson!.id };
      });

      /** Deletes a lesson. If real, removes the directory from disk first,
       *  renumbers remaining lessons, and reverts section if no real lessons remain. */
      const deleteLesson = Effect.fn("deleteLesson")(function* (
        lessonId: string
      ) {
        const lesson = yield* db.getLessonWithHierarchyById(lessonId);

        if (lesson.fsStatus !== "ghost") {
          const repoPath = lesson.section.repoVersion.repo.filePath!;
          const sectionPath = lesson.section.path;
          const parsed = parseSectionPath(sectionPath);
          const sectionNumber = parsed?.sectionNumber ?? 1;

          yield* repoWrite.deleteLesson({
            repoPath,
            sectionPath,
            lessonDirName: lesson.path,
          });

          // Delete DB entry before renumbering so it's excluded
          yield* db.deleteLesson(lessonId);

          // Renumber remaining real lessons to close the gap
          const sectionLessons = yield* db.getLessonsBySectionId(
            lesson.sectionId
          );
          const remainingReal = sectionLessons.filter(
            (l) => l.fsStatus !== "ghost"
          );

          if (remainingReal.length > 0) {
            const renames: { id: string; oldPath: string; newPath: string }[] =
              [];
            for (let i = 0; i < remainingReal.length; i++) {
              const l = remainingReal[i]!;
              const p = parseLessonPath(l.path);
              if (!p) continue;
              const newPath = buildLessonPath(sectionNumber, i + 1, p.slug);
              if (newPath !== l.path) {
                renames.push({ id: l.id, oldPath: l.path, newPath });
              }
            }

            if (renames.length > 0) {
              yield* repoWrite.renameLessons({
                repoPath,
                sectionPath,
                renames: renames.map((r) => ({
                  oldPath: r.oldPath,
                  newPath: r.newPath,
                })),
              });

              for (const rename of renames) {
                yield* db.updateLesson(rename.id, {
                  path: rename.newPath,
                });
              }
            }
          }

          // If no real lessons remain, remove the section directory,
          // revert the section path to title case, and renumber other sections
          if (remainingReal.length === 0) {
            const sectionParsed = parseSectionPath(sectionPath);
            if (sectionParsed) {
              yield* repoWrite.deleteSectionDir({ repoPath, sectionPath });
              const title = titleFromSlug(sectionParsed.slug);
              yield* db.updateSectionPath(lesson.sectionId, title);
              yield* renumberSections(lesson.section.repoVersionId, repoPath);
            }
          }
        } else {
          yield* db.deleteLesson(lessonId);
        }

        return { success: true };
      });

      /** Converts a real lesson to a ghost. */
      const convertToGhost = Effect.fn("convertToGhost")(function* (
        lessonId: string
      ) {
        const lesson = yield* db.getLessonWithHierarchyById(lessonId);

        if (lesson.fsStatus !== "real") {
          return yield* new CourseWriteError({
            cause: null,
            message: "Lesson is already a ghost",
          });
        }

        const repoPath = lesson.section.repoVersion.repo.filePath!;
        const sectionPath = lesson.section.path;
        const parsed = parseSectionPath(sectionPath);
        const sectionNumber = parsed?.sectionNumber ?? 1;

        // Delete the lesson directory from disk
        yield* repoWrite.deleteLesson({
          repoPath,
          sectionPath,
          lessonDirName: lesson.path,
        });

        // Mark lesson as ghost in DB
        yield* db.updateLesson(lessonId, {
          fsStatus: "ghost",
        });

        // Renumber remaining real lessons to close the gap
        const sectionLessons = yield* db.getLessonsBySectionId(
          lesson.sectionId
        );
        const remainingReal = sectionLessons.filter(
          (l) => l.fsStatus !== "ghost" && l.id !== lessonId
        );

        if (remainingReal.length > 0) {
          const renames: { id: string; oldPath: string; newPath: string }[] =
            [];
          for (let i = 0; i < remainingReal.length; i++) {
            const l = remainingReal[i]!;
            const p = parseLessonPath(l.path);
            if (!p) continue;
            const newPath = buildLessonPath(sectionNumber, i + 1, p.slug);
            if (newPath !== l.path) {
              renames.push({ id: l.id, oldPath: l.path, newPath });
            }
          }

          if (renames.length > 0) {
            yield* repoWrite.renameLessons({
              repoPath,
              sectionPath,
              renames: renames.map((r) => ({
                oldPath: r.oldPath,
                newPath: r.newPath,
              })),
            });

            for (const rename of renames) {
              yield* db.updateLesson(rename.id, {
                path: rename.newPath,
              });
            }
          }
        }

        // If no real lessons remain, remove the section directory,
        // revert the section path to title case, and renumber other sections
        if (remainingReal.length === 0) {
          const sectionParsed = parseSectionPath(sectionPath);
          if (sectionParsed) {
            yield* repoWrite.deleteSectionDir({ repoPath, sectionPath });
            const title = titleFromSlug(sectionParsed.slug);
            yield* db.updateSectionPath(lesson.sectionId, title);
            yield* renumberSections(lesson.section.repoVersionId, repoPath);
          }
        }

        return { success: true };
      });

      /** Renames a lesson's slug (preserves lesson number). */
      const renameLesson = Effect.fn("renameLesson")(function* (
        lessonId: string,
        newSlug: string
      ) {
        const lesson = yield* db.getLessonWithHierarchyById(lessonId);

        const oldParsed = parseLessonPath(lesson.path);

        // Ghost lesson with unparseable path — just update the slug in DB
        if (!oldParsed) {
          if (lesson.path === newSlug) {
            return { success: true, path: lesson.path };
          }
          yield* db.updateLesson(lessonId, { path: newSlug });
          return { success: true, path: newSlug };
        }

        if (oldParsed.slug === newSlug) {
          return { success: true, path: lesson.path };
        }

        const sectionNumber =
          oldParsed.sectionNumber ??
          parseSectionPath(lesson.section.path)?.sectionNumber ??
          1;
        const newPath = buildLessonPath(
          sectionNumber,
          oldParsed.lessonNumber,
          newSlug
        );

        if (lesson.fsStatus !== "ghost") {
          const repoPath = lesson.section.repoVersion.repo.filePath!;
          const sectionPath = lesson.section.path;

          yield* repoWrite.renameLesson({
            repoPath,
            sectionPath,
            oldLessonDirName: lesson.path,
            newSlug,
          });
        }

        yield* db.updateLesson(lessonId, {
          path: newPath,
        });

        return { success: true, path: newPath };
      });

      /** Reorders lessons within a section. */
      const reorderLessons = Effect.fn("reorderLessons")(function* (
        sectionId: string,
        newOrderIds: readonly string[]
      ) {
        const section = yield* db.getSectionWithHierarchyById(sectionId);
        const repoPath = section.repoVersion.repo.filePath!;
        const sectionPath = section.path;

        const sectionLessons = yield* db.getLessonsBySectionId(sectionId);

        // Only real lessons participate in filesystem renaming
        const realLessons = sectionLessons.filter(
          (l) => l.fsStatus !== "ghost"
        );
        const realLessonIds = newOrderIds.filter((id) =>
          realLessons.some((l) => l.id === id)
        );
        const lessonsForReorder = realLessons.map((l) => ({
          id: l.id,
          path: l.path,
        }));
        const renames = computeRenumberingPlan(
          lessonsForReorder,
          realLessonIds
        );

        if (renames.length > 0) {
          yield* repoWrite.renameLessons({
            repoPath,
            sectionPath,
            renames: renames.map((r) => ({
              oldPath: r.oldPath,
              newPath: r.newPath,
            })),
          });

          for (const rename of renames) {
            const parsed = parseLessonPath(rename.newPath);
            if (parsed) {
              yield* db.updateLesson(rename.id, {
                path: rename.newPath,
                lessonNumber: parsed.lessonNumber,
              });
            }
          }
        }

        // Update order for ALL lessons (ghost + real) based on position
        for (let i = 0; i < newOrderIds.length; i++) {
          yield* db.updateLessonOrder(newOrderIds[i]!, i);
        }

        return { success: true, renames };
      });

      /** Moves a lesson to a different section. */
      const moveToSection = Effect.fn("moveToSection")(function* (
        lessonId: string,
        targetSectionId: string
      ) {
        const lesson = yield* db.getLessonWithHierarchyById(lessonId);
        const targetLessons = yield* db.getLessonsBySectionId(targetSectionId);
        const maxOrder =
          targetLessons.length > 0
            ? Math.max(...targetLessons.map((l) => l.order))
            : 0;

        // Ghost lesson: DB-only move to end of target section
        if (lesson.fsStatus === "ghost") {
          yield* db.updateLesson(lessonId, { sectionId: targetSectionId });
          yield* db.updateLessonOrder(lessonId, maxOrder + 1);
          return { success: true };
        }

        // Real lesson: filesystem move + renumber both sections
        const repoPath = lesson.section.repoVersion.repo.filePath!;
        const sourceSectionPath = lesson.section.path;
        const targetSection =
          yield* db.getSectionWithHierarchyById(targetSectionId);
        const targetSectionPath = targetSection.path;

        const sourceParsed = parseSectionPath(sourceSectionPath);
        const targetParsed = parseSectionPath(targetSectionPath);
        const sourceSectionNumber = sourceParsed?.sectionNumber ?? 1;
        const targetSectionNumber = targetParsed?.sectionNumber ?? 1;

        // Compute new path in target section
        const lessonParsed = parseLessonPath(lesson.path);
        const slug = lessonParsed?.slug ?? lesson.path;
        const targetRealLessons = targetLessons.filter(
          (l) => l.fsStatus !== "ghost"
        );
        const nextLessonNumber = targetRealLessons.length + 1;
        const newLessonPath = buildLessonPath(
          targetSectionNumber,
          nextLessonNumber,
          slug
        );

        // Move the directory via git mv
        yield* repoWrite.moveLessonToSection({
          repoPath,
          sourceSectionPath,
          targetSectionPath,
          oldLessonDirName: lesson.path,
          newLessonDirName: newLessonPath,
        });

        // Update DB: move to target section with new path
        yield* db.updateLesson(lessonId, {
          sectionId: targetSectionId,
          path: newLessonPath,
        });
        yield* db.updateLessonOrder(lessonId, maxOrder + 1);

        // Renumber source section real lessons to close the gap
        const sourceLessons = yield* db.getLessonsBySectionId(lesson.sectionId);
        const sourceRealLessons = sourceLessons.filter(
          (l) => l.fsStatus !== "ghost" && l.id !== lessonId
        );

        if (sourceRealLessons.length > 0) {
          const renames: { id: string; oldPath: string; newPath: string }[] =
            [];
          for (let i = 0; i < sourceRealLessons.length; i++) {
            const l = sourceRealLessons[i]!;
            const p = parseLessonPath(l.path);
            if (!p) continue;
            const newPath = buildLessonPath(sourceSectionNumber, i + 1, p.slug);
            if (newPath !== l.path) {
              renames.push({ id: l.id, oldPath: l.path, newPath });
            }
          }

          if (renames.length > 0) {
            yield* repoWrite.renameLessons({
              repoPath,
              sectionPath: sourceSectionPath,
              renames: renames.map((r) => ({
                oldPath: r.oldPath,
                newPath: r.newPath,
              })),
            });

            for (const rename of renames) {
              yield* db.updateLesson(rename.id, { path: rename.newPath });
            }
          }
        }

        return { success: true };
      });

      /** Deletes a ghost section and all its ghost lessons. */
      const deleteSection = Effect.fn("deleteSection")(function* (
        sectionId: string
      ) {
        const section = yield* db.getSectionWithHierarchyById(sectionId);
        const repoPath = section.repoVersion.repo.filePath!;
        const repoVersionId = section.repoVersionId;

        const sectionLessons = yield* db.getLessonsBySectionId(sectionId);
        const realLessons = sectionLessons.filter(
          (l) => l.fsStatus !== "ghost"
        );

        if (realLessons.length > 0) {
          return yield* new CourseWriteError({
            cause: null,
            message:
              "Cannot delete section with real lessons. Convert or delete them first.",
          });
        }

        // Delete all ghost lessons in this section
        for (const lesson of sectionLessons) {
          yield* db.deleteLesson(lesson.id);
        }

        // Delete the section itself
        yield* db.deleteSection(sectionId);

        // Renumber remaining sections to close the gap
        yield* renumberSections(repoVersionId, repoPath);

        return { success: true };
      });

      return {
        materializeGhost: (...args: Parameters<typeof materializeGhost>) =>
          withSyncValidation(materializeGhost(...args)),
        createRealLesson: (...args: Parameters<typeof createRealLesson>) =>
          withSyncValidation(createRealLesson(...args)),
        materializeCourseWithLesson: (
          ...args: Parameters<typeof materializeCourseWithLesson>
        ) => withSyncValidation(materializeCourseWithLesson(...args)),
        addGhostSection,
        addGhostLesson,
        deleteLesson: (...args: Parameters<typeof deleteLesson>) =>
          withSyncValidation(deleteLesson(...args)),
        deleteSection: (...args: Parameters<typeof deleteSection>) =>
          withSyncValidation(deleteSection(...args)),
        convertToGhost: (...args: Parameters<typeof convertToGhost>) =>
          withSyncValidation(convertToGhost(...args)),
        renameLesson: (...args: Parameters<typeof renameLesson>) =>
          withSyncValidation(renameLesson(...args)),
        reorderLessons: (...args: Parameters<typeof reorderLessons>) =>
          withSyncValidation(reorderLessons(...args)),
        moveToSection: (...args: Parameters<typeof moveToSection>) =>
          withSyncValidation(moveToSection(...args)),
        reorderSections: (...args: Parameters<typeof reorderSections>) =>
          withSyncValidation(reorderSections(...args)),
        renameSection: (...args: Parameters<typeof renameSection>) =>
          withSyncValidation(renameSection(...args)),
      };
    }),
    dependencies: [
      DBFunctionsService.Default,
      CourseRepoWriteService.Default,
      CourseRepoSyncValidationService.Default,
      NodeFileSystem.layer,
    ],
  }
) {}
