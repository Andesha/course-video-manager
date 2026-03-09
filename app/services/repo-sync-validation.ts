import { Data, Effect } from "effect";
import { FileSystem } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import path from "node:path";
import { DBFunctionsService } from "./db-service.server";
import { parseSectionPath } from "./section-path-service";

export class RepoSyncError extends Data.TaggedError("RepoSyncError")<{
  cause: unknown;
  message: string;
}> {}

export class RepoSyncValidationService extends Effect.Service<RepoSyncValidationService>()(
  "RepoSyncValidationService",
  {
    effect: Effect.gen(function* () {
      const db = yield* DBFunctionsService;
      const fs = yield* FileSystem.FileSystem;

      const validate = Effect.fn("validateRepoSync")(function* () {
        const repos = yield* db.getRepos();
        const mismatches: string[] = [];

        for (const repo of repos) {
          const repoPath = repo.filePath;
          const repoExists = yield* fs.exists(repoPath);

          if (!repoExists) {
            mismatches.push(`Repo directory missing on disk: ${repoPath}`);
            continue;
          }

          const repoData = yield* db.getRepoWithSectionsById(repo.id);

          for (const version of repoData.versions) {
            for (const section of version.sections) {
              const parsed = parseSectionPath(section.path);
              if (!parsed) continue; // ghost section — no directory expected

              const sectionDir = path.join(repoPath, section.path);
              const sectionExists = yield* fs.exists(sectionDir);

              if (!sectionExists) {
                mismatches.push(
                  `Section directory missing: ${section.path} (expected at ${sectionDir})`
                );
                continue;
              }

              // Read actual directories on disk to detect orphans
              const diskEntries = yield* fs
                .readDirectory(sectionDir)
                .pipe(Effect.catchAll(() => Effect.succeed([] as string[])));

              // Build set of expected lesson dir names for real lessons
              const expectedLessonDirs = new Set<string>();

              for (const lesson of section.lessons) {
                if (lesson.fsStatus === "ghost") continue;

                expectedLessonDirs.add(lesson.path);
                const lessonDir = path.join(sectionDir, lesson.path);
                const lessonExists = yield* fs.exists(lessonDir);

                if (!lessonExists) {
                  mismatches.push(
                    `Lesson directory missing: ${section.path}/${lesson.path} (expected at ${lessonDir})`
                  );
                }
              }

              // Check for orphan lesson directories on disk
              for (const entry of diskEntries) {
                // Skip non-numbered directories (not lesson dirs)
                if (!/^\d/.test(entry)) continue;
                // Skip temp directories from rename operations
                if (entry.startsWith("__")) continue;

                if (!expectedLessonDirs.has(entry)) {
                  mismatches.push(
                    `Orphan lesson directory on disk: ${section.path}/${entry} (not tracked in database)`
                  );
                }
              }
            }

            // Check for orphan section directories on disk
            const diskSections = yield* fs
              .readDirectory(repoPath)
              .pipe(Effect.catchAll(() => Effect.succeed([] as string[])));

            const expectedSectionDirs = new Set(
              version.sections
                .filter((s) => parseSectionPath(s.path) !== null)
                .map((s) => s.path)
            );

            for (const entry of diskSections) {
              if (!/^\d/.test(entry)) continue;
              if (entry.startsWith("__")) continue;

              if (!expectedSectionDirs.has(entry)) {
                mismatches.push(
                  `Orphan section directory on disk: ${entry} (not tracked in database)`
                );
              }
            }
          }
        }

        if (mismatches.length > 0) {
          return yield* new RepoSyncError({
            cause: null,
            message: `Repo out of sync with filesystem:\n${mismatches.join("\n")}`,
          });
        }
      });

      return { validate };
    }),
    dependencies: [NodeFileSystem.layer, DBFunctionsService.Default],
  }
) {}

/**
 * Runs validation, catching any internal errors (DB/FS) and wrapping them
 * as RepoSyncError so callers only see one error type.
 */
const runValidation = Effect.gen(function* () {
  const syncService = yield* RepoSyncValidationService;
  yield* syncService.validate().pipe(
    Effect.catchAll((e) => {
      if (e._tag === "RepoSyncError") return Effect.fail(e);
      return Effect.fail(
        new RepoSyncError({
          cause: e,
          message: `Sync validation encountered an error: ${String(e)}`,
        })
      );
    })
  );
});

/**
 * Wraps an Effect with repo sync validation before and after execution.
 * If the repo is out of sync before the operation, the operation is aborted.
 * If the repo is out of sync after the operation, a RepoSyncError is raised.
 */
export const withSyncValidation = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E | RepoSyncError, R | RepoSyncValidationService> =>
  Effect.gen(function* () {
    yield* runValidation;
    const result = yield* effect;
    yield* runValidation;
    return result;
  });
