import { describe, expect, it } from "vitest";
import { planStateReducer, createInitialPlanState } from "./plan-state-reducer";
import type { Plan } from "./types";
import { ReducerTester } from "@/test-utils/reducer-tester";

const createTestPlan = (overrides: Partial<Plan> = {}): Plan => ({
  id: "plan-1",
  title: "Test Plan",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  sections: [],
  ...overrides,
});

const createInitialState = (
  plan: Plan = createTestPlan()
): planStateReducer.State => createInitialPlanState(plan);

describe("planStateReducer", () => {
  describe("Reordering (28-30)", () => {
    it("28. section-reordered: update section orders + emit plan-changed", () => {
      const plan = createTestPlan({
        sections: [
          { id: "s1", title: "Section 1", order: 0, lessons: [] },
          { id: "s2", title: "Section 2", order: 1, lessons: [] },
          { id: "s3", title: "Section 3", order: 2, lessons: [] },
        ],
      });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      // Move s1 from index 0 to index 2
      const state = tester
        .send({ type: "section-reordered", sectionId: "s1", newIndex: 2 })
        .getState();

      const sortedSections = [...state.plan.sections].sort(
        (a, b) => a.order - b.order
      );
      expect(sortedSections.map((s) => s.id)).toEqual(["s2", "s3", "s1"]);
      expect(tester.getExec()).toHaveBeenCalledWith(
        expect.objectContaining({ type: "plan-changed" })
      );
    });

    it("29. lesson-reordered (same section): update orders + emit plan-changed", () => {
      const plan = createTestPlan({
        sections: [
          {
            id: "s1",
            title: "Section 1",
            order: 0,
            lessons: [
              { id: "l1", title: "Lesson 1", order: 0 },
              { id: "l2", title: "Lesson 2", order: 1 },
              { id: "l3", title: "Lesson 3", order: 2 },
            ],
          },
        ],
      });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      // Move l1 from index 0 to index 2
      const state = tester
        .send({
          type: "lesson-reordered",
          fromSectionId: "s1",
          toSectionId: "s1",
          lessonId: "l1",
          newIndex: 2,
        })
        .getState();

      const sortedLessons = [...state.plan.sections[0]!.lessons].sort(
        (a, b) => a.order - b.order
      );
      expect(sortedLessons.map((l) => l.id)).toEqual(["l2", "l3", "l1"]);
      expect(tester.getExec()).toHaveBeenCalledWith(
        expect.objectContaining({ type: "plan-changed" })
      );
    });

    it("30. lesson-reordered (cross section): move + update orders + emit plan-changed", () => {
      const plan = createTestPlan({
        sections: [
          {
            id: "s1",
            title: "Section 1",
            order: 0,
            lessons: [
              { id: "l1", title: "Lesson 1", order: 0 },
              { id: "l2", title: "Lesson 2", order: 1 },
            ],
          },
          {
            id: "s2",
            title: "Section 2",
            order: 1,
            lessons: [{ id: "l3", title: "Lesson 3", order: 0 }],
          },
        ],
      });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      // Move l1 from s1 to s2 at index 1
      const state = tester
        .send({
          type: "lesson-reordered",
          fromSectionId: "s1",
          toSectionId: "s2",
          lessonId: "l1",
          newIndex: 1,
        })
        .getState();

      expect(state.plan.sections[0]?.lessons.map((l) => l.id)).toEqual(["l2"]);
      const sortedS2Lessons = [...state.plan.sections[1]!.lessons].sort(
        (a, b) => a.order - b.order
      );
      expect(sortedS2Lessons.map((l) => l.id)).toEqual(["l3", "l1"]);
      expect(tester.getExec()).toHaveBeenCalledWith(
        expect.objectContaining({ type: "plan-changed" })
      );
    });
  });

  describe("Sync (31-32)", () => {
    it("31. sync-failed: store error", () => {
      const tester = new ReducerTester(planStateReducer, createInitialState());

      const state = tester
        .send({ type: "sync-failed", error: "Network error" })
        .getState();

      expect(state.syncError).toBe("Network error");
    });

    it("32. sync-retry-requested: emit plan-changed", () => {
      const plan = createTestPlan({ title: "Test Plan" });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      const state = tester
        .send({ type: "sync-failed", error: "Network error" })
        .resetExec()
        .send({ type: "sync-retry-requested" })
        .getState();

      expect(tester.getExec()).toHaveBeenCalledWith({
        type: "plan-changed",
      });
      // Note: syncError remains until sync succeeds
      expect(state.syncError).toBe("Network error");
    });
  });

  describe("Focus (33)", () => {
    it("33. focus-handled: clear focusRequest", () => {
      const tester = new ReducerTester(planStateReducer, createInitialState());

      // First create a section to get a focus request
      const stateWithFocus = tester
        .send({ type: "add-section-clicked" })
        .send({ type: "new-section-title-changed", value: "New Section" })
        .send({ type: "new-section-save-requested" })
        .getState();

      expect(stateWithFocus.focusRequest).not.toBeNull();

      const state = tester.send({ type: "focus-handled" }).getState();

      expect(state.focusRequest).toBeNull();
    });
  });

  describe("Priority Filter (34)", () => {
    it("34a. priority-filter-toggled: adds priority to filter array", () => {
      const tester = new ReducerTester(planStateReducer, createInitialState());

      // Default is empty (show all)
      expect(tester.getState().priorityFilter).toEqual([]);

      const state = tester
        .send({ type: "priority-filter-toggled", priority: 1 })
        .getState();

      expect(state.priorityFilter).toEqual([1]);
    });

    it("34b. priority-filter-toggled: removes priority from filter array when already present", () => {
      const tester = new ReducerTester(planStateReducer, createInitialState());

      const state = tester
        .send({ type: "priority-filter-toggled", priority: 1 })
        .send({ type: "priority-filter-toggled", priority: 2 })
        .send({ type: "priority-filter-toggled", priority: 1 }) // toggle off P1
        .getState();

      expect(state.priorityFilter).toEqual([2]);
    });

    it("34c. priority-filter-toggled: allows multiple priorities to be selected", () => {
      const tester = new ReducerTester(planStateReducer, createInitialState());

      const state = tester
        .send({ type: "priority-filter-toggled", priority: 1 })
        .send({ type: "priority-filter-toggled", priority: 3 })
        .getState();

      expect(state.priorityFilter).toEqual([1, 3]);
    });

    it("34d. priority-filter-toggled: clears pinned lessons when filter changes", () => {
      const plan = createTestPlan({
        sections: [
          {
            id: "s1",
            title: "Section 1",
            order: 0,
            lessons: [
              { id: "l1", title: "Lesson 1", order: 0, priority: 1 },
              { id: "l2", title: "Lesson 2", order: 1, priority: 1 },
            ],
          },
        ],
      });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      // Pin some lessons by setting priority
      const stateWithPins = tester
        .send({
          type: "lesson-priority-set",
          sectionId: "s1",
          lessonId: "l1",
          priority: 3,
        })
        .send({
          type: "lesson-priority-set",
          sectionId: "s1",
          lessonId: "l2",
          priority: 1,
        })
        .getState();

      expect(stateWithPins.pinnedLessonIds).toHaveLength(2);

      // Change filter - should clear pins
      const state = tester
        .send({ type: "priority-filter-toggled", priority: 2 })
        .getState();

      expect(state.pinnedLessonIds).toEqual([]);
      expect(state.priorityFilter).toEqual([2]);
    });

    it("34e. initialState has empty priorityFilter (show all)", () => {
      const state = createInitialState(createTestPlan());

      expect(state.priorityFilter).toEqual([]);
      expect(state.pinnedLessonIds).toEqual([]);
    });
  });
});
