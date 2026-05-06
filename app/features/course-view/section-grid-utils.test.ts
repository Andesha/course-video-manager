import { describe, expect, it } from "vitest";
import { filterLessons } from "./section-grid-utils";
import type { Lesson } from "./course-view-types";

function makeLesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: "lesson-1",
    sectionId: "section-1",
    previousVersionLessonId: null,
    path: "lesson-path",
    title: null,
    fsStatus: "real",
    description: null,
    icon: null,
    priority: 2,
    dependencies: null,
    authoringStatus: "done",
    createdAt: "2026-01-01",
    order: "a0",
    videos: [],
    ...overrides,
  } as Lesson;
}

const noFilters = {
  priorityFilter: [] as number[],
  iconFilter: [] as string[],
  fsStatusFilter: null as string | null,
  searchQuery: "",
};

describe("filterLessons", () => {
  it("todo filter includes lesson with authoringStatus=todo and videos with clips", () => {
    const lessons = [
      makeLesson({
        authoringStatus: "todo",
        videos: [
          { id: "v1", path: "v.mp4", clipCount: 5, totalDuration: 100 },
        ] as Lesson["videos"],
      }),
    ];
    const { filteredLessons } = filterLessons(lessons, {
      ...noFilters,
      fsStatusFilter: "todo",
    });
    expect(filteredLessons).toHaveLength(1);
  });

  it("todo filter excludes lesson with authoringStatus=done", () => {
    const lessons = [makeLesson({ authoringStatus: "done" })];
    const { filteredLessons } = filterLessons(lessons, {
      ...noFilters,
      fsStatusFilter: "todo",
    });
    expect(filteredLessons).toHaveLength(0);
  });

  it("todo filter excludes ghost lessons", () => {
    const lessons = [makeLesson({ fsStatus: "ghost", authoringStatus: null })];
    const { filteredLessons } = filterLessons(lessons, {
      ...noFilters,
      fsStatusFilter: "todo",
    });
    expect(filteredLessons).toHaveLength(0);
  });

  it("todo filter includes all priorities", () => {
    const lessons = [
      makeLesson({ id: "p1", authoringStatus: "todo", priority: 1 }),
      makeLesson({ id: "p2", authoringStatus: "todo", priority: 2 }),
      makeLesson({ id: "p3", authoringStatus: "todo", priority: 3 }),
    ];
    const { filteredLessons } = filterLessons(lessons, {
      ...noFilters,
      fsStatusFilter: "todo",
    });
    expect(filteredLessons).toHaveLength(3);
  });

  it("todo filter combined with priority filter excludes non-matching priorities", () => {
    const lessons = [
      makeLesson({ id: "p1", authoringStatus: "todo", priority: 1 }),
      makeLesson({ id: "p2", authoringStatus: "todo", priority: 2 }),
    ];
    const { filteredLessons } = filterLessons(lessons, {
      ...noFilters,
      fsStatusFilter: "todo",
      priorityFilter: [1],
    });
    expect(filteredLessons).toHaveLength(1);
    expect(filteredLessons[0]!.id).toBe("p1");
  });

  it("treats null fsStatus as real for todo filter", () => {
    const lessons = [
      makeLesson({
        fsStatus: null as unknown as string,
        authoringStatus: "todo",
      }),
    ];
    const { filteredLessons } = filterLessons(lessons, {
      ...noFilters,
      fsStatusFilter: "todo",
    });
    expect(filteredLessons).toHaveLength(1);
  });

  it("returns all lessons when no filters are active", () => {
    const lessons = [
      makeLesson({ id: "l1", authoringStatus: "todo" }),
      makeLesson({ id: "l2", authoringStatus: "done" }),
      makeLesson({ id: "l3", fsStatus: "ghost", authoringStatus: null }),
    ];
    const { filteredLessons, hasActiveFilters } = filterLessons(
      lessons,
      noFilters
    );
    expect(hasActiveFilters).toBe(false);
    expect(filteredLessons).toHaveLength(3);
  });
});
