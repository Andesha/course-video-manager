import { FileSystem } from "@effect/platform";
import { Config, Effect } from "effect";
import {
  computeExportHash,
  resolveExportPath,
  type ExportClip,
} from "./export-hash";

const listFilesRecursive = (
  dir: string,
  prefix: string
): Effect.Effect<
  { path: string; size: number }[],
  never,
  FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const entries = yield* fs
      .readDirectory(dir)
      .pipe(Effect.catchAll(() => Effect.succeed([] as string[])));
    const entryResults = yield* Effect.forEach(
      entries,
      (entry) =>
        Effect.gen(function* () {
          const fullPath = `${dir}/${entry}`;
          const relativePath = prefix ? `${prefix}/${entry}` : entry;
          const stat = yield* fs
            .stat(fullPath)
            .pipe(Effect.catchAll(() => Effect.succeed(undefined)));
          if (!stat) return [] as { path: string; size: number }[];
          if (stat.type === "Directory") {
            return yield* listFilesRecursive(fullPath, relativePath);
          } else {
            return [{ path: relativePath, size: Number(stat.size) }];
          }
        }),
      { concurrency: "unbounded" }
    );
    return entryResults.flat();
  });

export const loadExportStatusMap = (opts: {
  courseId: string;
  videos: { id: string; clips: ExportClip[] }[];
}) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const finishedVideosDir = yield* Config.string("FINISHED_VIDEOS_DIRECTORY");

    const hasExportedVideoMap: Record<string, boolean> = {};

    yield* Effect.forEach(
      opts.videos,
      (video) =>
        Effect.gen(function* () {
          const hash = computeExportHash(video.clips);
          if (!hash) {
            hasExportedVideoMap[video.id] = false;
            return;
          }
          const exportPath = resolveExportPath(
            finishedVideosDir,
            opts.courseId,
            hash
          );
          hasExportedVideoMap[video.id] = yield* fs.exists(exportPath);
        }),
      { concurrency: "unbounded" }
    );

    return hasExportedVideoMap;
  });

export const loadLessonFsMaps = (opts: {
  lessons: { id: string; fullPath: string }[];
}) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;

    const hasExplainerFolderMap: Record<string, boolean> = {};
    const lessonHasFilesMap: Record<string, { path: string; size: number }[]> =
      {};

    yield* Effect.forEach(
      opts.lessons,
      (lesson) =>
        Effect.gen(function* () {
          hasExplainerFolderMap[lesson.id] = yield* fs.exists(
            `${lesson.fullPath}/explainer`
          );
          lessonHasFilesMap[lesson.id] = yield* listFilesRecursive(
            lesson.fullPath,
            ""
          );
        }),
      { concurrency: "unbounded" }
    );

    return { hasExplainerFolderMap, lessonHasFilesMap };
  });
