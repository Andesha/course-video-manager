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
  describe("Lesson Icon (26)", () => {
    it("26. lesson-icon-changed: update icon + emit plan-changed", () => {
      const plan = createTestPlan({
        sections: [
          {
            id: "s1",
            title: "Section 1",
            order: 0,
            lessons: [{ id: "l1", title: "Lesson 1", order: 0 }],
          },
        ],
      });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      const state = tester
        .send({
          type: "lesson-icon-changed",
          sectionId: "s1",
          lessonId: "l1",
          icon: "code",
        })
        .getState();

      expect(state.plan.sections[0]?.lessons[0]?.icon).toBe("code");
      expect(tester.getExec()).toHaveBeenCalledWith(
        expect.objectContaining({ type: "plan-changed" })
      );
    });
  });

  describe("Lesson Priority", () => {
    it("lesson-priority-set: sets priority to P1 + emit plan-changed", () => {
      const plan = createTestPlan({
        sections: [
          {
            id: "s1",
            title: "Section 1",
            order: 0,
            lessons: [{ id: "l1", title: "Lesson 1", order: 0 }],
          },
        ],
      });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      const state = tester
        .send({
          type: "lesson-priority-set",
          sectionId: "s1",
          lessonId: "l1",
          priority: 1,
        })
        .getState();

      expect(state.plan.sections[0]?.lessons[0]?.priority).toBe(1);
      expect(tester.getExec()).toHaveBeenCalledWith(
        expect.objectContaining({ type: "plan-changed" })
      );
    });

    it("lesson-priority-set: sets priority to P2 + emit plan-changed", () => {
      const plan = createTestPlan({
        sections: [
          {
            id: "s1",
            title: "Section 1",
            order: 0,
            lessons: [{ id: "l1", title: "Lesson 1", order: 0, priority: 3 }],
          },
        ],
      });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      const state = tester
        .send({
          type: "lesson-priority-set",
          sectionId: "s1",
          lessonId: "l1",
          priority: 2,
        })
        .getState();

      expect(state.plan.sections[0]?.lessons[0]?.priority).toBe(2);
      expect(tester.getExec()).toHaveBeenCalledWith(
        expect.objectContaining({ type: "plan-changed" })
      );
    });

    it("lesson-priority-set: sets priority to P3 + emit plan-changed", () => {
      const plan = createTestPlan({
        sections: [
          {
            id: "s1",
            title: "Section 1",
            order: 0,
            lessons: [{ id: "l1", title: "Lesson 1", order: 0, priority: 1 }],
          },
        ],
      });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      const state = tester
        .send({
          type: "lesson-priority-set",
          sectionId: "s1",
          lessonId: "l1",
          priority: 3,
        })
        .getState();

      expect(state.plan.sections[0]?.lessons[0]?.priority).toBe(3);
      expect(tester.getExec()).toHaveBeenCalledWith(
        expect.objectContaining({ type: "plan-changed" })
      );
    });

    it("lesson-priority-set: pins the lesson to prevent filter removal", () => {
      const plan = createTestPlan({
        sections: [
          {
            id: "s1",
            title: "Section 1",
            order: 0,
            lessons: [{ id: "l1", title: "Lesson 1", order: 0, priority: 1 }],
          },
        ],
      });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      const state = tester
        .send({
          type: "lesson-priority-set",
          sectionId: "s1",
          lessonId: "l1",
          priority: 3,
        })
        .getState();

      expect(state.pinnedLessonIds).toContain("l1");
    });

    it("lesson-priority-set: does not duplicate pinned lesson on multiple sets", () => {
      const plan = createTestPlan({
        sections: [
          {
            id: "s1",
            title: "Section 1",
            order: 0,
            lessons: [{ id: "l1", title: "Lesson 1", order: 0, priority: 1 }],
          },
        ],
      });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      const state = tester
        .send({
          type: "lesson-priority-set",
          sectionId: "s1",
          lessonId: "l1",
          priority: 2,
        })
        .send({
          type: "lesson-priority-set",
          sectionId: "s1",
          lessonId: "l1",
          priority: 3,
        })
        .send({
          type: "lesson-priority-set",
          sectionId: "s1",
          lessonId: "l1",
          priority: 1,
        })
        .getState();

      expect(state.pinnedLessonIds).toEqual(["l1"]);
    });
  });

  describe("Lesson Status", () => {
    it("lesson-status-toggled: toggle from todo to done + emit plan-changed", () => {
      const plan = createTestPlan({
        sections: [
          {
            id: "s1",
            title: "Section 1",
            order: 0,
            lessons: [
              { id: "l1", title: "Lesson 1", order: 0, status: "todo" },
            ],
          },
        ],
      });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      const state = tester
        .send({
          type: "lesson-status-toggled",
          sectionId: "s1",
          lessonId: "l1",
        })
        .getState();

      expect(state.plan.sections[0]?.lessons[0]?.status).toBe("done");
      expect(tester.getExec()).toHaveBeenCalledWith(
        expect.objectContaining({ type: "plan-changed" })
      );
    });

    it("lesson-status-toggled: toggle from done to maybe + emit plan-changed", () => {
      const plan = createTestPlan({
        sections: [
          {
            id: "s1",
            title: "Section 1",
            order: 0,
            lessons: [
              { id: "l1", title: "Lesson 1", order: 0, status: "done" },
            ],
          },
        ],
      });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      const state = tester
        .send({
          type: "lesson-status-toggled",
          sectionId: "s1",
          lessonId: "l1",
        })
        .getState();

      expect(state.plan.sections[0]?.lessons[0]?.status).toBe("maybe");
      expect(tester.getExec()).toHaveBeenCalledWith(
        expect.objectContaining({ type: "plan-changed" })
      );
    });

    it("lesson-status-toggled: toggle from maybe to todo + emit plan-changed", () => {
      const plan = createTestPlan({
        sections: [
          {
            id: "s1",
            title: "Section 1",
            order: 0,
            lessons: [
              { id: "l1", title: "Lesson 1", order: 0, status: "maybe" },
            ],
          },
        ],
      });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      const state = tester
        .send({
          type: "lesson-status-toggled",
          sectionId: "s1",
          lessonId: "l1",
        })
        .getState();

      expect(state.plan.sections[0]?.lessons[0]?.status).toBe("todo");
      expect(tester.getExec()).toHaveBeenCalledWith(
        expect.objectContaining({ type: "plan-changed" })
      );
    });

    it("lesson-status-toggled: default undefined status treated as todo", () => {
      const plan = createTestPlan({
        sections: [
          {
            id: "s1",
            title: "Section 1",
            order: 0,
            lessons: [{ id: "l1", title: "Lesson 1", order: 0 }], // no status field
          },
        ],
      });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      const state = tester
        .send({
          type: "lesson-status-toggled",
          sectionId: "s1",
          lessonId: "l1",
        })
        .getState();

      // undefined should toggle to "done"
      expect(state.plan.sections[0]?.lessons[0]?.status).toBe("done");
      expect(tester.getExec()).toHaveBeenCalledWith(
        expect.objectContaining({ type: "plan-changed" })
      );
    });
  });

  describe("Lesson Dependencies (27)", () => {
    it("27. lesson-dependencies-changed: update dependencies + emit plan-changed", () => {
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
        ],
      });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      const state = tester
        .send({
          type: "lesson-dependencies-changed",
          sectionId: "s1",
          lessonId: "l2",
          dependencies: ["l1"],
        })
        .getState();

      expect(state.plan.sections[0]?.lessons[1]?.dependencies).toEqual(["l1"]);
      expect(tester.getExec()).toHaveBeenCalledWith(
        expect.objectContaining({ type: "plan-changed" })
      );
    });
  });
});
