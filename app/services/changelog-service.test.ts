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

function makeLessonWithEmptyVideo(
  id: string,
  path: string,
  previousVersionLessonId: string | null = null
): VersionWithStructure["sections"][number]["lessons"][number] {
  return {
    id,
    path,
    previousVersionLessonId,
    videos: [
      {
        id: `video-${id}`,
        path: `${path}.mp4`,
        clips: [],
      },
    ],
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

    it("shows transcript diff in details/summary when content changes", () => {
      const prevVersion = makeVersion("v1", "v1.0", [
        makeSection("s1", "01-intro", [
          makeLesson("l1", "01.01-welcome", null, [
            "Hello and welcome.",
            "Let's get started.",
          ]),
        ]),
      ]);

      const currentVersion = makeVersion("v2", "v2.0", [
        makeSection(
          "s2",
          "01-intro",
          [
            makeLesson("l2", "01.01-welcome", "l1", [
              "Hello and welcome.",
              "Let's get started.",
              "Here is a new section.",
            ]),
          ],
          "s1"
        ),
      ]);

      const changelog = generateChangelog([currentVersion, prevVersion]);

      expect(changelog).toContain("<details>");
      expect(changelog).toContain("<summary>");
      expect(changelog).toContain("</details>");
      expect(changelog).toContain("+ Here is a new section.");
    });

    it("shows removed clips with minus prefix", () => {
      const prevVersion = makeVersion("v1", "v1.0", [
        makeSection("s1", "01-intro", [
          makeLesson("l1", "01.01-welcome", null, [
            "Hello and welcome.",
            "This will be removed.",
            "Let's get started.",
          ]),
        ]),
      ]);

      const currentVersion = makeVersion("v2", "v2.0", [
        makeSection(
          "s2",
          "01-intro",
          [
            makeLesson("l2", "01.01-welcome", "l1", [
              "Hello and welcome.",
              "Let's get started.",
            ]),
          ],
          "s1"
        ),
      ]);

      const changelog = generateChangelog([currentVersion, prevVersion]);

      expect(changelog).toContain("- This will be removed.");
    });

    it("shows only context lines around changes, not the full transcript", () => {
      const prevVersion = makeVersion("v1", "v1.0", [
        makeSection("s1", "01-intro", [
          makeLesson("l1", "01.01-welcome", null, [
            "Line one.",
            "Line two.",
            "Line three.",
            "Line four.",
            "Line five.",
            "Line six.",
            "Line seven.",
            "Line eight.",
            "Line nine.",
            "Line ten.",
          ]),
        ]),
      ]);

      const currentVersion = makeVersion("v2", "v2.0", [
        makeSection(
          "s2",
          "01-intro",
          [
            makeLesson("l2", "01.01-welcome", "l1", [
              "Line one.",
              "Line two.",
              "Line three.",
              "Line four.",
              "Line five CHANGED.",
              "Line six.",
              "Line seven.",
              "Line eight.",
              "Line nine.",
              "Line ten.",
            ]),
          ],
          "s1"
        ),
      ]);

      const changelog = generateChangelog([currentVersion, prevVersion]);

      // Should show context around the change
      expect(changelog).toContain("Line three.");
      expect(changelog).toContain("Line four.");
      expect(changelog).toContain("- Line five.");
      expect(changelog).toContain("+ Line five CHANGED.");
      expect(changelog).toContain("Line six.");
      expect(changelog).toContain("Line seven.");
      expect(changelog).toContain("Line eight.");
      // Should NOT show lines far from the change
      expect(changelog).not.toContain("Line one.");
      expect(changelog).not.toContain("Line ten.");
    });

    it("separates non-contiguous hunks with ellipsis", () => {
      const prevVersion = makeVersion("v1", "v1.0", [
        makeSection("s1", "01-intro", [
          makeLesson("l1", "01.01-welcome", null, [
            "A1.",
            "A2.",
            "A3.",
            "A4.",
            "A5.",
            "A6.",
            "A7.",
            "A8.",
            "A9.",
            "A10.",
            "A11.",
            "A12.",
            "A13.",
            "A14.",
            "A15.",
          ]),
        ]),
      ]);

      const currentVersion = makeVersion("v2", "v2.0", [
        makeSection(
          "s2",
          "01-intro",
          [
            makeLesson("l2", "01.01-welcome", "l1", [
              "A1.",
              "A2 CHANGED.",
              "A3.",
              "A4.",
              "A5.",
              "A6.",
              "A7.",
              "A8.",
              "A9.",
              "A10.",
              "A11.",
              "A12.",
              "A13.",
              "A14 CHANGED.",
              "A15.",
            ]),
          ],
          "s1"
        ),
      ]);

      const changelog = generateChangelog([currentVersion, prevVersion]);

      expect(changelog).toContain("...");
      expect(changelog).toContain("- A2.");
      expect(changelog).toContain("+ A2 CHANGED.");
      expect(changelog).toContain("- A14.");
      expect(changelog).toContain("+ A14 CHANGED.");
    });

    it("trims clip text in diffs", () => {
      const prevVersion = makeVersion("v1", "v1.0", [
        makeSection("s1", "01-intro", [
          makeLesson("l1", "01.01-welcome", null, ["  Hello  "]),
        ]),
      ]);

      const currentVersion = makeVersion("v2", "v2.0", [
        makeSection(
          "s2",
          "01-intro",
          [
            makeLesson("l2", "01.01-welcome", "l1", [
              "  Hello  ",
              "  New clip  ",
            ]),
          ],
          "s1"
        ),
      ]);

      const changelog = generateChangelog([currentVersion, prevVersion]);

      expect(changelog).toContain("Hello");
      expect(changelog).toContain("+ New clip");
      expect(changelog).not.toContain("  Hello  ");
      expect(changelog).not.toContain("  New clip  ");
    });
  });

  describe("lesson existence based on clips", () => {
    it("does not report a lesson with no clips as new", () => {
      const prevVersion = makeVersion("v1", "v1.0", [
        makeSection("s1", "01-intro", [
          makeLesson("l1", "01.01-welcome", null, ["Hello"]),
        ]),
      ]);

      const currentVersion = makeVersion("v2", "v2.0", [
        makeSection(
          "s2",
          "01-intro",
          [
            makeLesson("l2", "01.01-welcome", "l1", ["Hello"]),
            // New lesson entity but no clips — should not appear
            makeLesson("l3", "01.02-setup"),
          ],
          "s1"
        ),
      ]);

      const changelog = generateChangelog([currentVersion, prevVersion]);

      expect(changelog).toContain("No significant changes");
      expect(changelog).not.toContain("01.02-setup");
    });

    it("reports a lesson as new when it gains its first clip", () => {
      const prevVersion = makeVersion("v1", "v1.0", [
        makeSection("s1", "01-intro", [
          makeLesson("l1", "01.01-welcome", null, ["Hello"]),
          // Lesson exists but has no clips
          makeLessonWithEmptyVideo("l2", "01.02-setup"),
        ]),
      ]);

      const currentVersion = makeVersion("v2", "v2.0", [
        makeSection(
          "s2",
          "01-intro",
          [
            makeLesson("l3", "01.01-welcome", "l1", ["Hello"]),
            // Now has clips — should be treated as new
            makeLesson("l4", "01.02-setup", "l2", ["Setup guide"]),
          ],
          "s1"
        ),
      ]);

      const changelog = generateChangelog([currentVersion, prevVersion]);

      expect(changelog).toContain("01.02-setup");
      expect(changelog).toContain("New Lessons");
    });

    it("reports a lesson as deleted when it loses all clips", () => {
      const prevVersion = makeVersion("v1", "v1.0", [
        makeSection("s1", "01-intro", [
          makeLesson("l1", "01.01-welcome", null, ["Hello"]),
          makeLesson("l2", "01.02-setup", null, ["Setup guide"]),
        ]),
      ]);

      const currentVersion = makeVersion("v2", "v2.0", [
        makeSection(
          "s2",
          "01-intro",
          [
            makeLesson("l3", "01.01-welcome", "l1", ["Hello"]),
            // Lesson still exists but lost all clips
            makeLessonWithEmptyVideo("l4", "01.02-setup", "l2"),
          ],
          "s1"
        ),
      ]);

      const changelog = generateChangelog([currentVersion, prevVersion]);

      expect(changelog).toContain("Deleted");
      expect(changelog).toContain("01.02-setup");
    });

    it("does not report changes when lesson had no clips and still has none", () => {
      const prevVersion = makeVersion("v1", "v1.0", [
        makeSection("s1", "01-intro", [
          makeLesson("l1", "01.01-welcome", null, ["Hello"]),
          makeLessonWithEmptyVideo("l2", "01.02-setup"),
        ]),
      ]);

      const currentVersion = makeVersion("v2", "v2.0", [
        makeSection(
          "s2",
          "01-intro",
          [
            makeLesson("l3", "01.01-welcome", "l1", ["Hello"]),
            makeLessonWithEmptyVideo("l4", "01.02-setup", "l2"),
          ],
          "s1"
        ),
      ]);

      const changelog = generateChangelog([currentVersion, prevVersion]);

      expect(changelog).toContain("No significant changes");
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
