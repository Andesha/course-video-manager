import { describe, it, expect } from "vitest";
import {
  applyOptimisticEvent,
  applyOptimisticDeleteVideo,
  courseEditorFetcherKey,
  courseEditorFetcherKeyForEvent,
  deleteVideoFetcherKey,
  DELETE_VIDEO_KEY_PREFIX,
} from "./optimistic-applier";
import type { LoaderData } from "./course-view-types";
import type { CourseEditorEvent } from "@/services/course-editor-service";

function makeVideo(
  overrides: Partial<
    LoaderData["selectedCourse"] extends infer C
      ? C extends {
          sections: Array<{ lessons: Array<{ videos: Array<infer V> }> }>;
        }
        ? V
        : never
      : never
  > = {}
) {
  return {
    id: "video-1",
    path: "video-01.mp4",
    totalDuration: 120,
    firstClipId: null,
    archived: false,
    createdAt: new Date(),
    lessonId: "lesson-1",
    originalFootagePath: "/footage/video-01",
    updatedAt: new Date(),
    clipCount: 0,
    ...overrides,
  };
}

function makeLesson(
  overrides: Partial<
    LoaderData["selectedCourse"] extends infer C
      ? C extends { sections: Array<{ lessons: Array<infer L> }> }
        ? L
        : never
      : never
  > = {}
) {
  return {
    id: "lesson-1",
    path: "01-intro",
    title: "Introduction",
    description: null,
    icon: "watch" as const,
    priority: 2,
    dependencies: [],
    fsStatus: "real" as const,
    authoringStatus: "todo" as const,
    order: 0,
    videos: [],
    ...overrides,
  };
}

function makeSection(
  overrides: Record<string, unknown> = {},
  lessons = [makeLesson()]
) {
  return {
    id: "section-1",
    path: "01-fundamentals",
    title: "Fundamentals",
    description: null,
    order: 0,
    lessons,
    ...overrides,
  };
}

function makeLoaderData(sections = [makeSection()]): LoaderData {
  return {
    courses: [],
    standaloneVideos: [],
    selectedCourse: {
      id: "course-1",
      name: "Test Course",
      filePath: "/tmp/test-course",
      sections,
    },
    versions: [],
    selectedVersion: undefined,
    isLatestVersion: true,
    hasExportedVideoMap: Promise.resolve({}),
    lessonFsMaps: Promise.resolve({
      hasExplainerFolderMap: {},
      lessonHasFilesMap: {},
    }),
    videoTranscripts: Promise.resolve({}),
    gitStatus: Promise.resolve(null),
    showMediaFilesList: false,
  } as unknown as LoaderData;
}

describe("applyOptimisticEvent", () => {
  describe("update-lesson-icon", () => {
    it("patches the icon for the matching lesson", () => {
      const loaderData = makeLoaderData();
      const event: CourseEditorEvent = {
        type: "update-lesson-icon",
        lessonId: "lesson-1",
        icon: "code",
      };

      const result = applyOptimisticEvent(loaderData, event);

      expect(result.selectedCourse!.sections[0]!.lessons[0]!.icon).toBe("code");
    });

    it("does not mutate the original loaderData", () => {
      const loaderData = makeLoaderData();
      const event: CourseEditorEvent = {
        type: "update-lesson-icon",
        lessonId: "lesson-1",
        icon: "discussion",
      };

      const result = applyOptimisticEvent(loaderData, event);

      expect(result).not.toBe(loaderData);
      expect(result.selectedCourse).not.toBe(loaderData.selectedCourse);
      expect(loaderData.selectedCourse!.sections[0]!.lessons[0]!.icon).toBe(
        "watch"
      );
    });

    it("returns loaderData unchanged when lesson is not found", () => {
      const loaderData = makeLoaderData();
      const event: CourseEditorEvent = {
        type: "update-lesson-icon",
        lessonId: "nonexistent",
        icon: "code",
      };

      const result = applyOptimisticEvent(loaderData, event);

      expect(result).toBe(loaderData);
    });

    it("finds the lesson across multiple sections", () => {
      const lesson2 = makeLesson({ id: "lesson-2", icon: "watch" });
      const section2 = makeSection({ id: "section-2" }, [lesson2]);
      const loaderData = makeLoaderData([makeSection(), section2]);

      const event: CourseEditorEvent = {
        type: "update-lesson-icon",
        lessonId: "lesson-2",
        icon: "discussion",
      };

      const result = applyOptimisticEvent(loaderData, event);

      expect(result.selectedCourse!.sections[1]!.lessons[0]!.icon).toBe(
        "discussion"
      );
      // first section unchanged
      expect(result.selectedCourse!.sections[0]!.lessons[0]!.icon).toBe(
        "watch"
      );
    });
  });

  describe("passthrough for unhandled events", () => {
    it("returns loaderData unchanged for create-section", () => {
      const loaderData = makeLoaderData();
      const event: CourseEditorEvent = {
        type: "create-section",
        repoVersionId: "v1",
        title: "New Section",
        maxOrder: 1,
      };

      const result = applyOptimisticEvent(loaderData, event);

      expect(result).toBe(loaderData);
    });

    it("returns loaderData unchanged for update-lesson-title", () => {
      const loaderData = makeLoaderData();
      const event: CourseEditorEvent = {
        type: "update-lesson-title",
        lessonId: "lesson-1",
        title: "New Title",
      };

      const result = applyOptimisticEvent(loaderData, event);

      expect(result).toBe(loaderData);
    });
  });

  describe("undefined selectedCourse", () => {
    it("returns loaderData unchanged", () => {
      const loaderData = makeLoaderData();
      (loaderData as any).selectedCourse = undefined;

      const event: CourseEditorEvent = {
        type: "update-lesson-icon",
        lessonId: "lesson-1",
        icon: "code",
      };

      const result = applyOptimisticEvent(loaderData, event);

      expect(result).toBe(loaderData);
    });
  });

  describe("empty and edge-case structures", () => {
    it("returns loaderData unchanged when sections array is empty", () => {
      const loaderData = makeLoaderData([]);
      const event: CourseEditorEvent = {
        type: "update-lesson-icon",
        lessonId: "lesson-1",
        icon: "code",
      };

      const result = applyOptimisticEvent(loaderData, event);

      expect(result).toBe(loaderData);
    });

    it("returns loaderData unchanged when section has no lessons", () => {
      const loaderData = makeLoaderData([makeSection({}, [])]);
      const event: CourseEditorEvent = {
        type: "update-lesson-icon",
        lessonId: "lesson-1",
        icon: "code",
      };

      const result = applyOptimisticEvent(loaderData, event);

      expect(result).toBe(loaderData);
    });

    it("preserves reference equality for unchanged sections", () => {
      const section1 = makeSection({ id: "section-1" });
      const section2 = makeSection({ id: "section-2" }, [
        makeLesson({ id: "lesson-2" }),
      ]);
      const loaderData = makeLoaderData([section1, section2]);

      const event: CourseEditorEvent = {
        type: "update-lesson-icon",
        lessonId: "lesson-2",
        icon: "code",
      };

      const result = applyOptimisticEvent(loaderData, event);

      expect(result.selectedCourse!.sections[0]).toBe(section1);
      expect(result.selectedCourse!.sections[1]).not.toBe(section2);
    });
  });

  describe("sequential event composition", () => {
    it("applies two update-lesson-icon events on different lessons", () => {
      const section = makeSection({}, [
        makeLesson({ id: "lesson-1", icon: "watch" }),
        makeLesson({ id: "lesson-2", icon: "watch" }),
      ]);
      const loaderData = makeLoaderData([section]);

      const event1: CourseEditorEvent = {
        type: "update-lesson-icon",
        lessonId: "lesson-1",
        icon: "code",
      };
      const event2: CourseEditorEvent = {
        type: "update-lesson-icon",
        lessonId: "lesson-2",
        icon: "discussion",
      };

      const intermediate = applyOptimisticEvent(loaderData, event1);
      const result = applyOptimisticEvent(intermediate, event2);

      expect(result.selectedCourse!.sections[0]!.lessons[0]!.icon).toBe("code");
      expect(result.selectedCourse!.sections[0]!.lessons[1]!.icon).toBe(
        "discussion"
      );
    });

    it("last write wins when two events target the same lesson", () => {
      const loaderData = makeLoaderData();
      const event1: CourseEditorEvent = {
        type: "update-lesson-icon",
        lessonId: "lesson-1",
        icon: "code",
      };
      const event2: CourseEditorEvent = {
        type: "update-lesson-icon",
        lessonId: "lesson-1",
        icon: "discussion",
      };

      const intermediate = applyOptimisticEvent(loaderData, event1);
      const result = applyOptimisticEvent(intermediate, event2);

      expect(result.selectedCourse!.sections[0]!.lessons[0]!.icon).toBe(
        "discussion"
      );
    });
  });
});

describe("courseEditorFetcherKey", () => {
  it("formats the key as course-editor:<type>:<id>", () => {
    expect(courseEditorFetcherKey("update-lesson-icon", "lesson-1")).toBe(
      "course-editor:update-lesson-icon:lesson-1"
    );
  });
});

describe("courseEditorFetcherKeyForEvent", () => {
  it("uses lessonId for lesson events", () => {
    expect(
      courseEditorFetcherKeyForEvent({
        type: "update-lesson-icon",
        lessonId: "L1",
        icon: "code",
      })
    ).toBe("course-editor:update-lesson-icon:L1");
  });

  it("uses sectionId for section events", () => {
    expect(
      courseEditorFetcherKeyForEvent({
        type: "update-section-name",
        sectionId: "S1",
        title: "New",
      })
    ).toBe("course-editor:update-section-name:S1");
  });

  it("uses repoVersionId for create-section", () => {
    expect(
      courseEditorFetcherKeyForEvent({
        type: "create-section",
        repoVersionId: "V1",
        title: "New",
        maxOrder: 0,
      })
    ).toBe("course-editor:create-section:V1");
  });

  it('uses "batch" for reorder-sections', () => {
    expect(
      courseEditorFetcherKeyForEvent({
        type: "reorder-sections",
        sectionIds: ["S1", "S2"],
      })
    ).toBe("course-editor:reorder-sections:batch");
  });

  it("uses sectionId for reorder-lessons", () => {
    expect(
      courseEditorFetcherKeyForEvent({
        type: "reorder-lessons",
        sectionId: "S1",
        lessonIds: ["L1", "L2"],
      })
    ).toBe("course-editor:reorder-lessons:S1");
  });
});

describe("applyOptimisticDeleteVideo", () => {
  it("removes the matching video from a lesson", () => {
    const video1 = makeVideo({ id: "video-1" });
    const video2 = makeVideo({ id: "video-2", path: "video-02.mp4" });
    const lesson = makeLesson({ videos: [video1, video2] });
    const loaderData = makeLoaderData([makeSection({}, [lesson])]);

    const result = applyOptimisticDeleteVideo(loaderData, "video-1");

    expect(result.selectedCourse!.sections[0]!.lessons[0]!.videos).toHaveLength(
      1
    );
    expect(result.selectedCourse!.sections[0]!.lessons[0]!.videos[0]!.id).toBe(
      "video-2"
    );
  });

  it("returns loaderData unchanged when videoId is not found", () => {
    const lesson = makeLesson({ videos: [makeVideo()] });
    const loaderData = makeLoaderData([makeSection({}, [lesson])]);

    const result = applyOptimisticDeleteVideo(loaderData, "nonexistent");

    expect(result).toBe(loaderData);
  });

  it("returns loaderData unchanged when selectedCourse is undefined", () => {
    const loaderData = makeLoaderData();
    (loaderData as any).selectedCourse = undefined;

    const result = applyOptimisticDeleteVideo(loaderData, "video-1");

    expect(result).toBe(loaderData);
  });

  it("does not mutate the original loaderData", () => {
    const video = makeVideo({ id: "video-1" });
    const lesson = makeLesson({ videos: [video] });
    const loaderData = makeLoaderData([makeSection({}, [lesson])]);

    const result = applyOptimisticDeleteVideo(loaderData, "video-1");

    expect(result).not.toBe(loaderData);
    expect(result.selectedCourse).not.toBe(loaderData.selectedCourse);
    expect(
      loaderData.selectedCourse!.sections[0]!.lessons[0]!.videos
    ).toHaveLength(1);
  });

  it("preserves reference equality for unchanged sections", () => {
    const section1 = makeSection({ id: "section-1" }, [
      makeLesson({ id: "lesson-1", videos: [] }),
    ]);
    const section2 = makeSection({ id: "section-2" }, [
      makeLesson({ id: "lesson-2", videos: [makeVideo({ id: "video-1" })] }),
    ]);
    const loaderData = makeLoaderData([section1, section2]);

    const result = applyOptimisticDeleteVideo(loaderData, "video-1");

    expect(result.selectedCourse!.sections[0]).toBe(section1);
    expect(result.selectedCourse!.sections[1]).not.toBe(section2);
  });

  it("finds the video across multiple sections and lessons", () => {
    const lesson1 = makeLesson({ id: "lesson-1", videos: [] });
    const lesson2 = makeLesson({
      id: "lesson-2",
      videos: [makeVideo({ id: "video-target" })],
    });
    const section1 = makeSection({ id: "section-1" }, [lesson1]);
    const section2 = makeSection({ id: "section-2" }, [lesson2]);
    const loaderData = makeLoaderData([section1, section2]);

    const result = applyOptimisticDeleteVideo(loaderData, "video-target");

    expect(result.selectedCourse!.sections[1]!.lessons[0]!.videos).toHaveLength(
      0
    );
    expect(result.selectedCourse!.sections[0]).toBe(section1);
  });
});

describe("deleteVideoFetcherKey", () => {
  it("formats the key with the delete-video prefix", () => {
    expect(deleteVideoFetcherKey("video-123")).toBe("delete-video:video-123");
  });

  it("key starts with DELETE_VIDEO_KEY_PREFIX", () => {
    const key = deleteVideoFetcherKey("v1");
    expect(key.startsWith(DELETE_VIDEO_KEY_PREFIX)).toBe(true);
  });
});
