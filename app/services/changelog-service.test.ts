import { describe, expect, it } from "vitest";
import { generateChangelog } from "./changelog-service";

type VersionWithStructure = Parameters<typeof generateChangelog>[0][number];

function makeLesson(
  id: string,
  path: string,
  previousVersionLessonId: string | null = null,
  clipTexts: string[] = []
): VersionWithStructure["sections"][number]["lessons"][number] {
  return {
    id,
    path,
    previousVersionLessonId,
    videos:
      clipTexts.length > 0
        ? [
            {
              id: `video-${id}`,
              path: `${path}.mp4`,
              clips: clipTexts.map((text, i) => ({
                id: `clip-${id}-${i}`,
                text,
              })),
            },
          ]
        : [],
  };
}

function makeSection(
  id: string,
  path: string,
  lessons: VersionWithStructure["sections"][number]["lessons"],
  previousVersionSectionId: string | null = null
): VersionWithStructure["sections"][number] {
  return { id, path, previousVersionSectionId, lessons };
}

function makeVersion(
  id: string,
  name: string,
  sections: VersionWithStructure["sections"]
): VersionWithStructure {
  return {
    id,
    name,
    description: "",
    createdAt: new Date(),
    sections,
  };
}

describe("changelog-service", () => {
  describe("ghost to real lesson transitions", () => {
    it("detects a ghost-to-real transition as a new lesson", () => {
      // Previous version: ghost lesson was filtered out, so it's not in the data
      const prevVersion = makeVersion("v1", "v1.0", [
        makeSection("s1", "01-intro", [
          makeLesson("l1", "01.01-welcome", null, ["Hello"]),
        ]),
      ]);

      // Current version: the lesson is now real, but references the ghost lesson ID
      const currentVersion = makeVersion("v2", "v2.0", [
        makeSection(
          "s2",
          "01-intro",
          [
            makeLesson("l2", "01.01-welcome", "l1", ["Hello"]),
            // Ghost became real - has previousVersionLessonId pointing to a ghost
            // that was filtered out of prevVersion
            makeLesson("l3", "01.02-setup", "ghost-l1", ["Setup guide"]),
          ],
          "s1"
        ),
      ]);

      const changelog = generateChangelog([currentVersion, prevVersion]);

      expect(changelog).toContain("New Lessons");
      expect(changelog).toContain("01.02-setup");
    });

    it("detects a real-to-ghost transition as a deleted lesson", () => {
      // Previous version: lesson was real
      const prevVersion = makeVersion("v1", "v1.0", [
        makeSection("s1", "01-intro", [
          makeLesson("l1", "01.01-welcome", null, ["Hello"]),
          makeLesson("l2", "01.02-setup", null, ["Setup"]),
        ]),
      ]);

      // Current version: the lesson became ghost, so it's filtered out
      const currentVersion = makeVersion("v2", "v2.0", [
        makeSection(
          "s2",
          "01-intro",
          [
            makeLesson("l3", "01.01-welcome", "l1", ["Hello"]),
            // l2 is now ghost - filtered out, not present in the data
          ],
          "s1"
        ),
      ]);

      const changelog = generateChangelog([currentVersion, prevVersion]);

      expect(changelog).toContain("Deleted");
      expect(changelog).toContain("01.02-setup");
    });

    it("shows no significant changes when nothing changed", () => {
      const prevVersion = makeVersion("v1", "v1.0", [
        makeSection("s1", "01-intro", [
          makeLesson("l1", "01.01-welcome", null, ["Hello"]),
        ]),
      ]);

      const currentVersion = makeVersion("v2", "v2.0", [
        makeSection(
          "s2",
          "01-intro",
          [makeLesson("l2", "01.01-welcome", "l1", ["Hello"])],
          "s1"
        ),
      ]);

      const changelog = generateChangelog([currentVersion, prevVersion]);

      expect(changelog).toContain("No significant changes");
    });
  });
});
