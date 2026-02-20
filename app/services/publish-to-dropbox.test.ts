import { describe, expect, it } from "vitest";
import { resolveSectionsWithVideos } from "./publish-to-dropbox";
import { Effect } from "effect";
import { FileSystem } from "@effect/platform";

const FINISHED_VIDEOS_DIR = "/videos";

const run = (opts: {
  sectionsOnFileSystem: Parameters<
    typeof resolveSectionsWithVideos
  >[0]["sectionsOnFileSystem"];
  sectionsInDb: Parameters<typeof resolveSectionsWithVideos>[0]["sectionsInDb"];
  existingFiles: string[];
}) =>
  resolveSectionsWithVideos({
    sectionsOnFileSystem: opts.sectionsOnFileSystem,
    sectionsInDb: opts.sectionsInDb,
    finishedVideosDirectory: FINISHED_VIDEOS_DIR,
  }).pipe(
    Effect.provide(
      FileSystem.layerNoop({
        exists: (path) =>
          Effect.succeed(opts.existingFiles.includes(path as string)),
      })
    ),
    Effect.runPromise
  );

describe("resolveSectionsWithVideos", () => {
  it("should resolve all videos when all exist locally", async () => {
    const result = await run({
      sectionsOnFileSystem: [
        {
          sectionPathWithNumber: "001-intro",
          lessons: [{ lessonPathWithNumber: "001-getting-started" }],
        },
      ],
      sectionsInDb: [
        {
          id: "section-1",
          path: "001-intro",
          lessons: [
            {
              id: "lesson-1",
              path: "001-getting-started",
              videos: [{ id: "video-1", path: "getting-started" }],
            },
          ],
        },
      ],
      existingFiles: ["/videos/video-1.mp4"],
    });

    expect(result.missingVideos).toEqual([]);
    expect(result.sections).toEqual([
      {
        id: "section-1",
        path: "001-intro",
        lessons: [
          {
            id: "lesson-1",
            path: "001-getting-started",
            videos: [
              {
                id: "video-1",
                absolutePath: "/videos/video-1.mp4",
                name: "getting-started",
              },
            ],
          },
        ],
      },
    ]);
  });

  it("should collect missing videos instead of failing", async () => {
    const result = await run({
      sectionsOnFileSystem: [
        {
          sectionPathWithNumber: "001-intro",
          lessons: [{ lessonPathWithNumber: "001-getting-started" }],
        },
      ],
      sectionsInDb: [
        {
          id: "section-1",
          path: "001-intro",
          lessons: [
            {
              id: "lesson-1",
              path: "001-getting-started",
              videos: [
                { id: "video-1", path: "getting-started" },
                { id: "video-2", path: "next-steps" },
              ],
            },
          ],
        },
      ],
      existingFiles: ["/videos/video-1.mp4"],
    });

    expect(result.missingVideos).toEqual([
      {
        videoId: "video-2",
        videoPath: "next-steps",
        lessonPath: "001-getting-started",
      },
    ]);

    expect(result.sections[0]!.lessons[0]!.videos).toEqual([
      {
        id: "video-1",
        absolutePath: "/videos/video-1.mp4",
        name: "getting-started",
      },
    ]);
  });

  it("should report all videos as missing when none exist locally", async () => {
    const result = await run({
      sectionsOnFileSystem: [
        {
          sectionPathWithNumber: "001-intro",
          lessons: [{ lessonPathWithNumber: "001-getting-started" }],
        },
      ],
      sectionsInDb: [
        {
          id: "section-1",
          path: "001-intro",
          lessons: [
            {
              id: "lesson-1",
              path: "001-getting-started",
              videos: [
                { id: "video-1", path: "getting-started" },
                { id: "video-2", path: "next-steps" },
              ],
            },
          ],
        },
      ],
      existingFiles: [],
    });

    expect(result.missingVideos).toHaveLength(2);
    expect(result.sections[0]!.lessons[0]!.videos).toEqual([]);
  });

  it("should still include lessons with no videos in the structure", async () => {
    const result = await run({
      sectionsOnFileSystem: [
        {
          sectionPathWithNumber: "001-intro",
          lessons: [{ lessonPathWithNumber: "001-getting-started" }],
        },
      ],
      sectionsInDb: [
        {
          id: "section-1",
          path: "001-intro",
          lessons: [
            {
              id: "lesson-1",
              path: "001-getting-started",
              videos: [],
            },
          ],
        },
      ],
      existingFiles: [],
    });

    expect(result.missingVideos).toEqual([]);
    expect(result.sections).toEqual([
      {
        id: "section-1",
        path: "001-intro",
        lessons: [
          {
            id: "lesson-1",
            path: "001-getting-started",
            videos: [],
          },
        ],
      },
    ]);
  });

  it("should handle multiple sections with mixed video availability", async () => {
    const result = await run({
      sectionsOnFileSystem: [
        {
          sectionPathWithNumber: "001-intro",
          lessons: [{ lessonPathWithNumber: "001-basics" }],
        },
        {
          sectionPathWithNumber: "002-advanced",
          lessons: [{ lessonPathWithNumber: "001-deep-dive" }],
        },
      ],
      sectionsInDb: [
        {
          id: "section-1",
          path: "001-intro",
          lessons: [
            {
              id: "lesson-1",
              path: "001-basics",
              videos: [{ id: "video-1", path: "basics" }],
            },
          ],
        },
        {
          id: "section-2",
          path: "002-advanced",
          lessons: [
            {
              id: "lesson-2",
              path: "001-deep-dive",
              videos: [{ id: "video-2", path: "deep-dive" }],
            },
          ],
        },
      ],
      existingFiles: ["/videos/video-1.mp4"],
    });

    expect(result.sections[0]!.lessons[0]!.videos).toHaveLength(1);
    expect(result.sections[1]!.lessons[0]!.videos).toHaveLength(0);
    expect(result.missingVideos).toEqual([
      {
        videoId: "video-2",
        videoPath: "deep-dive",
        lessonPath: "001-deep-dive",
      },
    ]);
  });
});
