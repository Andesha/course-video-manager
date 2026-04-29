import type { EffectReducer } from "use-effect-reducer";
import type { Plan, Section, Lesson } from "./types";
import type {
  PlanReducerState,
  PlanReducerAction,
  PlanReducerEffect,
} from "./plan-state-reducer.types";
import {
  generateId,
  getTimestamp,
  capitalizeTitle,
  handleSectionReordered,
  handleLessonReordered,
} from "./plan-state-reducer.helpers";

export type {
  PlanReducerState,
  PlanReducerAction,
  PlanReducerEffect,
} from "./plan-state-reducer.types";

export namespace planStateReducer {
  export type State = PlanReducerState;
  export type Action = PlanReducerAction;
  export type Effect = PlanReducerEffect;
}

export const createInitialPlanState = (plan: Plan): planStateReducer.State => ({
  plan,
  syncError: null,
  editingTitle: { active: false },
  editingSection: null,
  addingSection: { active: false },
  editingLesson: null,
  addingLesson: null,
  editingDescription: null,
  focusRequest: null,
  deletingSection: null,
  deletingLesson: null,
  priorityFilter: [],
  pinnedLessonIds: [],
  iconFilter: [],
});

export const planStateReducer: EffectReducer<
  planStateReducer.State,
  planStateReducer.Action,
  planStateReducer.Effect
> = (
  state: planStateReducer.State,
  action: planStateReducer.Action,
  exec
): planStateReducer.State => {
  switch (action.type) {
    // Plan Title (1-4)
    case "plan-title-clicked": {
      return {
        ...state,
        editingTitle: { active: true, value: state.plan.title },
      };
    }
    case "plan-title-changed": {
      if (!state.editingTitle.active) return state;
      return {
        ...state,
        editingTitle: { active: true, value: action.value },
      };
    }
    case "plan-title-save-requested": {
      if (!state.editingTitle.active) return state;
      const newTitle = state.editingTitle.value.trim();
      if (!newTitle) return state;

      const updatedPlan: Plan = {
        ...state.plan,
        title: newTitle,
        updatedAt: getTimestamp(),
      };

      exec({ type: "plan-changed" });

      return {
        ...state,
        plan: updatedPlan,
        editingTitle: { active: false },
      };
    }
    case "plan-title-cancel-requested": {
      return {
        ...state,
        editingTitle: { active: false },
      };
    }

    // Add Section (5-8)
    case "add-section-clicked": {
      return {
        ...state,
        addingSection: { active: true, value: "" },
      };
    }
    case "new-section-title-changed": {
      if (!state.addingSection.active) return state;
      return {
        ...state,
        addingSection: { active: true, value: action.value },
      };
    }
    case "new-section-save-requested": {
      if (!state.addingSection.active) return state;
      const newTitle = capitalizeTitle(state.addingSection.value.trim());
      if (!newTitle) return state;

      const maxOrder = Math.max(0, ...state.plan.sections.map((s) => s.order));
      const newSection: Section = {
        id: generateId(),
        title: newTitle,
        order: maxOrder + 1,
        lessons: [],
      };

      const updatedPlan: Plan = {
        ...state.plan,
        sections: [...state.plan.sections, newSection],
        updatedAt: getTimestamp(),
      };

      exec({ type: "plan-changed" });
      exec({
        type: "focus-element",
        target: { type: "add-lesson-button", sectionId: newSection.id },
      });

      return {
        ...state,
        plan: updatedPlan,
        addingSection: { active: false },
        focusRequest: { type: "add-lesson-button", sectionId: newSection.id },
      };
    }
    case "new-section-cancel-requested": {
      return {
        ...state,
        addingSection: { active: false },
      };
    }

    // Edit Section (9-11)
    case "section-title-clicked": {
      const section = state.plan.sections.find(
        (s) => s.id === action.sectionId
      );
      if (!section) return state;
      return {
        ...state,
        editingSection: { sectionId: action.sectionId, value: section.title },
      };
    }
    case "section-title-changed": {
      if (!state.editingSection) return state;
      return {
        ...state,
        editingSection: { ...state.editingSection, value: action.value },
      };
    }
    case "section-save-requested": {
      if (!state.editingSection) return state;
      const newTitle = capitalizeTitle(state.editingSection.value.trim());
      if (!newTitle) return state;

      const updatedPlan: Plan = {
        ...state.plan,
        sections: state.plan.sections.map((section) =>
          section.id === state.editingSection!.sectionId
            ? { ...section, title: newTitle }
            : section
        ),
        updatedAt: getTimestamp(),
      };

      exec({ type: "plan-changed" });

      return {
        ...state,
        plan: updatedPlan,
        editingSection: null,
      };
    }
    case "section-cancel-requested": {
      return {
        ...state,
        editingSection: null,
      };
    }

    // Delete Section (12)
    case "section-delete-clicked": {
      const section = state.plan.sections.find(
        (s) => s.id === action.sectionId
      );
      if (!section) return state;

      const lessonCount = section.lessons.length;

      // If section has lessons, show confirmation modal
      if (lessonCount > 0) {
        return {
          ...state,
          deletingSection: { sectionId: action.sectionId, lessonCount },
        };
      }

      // If section is empty, delete immediately
      const updatedPlan: Plan = {
        ...state.plan,
        sections: state.plan.sections.filter((s) => s.id !== action.sectionId),
        updatedAt: getTimestamp(),
      };

      exec({ type: "plan-changed" });

      return {
        ...state,
        plan: updatedPlan,
      };
    }
    case "section-delete-confirmed": {
      if (!state.deletingSection) return state;

      const updatedPlan: Plan = {
        ...state.plan,
        sections: state.plan.sections.filter(
          (section) => section.id !== state.deletingSection!.sectionId
        ),
        updatedAt: getTimestamp(),
      };

      exec({ type: "plan-changed" });

      return {
        ...state,
        plan: updatedPlan,
        deletingSection: null,
      };
    }
    case "section-delete-cancelled": {
      return {
        ...state,
        deletingSection: null,
      };
    }

    // Add Lesson (13-16)
    case "add-lesson-clicked": {
      return {
        ...state,
        addingLesson: { sectionId: action.sectionId, value: "" },
      };
    }
    case "new-lesson-title-changed": {
      if (!state.addingLesson) return state;
      return {
        ...state,
        addingLesson: { ...state.addingLesson, value: action.value },
      };
    }
    case "new-lesson-save-requested": {
      if (!state.addingLesson) return state;
      const newTitle = capitalizeTitle(state.addingLesson.value.trim());
      if (!newTitle) return state;

      const sectionId = state.addingLesson.sectionId;
      const section = state.plan.sections.find((s) => s.id === sectionId);
      if (!section) return state;

      const maxOrder = Math.max(0, ...section.lessons.map((l) => l.order));
      const newLesson: Lesson = {
        id: generateId(),
        title: newTitle,
        order: maxOrder + 1,
        description: "",
        status: "maybe",
      };

      const updatedPlan: Plan = {
        ...state.plan,
        sections: state.plan.sections.map((s) =>
          s.id === sectionId ? { ...s, lessons: [...s.lessons, newLesson] } : s
        ),
        updatedAt: getTimestamp(),
      };

      exec({ type: "plan-changed" });
      exec({
        type: "focus-element",
        target: { type: "add-lesson-button", sectionId },
      });

      return {
        ...state,
        plan: updatedPlan,
        addingLesson: null,
        focusRequest: { type: "add-lesson-button", sectionId },
      };
    }
    case "new-lesson-cancel-requested": {
      return {
        ...state,
        addingLesson: null,
      };
    }

    // Edit Lesson (17-20)
    case "lesson-title-clicked": {
      const section = state.plan.sections.find(
        (s) => s.id === action.sectionId
      );
      const lesson = section?.lessons.find((l) => l.id === action.lessonId);
      if (!lesson) return state;
      return {
        ...state,
        editingLesson: { lessonId: action.lessonId, value: lesson.title },
      };
    }
    case "lesson-title-changed": {
      if (!state.editingLesson) return state;
      return {
        ...state,
        editingLesson: { ...state.editingLesson, value: action.value },
      };
    }
    case "lesson-save-requested": {
      if (!state.editingLesson) return state;
      const newTitle = capitalizeTitle(state.editingLesson.value.trim());
      if (!newTitle) return state;

      const lessonId = state.editingLesson.lessonId;

      const updatedPlan: Plan = {
        ...state.plan,
        sections: state.plan.sections.map((section) => ({
          ...section,
          lessons: section.lessons.map((lesson) =>
            lesson.id === lessonId ? { ...lesson, title: newTitle } : lesson
          ),
        })),
        updatedAt: getTimestamp(),
      };

      exec({ type: "plan-changed" });

      return {
        ...state,
        plan: updatedPlan,
        editingLesson: null,
      };
    }
    case "lesson-cancel-requested": {
      return {
        ...state,
        editingLesson: null,
      };
    }

    // Delete Lesson (21)
    case "lesson-delete-clicked": {
      return {
        ...state,
        deletingLesson: {
          sectionId: action.sectionId,
          lessonId: action.lessonId,
        },
      };
    }
    case "lesson-delete-confirmed": {
      if (!state.deletingLesson) return state;

      const { sectionId, lessonId } = state.deletingLesson;

      const updatedPlan: Plan = {
        ...state.plan,
        sections: state.plan.sections.map((section) => {
          const filteredLessons =
            section.id === sectionId
              ? section.lessons.filter((lesson) => lesson.id !== lessonId)
              : section.lessons;

          // Remove deleted lesson from other lessons' dependencies
          const updatedLessons = filteredLessons.map((lesson) => {
            if (lesson.dependencies && lesson.dependencies.includes(lessonId)) {
              return {
                ...lesson,
                dependencies: lesson.dependencies.filter(
                  (id) => id !== lessonId
                ),
              };
            }
            return lesson;
          });

          return {
            ...section,
            lessons: updatedLessons,
          };
        }),
        updatedAt: getTimestamp(),
      };

      exec({ type: "plan-changed" });

      return {
        ...state,
        plan: updatedPlan,
        deletingLesson: null,
      };
    }
    case "lesson-delete-cancelled": {
      return {
        ...state,
        deletingLesson: null,
      };
    }

    // Lesson Description (22-25)
    case "lesson-description-clicked": {
      const section = state.plan.sections.find(
        (s) => s.id === action.sectionId
      );
      const lesson = section?.lessons.find((l) => l.id === action.lessonId);
      if (!lesson) return state;
      return {
        ...state,
        editingDescription: {
          lessonId: action.lessonId,
          value: lesson.description || "",
        },
      };
    }
    case "lesson-description-changed": {
      if (!state.editingDescription) return state;
      return {
        ...state,
        editingDescription: {
          ...state.editingDescription,
          value: action.value,
        },
      };
    }
    case "lesson-description-save-requested": {
      if (!state.editingDescription) return state;

      const lessonId = state.editingDescription.lessonId;
      const newDescription = state.editingDescription.value;

      const updatedPlan: Plan = {
        ...state.plan,
        sections: state.plan.sections.map((section) => ({
          ...section,
          lessons: section.lessons.map((lesson) =>
            lesson.id === lessonId
              ? { ...lesson, description: newDescription }
              : lesson
          ),
        })),
        updatedAt: getTimestamp(),
      };

      exec({ type: "plan-changed" });

      return {
        ...state,
        plan: updatedPlan,
        editingDescription: null,
      };
    }
    case "lesson-description-cancel-requested": {
      return {
        ...state,
        editingDescription: null,
      };
    }

    // Lesson Icon (26)
    case "lesson-icon-changed": {
      const updatedPlan: Plan = {
        ...state.plan,
        sections: state.plan.sections.map((section) =>
          section.id === action.sectionId
            ? {
                ...section,
                lessons: section.lessons.map((lesson) =>
                  lesson.id === action.lessonId
                    ? { ...lesson, icon: action.icon }
                    : lesson
                ),
              }
            : section
        ),
        updatedAt: getTimestamp(),
      };

      exec({ type: "plan-changed" });

      return {
        ...state,
        plan: updatedPlan,
      };
    }

    // Lesson Status
    case "lesson-status-toggled": {
      const updatedPlan: Plan = {
        ...state.plan,
        sections: state.plan.sections.map((section) =>
          section.id === action.sectionId
            ? {
                ...section,
                lessons: section.lessons.map((lesson) =>
                  lesson.id === action.lessonId
                    ? {
                        ...lesson,
                        status:
                          lesson.status === "done"
                            ? "maybe"
                            : lesson.status === "maybe"
                              ? "todo"
                              : "done",
                      }
                    : lesson
                ),
              }
            : section
        ),
        updatedAt: getTimestamp(),
      };

      exec({ type: "plan-changed" });

      return {
        ...state,
        plan: updatedPlan,
      };
    }

    // Lesson Priority
    case "lesson-priority-set": {
      const updatedPlan: Plan = {
        ...state.plan,
        sections: state.plan.sections.map((section) =>
          section.id === action.sectionId
            ? {
                ...section,
                lessons: section.lessons.map((lesson) =>
                  lesson.id === action.lessonId
                    ? {
                        ...lesson,
                        priority: action.priority,
                      }
                    : lesson
                ),
              }
            : section
        ),
        updatedAt: getTimestamp(),
      };

      exec({ type: "plan-changed" });

      // Pin the lesson so it stays visible even if it no longer matches the filter
      const pinnedLessonIds = state.pinnedLessonIds.includes(action.lessonId)
        ? state.pinnedLessonIds
        : [...state.pinnedLessonIds, action.lessonId];

      return {
        ...state,
        plan: updatedPlan,
        pinnedLessonIds,
      };
    }

    // Lesson Dependencies (27)
    case "lesson-dependencies-changed": {
      const updatedPlan: Plan = {
        ...state.plan,
        sections: state.plan.sections.map((section) =>
          section.id === action.sectionId
            ? {
                ...section,
                lessons: section.lessons.map((lesson) =>
                  lesson.id === action.lessonId
                    ? { ...lesson, dependencies: action.dependencies }
                    : lesson
                ),
              }
            : section
        ),
        updatedAt: getTimestamp(),
      };

      exec({ type: "plan-changed" });

      return {
        ...state,
        plan: updatedPlan,
      };
    }

    // Reordering (28-30)
    case "section-reordered":
      return handleSectionReordered(state, action, exec);
    case "lesson-reordered":
      return handleLessonReordered(state, action, exec);

    // Sync (31-32)
    case "sync-failed": {
      return {
        ...state,
        syncError: action.error,
      };
    }
    case "sync-retry-requested": {
      exec({ type: "plan-changed" });
      return state;
    }

    // Focus (33)
    case "focus-handled": {
      return {
        ...state,
        focusRequest: null,
      };
    }

    // Priority Filter (34)
    case "priority-filter-toggled": {
      // Toggle the priority in the filter array
      const currentFilter = state.priorityFilter;
      const hasPriority = currentFilter.includes(action.priority);
      const newFilter = hasPriority
        ? currentFilter.filter((p) => p !== action.priority)
        : [...currentFilter, action.priority];
      // Clear pinned lessons when filter changes
      return {
        ...state,
        priorityFilter: newFilter,
        pinnedLessonIds: [],
      };
    }

    // Icon Filter (35)
    case "icon-filter-toggled": {
      // Toggle the icon in the filter array
      const currentFilter = state.iconFilter;
      const hasIcon = currentFilter.includes(action.icon);
      const newFilter = hasIcon
        ? currentFilter.filter((i) => i !== action.icon)
        : [...currentFilter, action.icon];
      return {
        ...state,
        iconFilter: newFilter,
      };
    }
  }

  return state;
};
