import { describe, it, expect } from "vitest";
import { applyOptimisticEvent } from "./optimistic-applier";
import type { CourseEditorEvent } from "@/services/course-editor-service";
import {
  makeLesson,
  makeSection,
  makeLoaderData,
} from "./optimistic-applier-test-utils";

describe("applyOptimisticEvent — reorders", () => {
  describe("reorder-sections", () => {
    it("reorders sections to match the given sectionIds order", () => {
      const section1 = makeSection({ id: "s1" });
      const section2 = makeSection({ id: "s2" }, [
        makeLesson({ id: "lesson-2" }),
      ]);
      const section3 = makeSection({ id: "s3" }, [
        makeLesson({ id: "lesson-3" }),
      ]);
      const loaderData = makeLoaderData([section1, section2, section3]);

      const event: CourseEditorEvent = {
        type: "reorder-sections",
        sectionIds: ["s3", "s1", "s2"],
      };

      const result = applyOptimisticEvent(loaderData, event);

      expect(result.selectedCourse!.sections.map((s) => s.id)).toEqual([
        "s3",
        "s1",
        "s2",
      ]);
    });

    it("does not mutate the original loaderData", () => {
      const section1 = makeSection({ id: "s1" });
      const section2 = makeSection({ id: "s2" }, [
        makeLesson({ id: "lesson-2" }),
      ]);
      const loaderData = makeLoaderData([section1, section2]);

      const event: CourseEditorEvent = {
        type: "reorder-sections",
        sectionIds: ["s2", "s1"],
      };

      const result = applyOptimisticEvent(loaderData, event);

      expect(result).not.toBe(loaderData);
      expect(loaderData.selectedCourse!.sections.map((s) => s.id)).toEqual([
        "s1",
        "s2",
      ]);
    });

    it("preserves section object references", () => {
      const section1 = makeSection({ id: "s1" });
      const section2 = makeSection({ id: "s2" }, [
        makeLesson({ id: "lesson-2" }),
      ]);
      const loaderData = makeLoaderData([section1, section2]);

      const event: CourseEditorEvent = {
        type: "reorder-sections",
        sectionIds: ["s2", "s1"],
      };

      const result = applyOptimisticEvent(loaderData, event);

      expect(result.selectedCourse!.sections[0]).toBe(section2);
      expect(result.selectedCourse!.sections[1]).toBe(section1);
    });

    it("returns loaderData unchanged when order is the same", () => {
      const section1 = makeSection({ id: "s1" });
      const section2 = makeSection({ id: "s2" }, [
        makeLesson({ id: "lesson-2" }),
      ]);
      const loaderData = makeLoaderData([section1, section2]);

      const event: CourseEditorEvent = {
        type: "reorder-sections",
        sectionIds: ["s1", "s2"],
      };

      const result = applyOptimisticEvent(loaderData, event);

      expect(result).toBe(loaderData);
    });

    it("returns loaderData unchanged with empty sectionIds", () => {
      const loaderData = makeLoaderData([makeSection({ id: "s1" })]);

      const event: CourseEditorEvent = {
        type: "reorder-sections",
        sectionIds: [],
      };

      const result = applyOptimisticEvent(loaderData, event);

      expect(result).toBe(loaderData);
    });

    it("appends sections not in sectionIds at the end", () => {
      const section1 = makeSection({ id: "s1" });
      const section2 = makeSection({ id: "s2" }, [
        makeLesson({ id: "lesson-2" }),
      ]);
      const section3 = makeSection({ id: "s3" }, [
        makeLesson({ id: "lesson-3" }),
      ]);
      const loaderData = makeLoaderData([section1, section2, section3]);

      const event: CourseEditorEvent = {
        type: "reorder-sections",
        sectionIds: ["s3", "s1"],
      };

      const result = applyOptimisticEvent(loaderData, event);

      expect(result.selectedCourse!.sections.map((s) => s.id)).toEqual([
        "s3",
        "s1",
        "s2",
      ]);
    });
  });

  describe("reorder-lessons", () => {
    it("reorders lessons within the target section", () => {
      const lesson1 = makeLesson({ id: "l1" });
      const lesson2 = makeLesson({ id: "l2" });
      const lesson3 = makeLesson({ id: "l3" });
      const section = makeSection({ id: "s1" }, [lesson1, lesson2, lesson3]);
      const loaderData = makeLoaderData([section]);

      const event: CourseEditorEvent = {
        type: "reorder-lessons",
        sectionId: "s1",
        lessonIds: ["l3", "l1", "l2"],
      };

      const result = applyOptimisticEvent(loaderData, event);

      expect(
        result.selectedCourse!.sections[0]!.lessons.map((l) => l.id)
      ).toEqual(["l3", "l1", "l2"]);
    });

    it("does not mutate the original loaderData", () => {
      const lesson1 = makeLesson({ id: "l1" });
      const lesson2 = makeLesson({ id: "l2" });
      const section = makeSection({ id: "s1" }, [lesson1, lesson2]);
      const loaderData = makeLoaderData([section]);

      const event: CourseEditorEvent = {
        type: "reorder-lessons",
        sectionId: "s1",
        lessonIds: ["l2", "l1"],
      };

      const result = applyOptimisticEvent(loaderData, event);

      expect(result).not.toBe(loaderData);
      expect(
        loaderData.selectedCourse!.sections[0]!.lessons.map((l) => l.id)
      ).toEqual(["l1", "l2"]);
    });

    it("preserves lesson object references", () => {
      const lesson1 = makeLesson({ id: "l1" });
      const lesson2 = makeLesson({ id: "l2" });
      const section = makeSection({ id: "s1" }, [lesson1, lesson2]);
      const loaderData = makeLoaderData([section]);

      const event: CourseEditorEvent = {
        type: "reorder-lessons",
        sectionId: "s1",
        lessonIds: ["l2", "l1"],
      };

      const result = applyOptimisticEvent(loaderData, event);

      expect(result.selectedCourse!.sections[0]!.lessons[0]).toBe(lesson2);
      expect(result.selectedCourse!.sections[0]!.lessons[1]).toBe(lesson1);
    });

    it("returns loaderData unchanged when section is not found", () => {
      const loaderData = makeLoaderData([makeSection({ id: "s1" })]);

      const event: CourseEditorEvent = {
        type: "reorder-lessons",
        sectionId: "nonexistent",
        lessonIds: ["l1"],
      };

      const result = applyOptimisticEvent(loaderData, event);

      expect(result).toBe(loaderData);
    });

    it("returns loaderData unchanged when order is the same", () => {
      const lesson1 = makeLesson({ id: "l1" });
      const lesson2 = makeLesson({ id: "l2" });
      const section = makeSection({ id: "s1" }, [lesson1, lesson2]);
      const loaderData = makeLoaderData([section]);

      const event: CourseEditorEvent = {
        type: "reorder-lessons",
        sectionId: "s1",
        lessonIds: ["l1", "l2"],
      };

      const result = applyOptimisticEvent(loaderData, event);

      expect(result).toBe(loaderData);
    });

    it("does not affect other sections", () => {
      const section1 = makeSection({ id: "s1" }, [
        makeLesson({ id: "l1" }),
        makeLesson({ id: "l2" }),
      ]);
      const section2 = makeSection({ id: "s2" }, [makeLesson({ id: "l3" })]);
      const loaderData = makeLoaderData([section1, section2]);

      const event: CourseEditorEvent = {
        type: "reorder-lessons",
        sectionId: "s1",
        lessonIds: ["l2", "l1"],
      };

      const result = applyOptimisticEvent(loaderData, event);

      expect(result.selectedCourse!.sections[1]).toBe(section2);
    });

    it("appends lessons not in lessonIds at the end", () => {
      const lesson1 = makeLesson({ id: "l1" });
      const lesson2 = makeLesson({ id: "l2" });
      const lesson3 = makeLesson({ id: "l3" });
      const section = makeSection({ id: "s1" }, [lesson1, lesson2, lesson3]);
      const loaderData = makeLoaderData([section]);

      const event: CourseEditorEvent = {
        type: "reorder-lessons",
        sectionId: "s1",
        lessonIds: ["l3", "l1"],
      };

      const result = applyOptimisticEvent(loaderData, event);

      expect(
        result.selectedCourse!.sections[0]!.lessons.map((l) => l.id)
      ).toEqual(["l3", "l1", "l2"]);
    });
  });

  describe("move-lesson-to-section", () => {
    it("moves a lesson from one section to the end of another", () => {
      const lesson1 = makeLesson({ id: "l1" });
      const lesson2 = makeLesson({ id: "l2" });
      const lesson3 = makeLesson({ id: "l3" });
      const section1 = makeSection({ id: "s1" }, [lesson1, lesson2]);
      const section2 = makeSection({ id: "s2" }, [lesson3]);
      const loaderData = makeLoaderData([section1, section2]);

      const event: CourseEditorEvent = {
        type: "move-lesson-to-section",
        lessonId: "l1",
        targetSectionId: "s2",
      };

      const result = applyOptimisticEvent(loaderData, event);

      expect(
        result.selectedCourse!.sections[0]!.lessons.map((l) => l.id)
      ).toEqual(["l2"]);
      expect(
        result.selectedCourse!.sections[1]!.lessons.map((l) => l.id)
      ).toEqual(["l3", "l1"]);
    });

    it("does not mutate the original loaderData", () => {
      const lesson1 = makeLesson({ id: "l1" });
      const lesson2 = makeLesson({ id: "l2" });
      const section1 = makeSection({ id: "s1" }, [lesson1]);
      const section2 = makeSection({ id: "s2" }, [lesson2]);
      const loaderData = makeLoaderData([section1, section2]);

      const event: CourseEditorEvent = {
        type: "move-lesson-to-section",
        lessonId: "l1",
        targetSectionId: "s2",
      };

      const result = applyOptimisticEvent(loaderData, event);

      expect(result).not.toBe(loaderData);
      expect(
        loaderData.selectedCourse!.sections[0]!.lessons.map((l) => l.id)
      ).toEqual(["l1"]);
      expect(
        loaderData.selectedCourse!.sections[1]!.lessons.map((l) => l.id)
      ).toEqual(["l2"]);
    });

    it("preserves the lesson object reference after move", () => {
      const lesson1 = makeLesson({ id: "l1" });
      const section1 = makeSection({ id: "s1" }, [lesson1]);
      const section2 = makeSection({ id: "s2" }, []);
      const loaderData = makeLoaderData([section1, section2]);

      const event: CourseEditorEvent = {
        type: "move-lesson-to-section",
        lessonId: "l1",
        targetSectionId: "s2",
      };

      const result = applyOptimisticEvent(loaderData, event);

      expect(result.selectedCourse!.sections[1]!.lessons[0]).toBe(lesson1);
    });

    it("returns loaderData unchanged when lesson is not found", () => {
      const section1 = makeSection({ id: "s1" }, [makeLesson({ id: "l1" })]);
      const section2 = makeSection({ id: "s2" }, []);
      const loaderData = makeLoaderData([section1, section2]);

      const event: CourseEditorEvent = {
        type: "move-lesson-to-section",
        lessonId: "nonexistent",
        targetSectionId: "s2",
      };

      const result = applyOptimisticEvent(loaderData, event);

      expect(result).toBe(loaderData);
    });

    it("returns loaderData unchanged when target section is not found", () => {
      const section1 = makeSection({ id: "s1" }, [makeLesson({ id: "l1" })]);
      const loaderData = makeLoaderData([section1]);

      const event: CourseEditorEvent = {
        type: "move-lesson-to-section",
        lessonId: "l1",
        targetSectionId: "nonexistent",
      };

      const result = applyOptimisticEvent(loaderData, event);

      expect(result).toBe(loaderData);
    });

    it("does not affect unrelated sections", () => {
      const lesson1 = makeLesson({ id: "l1" });
      const section1 = makeSection({ id: "s1" }, [lesson1]);
      const section2 = makeSection({ id: "s2" }, []);
      const section3 = makeSection({ id: "s3" }, [makeLesson({ id: "l3" })]);
      const loaderData = makeLoaderData([section1, section2, section3]);

      const event: CourseEditorEvent = {
        type: "move-lesson-to-section",
        lessonId: "l1",
        targetSectionId: "s2",
      };

      const result = applyOptimisticEvent(loaderData, event);

      expect(result.selectedCourse!.sections[2]).toBe(section3);
    });

    it("moves to an empty target section", () => {
      const lesson1 = makeLesson({ id: "l1" });
      const section1 = makeSection({ id: "s1" }, [lesson1]);
      const section2 = makeSection({ id: "s2" }, []);
      const loaderData = makeLoaderData([section1, section2]);

      const event: CourseEditorEvent = {
        type: "move-lesson-to-section",
        lessonId: "l1",
        targetSectionId: "s2",
      };

      const result = applyOptimisticEvent(loaderData, event);

      expect(result.selectedCourse!.sections[0]!.lessons).toEqual([]);
      expect(
        result.selectedCourse!.sections[1]!.lessons.map((l) => l.id)
      ).toEqual(["l1"]);
    });
  });
});
