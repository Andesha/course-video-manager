import { describe, expect, it } from "vitest";
import {
  courseEditorReducer,
  createInitialCourseEditorState,
} from "./course-editor-reducer";
import { ReducerTester } from "@/test-utils/reducer-tester";
import type {
  FrontendId,
  DatabaseId,
  EditorSection,
  EditorLesson,
} from "./course-editor-types";

const createTester = (sections: EditorSection[] = []) =>
  new ReducerTester(
    courseEditorReducer,
    createInitialCourseEditorState(sections)
  );

const fid = (id: string) => id as FrontendId;
const did = (id: string) => id as DatabaseId;

const createLesson = (overrides: Partial<EditorLesson> = {}): EditorLesson => ({
  frontendId: fid(crypto.randomUUID()),
  databaseId: did(crypto.randomUUID()),
  sectionId: "section-1",
  path: "test-lesson",
  title: "Test Lesson",
  fsStatus: "real",
  description: "",
  icon: null,
  priority: 2,
  dependencies: null,
  order: 1,
  videos: [],
  ...overrides,
});

const createSection = (
  overrides: Partial<EditorSection> = {}
): EditorSection => ({
  frontendId: fid(crypto.randomUUID()),
  databaseId: did(crypto.randomUUID()),
  repoVersionId: "version-1",
  path: "test-section",
  description: "",
  order: 1,
  lessons: [],
  ...overrides,
});

describe("courseEditorReducer — delete-lesson renumbering", () => {
  it("should renumber real lesson paths after deletion", () => {
    const l1 = createLesson({ order: 1, path: "01.01-first" });
    const l2 = createLesson({ order: 2, path: "01.02-second" });
    const l3 = createLesson({ order: 3, path: "01.03-third" });
    const section = createSection({ lessons: [l1, l2, l3] });
    const state = createTester([section])
      .send({ type: "delete-lesson", frontendId: l2.frontendId })
      .getState();
    expect(state.sections[0]!.lessons.map((l) => l.path)).toEqual([
      "01.01-first",
      "01.02-third",
    ]);
  });

  it("should skip ghost lessons when renumbering after deletion", () => {
    const l1 = createLesson({ order: 1, path: "01.01-first" });
    const ghost = createLesson({
      order: 2,
      path: "My Ghost",
      fsStatus: "ghost",
    });
    const l2 = createLesson({ order: 3, path: "01.02-second" });
    const l3 = createLesson({ order: 4, path: "01.03-third" });
    const section = createSection({ lessons: [l1, ghost, l2, l3] });
    const state = createTester([section])
      .send({ type: "delete-lesson", frontendId: l2.frontendId })
      .getState();
    expect(state.sections[0]!.lessons.map((l) => l.path)).toEqual([
      "01.01-first",
      "My Ghost",
      "01.02-third",
    ]);
  });

  it("should leave an empty section when deleting the only lesson", () => {
    const l1 = createLesson({ order: 1, path: "01.01-only" });
    const section = createSection({ lessons: [l1] });
    const state = createTester([section])
      .send({ type: "delete-lesson", frontendId: l1.frontendId })
      .getState();
    expect(state.sections[0]!.lessons).toEqual([]);
  });

  it("should renumber when deleting the first lesson", () => {
    const l1 = createLesson({ order: 1, path: "01.01-first" });
    const l2 = createLesson({ order: 2, path: "01.02-second" });
    const l3 = createLesson({ order: 3, path: "01.03-third" });
    const section = createSection({ lessons: [l1, l2, l3] });
    const state = createTester([section])
      .send({ type: "delete-lesson", frontendId: l1.frontendId })
      .getState();
    expect(state.sections[0]!.lessons.map((l) => l.path)).toEqual([
      "01.01-second",
      "01.02-third",
    ]);
  });

  it("should not change paths when deleting the last lesson", () => {
    const l1 = createLesson({ order: 1, path: "01.01-first" });
    const l2 = createLesson({ order: 2, path: "01.02-second" });
    const l3 = createLesson({ order: 3, path: "01.03-third" });
    const section = createSection({ lessons: [l1, l2, l3] });
    const state = createTester([section])
      .send({ type: "delete-lesson", frontendId: l3.frontendId })
      .getState();
    expect(state.sections[0]!.lessons.map((l) => l.path)).toEqual([
      "01.01-first",
      "01.02-second",
    ]);
  });

  it("should not alter real lesson paths when deleting a ghost", () => {
    const l1 = createLesson({ order: 1, path: "01.01-first" });
    const ghost = createLesson({
      order: 2,
      path: "My Ghost",
      fsStatus: "ghost",
    });
    const l2 = createLesson({ order: 3, path: "01.02-second" });
    const section = createSection({ lessons: [l1, ghost, l2] });
    const state = createTester([section])
      .send({ type: "delete-lesson", frontendId: ghost.frontendId })
      .getState();
    expect(state.sections[0]!.lessons.map((l) => l.path)).toEqual([
      "01.01-first",
      "01.02-second",
    ]);
  });

  it("should preserve section number from existing lessons", () => {
    const l1 = createLesson({ order: 1, path: "03.01-alpha" });
    const l2 = createLesson({ order: 2, path: "03.02-beta" });
    const l3 = createLesson({ order: 3, path: "03.03-gamma" });
    const section = createSection({ lessons: [l1, l2, l3] });
    const state = createTester([section])
      .send({ type: "delete-lesson", frontendId: l1.frontendId })
      .getState();
    expect(state.sections[0]!.lessons.map((l) => l.path)).toEqual([
      "03.01-beta",
      "03.02-gamma",
    ]);
  });
});
