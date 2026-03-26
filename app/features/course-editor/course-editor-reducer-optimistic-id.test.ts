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
  order: 1,
  lessons: [],
  ...overrides,
});

describe("courseEditorReducer — editing optimistic lessons by databaseId", () => {
  // After an optimistically created lesson gets its databaseId from the backend,
  // editorSectionsToLoaderSections exposes id = (databaseId ?? frontendId).
  // Once databaseId is set, components dispatch with frontendId: lesson.id = databaseId.
  // The reducer must still find and update the lesson.

  it("update-lesson-description should work when dispatched with databaseId as frontendId", () => {
    const lesson = createLesson({
      frontendId: fid("frontend-uuid"),
      databaseId: did("db-id"),
      description: "",
    });
    const section = createSection({ lessons: [lesson] });
    const state = createTester([section])
      .send({
        type: "update-lesson-description",
        frontendId: did("db-id") as unknown as FrontendId,
        description: "New description",
      })
      .getState();
    expect(state.sections[0]!.lessons[0]!.description).toBe("New description");
  });

  it("update-lesson-title should work when dispatched with databaseId as frontendId", () => {
    const lesson = createLesson({
      frontendId: fid("frontend-uuid"),
      databaseId: did("db-id"),
      title: "Old Title",
    });
    const section = createSection({ lessons: [lesson] });
    const state = createTester([section])
      .send({
        type: "update-lesson-title",
        frontendId: did("db-id") as unknown as FrontendId,
        title: "New Title",
      })
      .getState();
    expect(state.sections[0]!.lessons[0]!.title).toBe("New Title");
  });

  it("delete-lesson should work when dispatched with databaseId as frontendId", () => {
    const lesson = createLesson({
      frontendId: fid("frontend-uuid"),
      databaseId: did("db-id"),
    });
    const section = createSection({ lessons: [lesson] });
    const state = createTester([section])
      .send({
        type: "delete-lesson",
        frontendId: did("db-id") as unknown as FrontendId,
      })
      .getState();
    expect(state.sections[0]!.lessons).toHaveLength(0);
  });

  it("lesson-name-updated reconciliation should work when frontendId is databaseId", () => {
    const lesson = createLesson({
      frontendId: fid("frontend-uuid"),
      databaseId: did("db-id"),
      path: "old-path",
    });
    const section = createSection({ lessons: [lesson] });
    const state = createTester([section])
      .send({
        type: "lesson-name-updated",
        frontendId: did("db-id") as unknown as FrontendId,
        path: "new-path",
      })
      .getState();
    expect(state.sections[0]!.lessons[0]!.path).toBe("new-path");
  });
});
