import type { Lesson, Plan, Section } from "./types";
import type {
  PlanReducerState,
  PlanReducerEffect,
} from "./plan-state-reducer.types";

export function generateId(): string {
  return crypto.randomUUID();
}

export function getTimestamp(): string {
  return new Date().toISOString();
}

export function capitalizeTitle(title: string): string {
  return title
    .split(" ")
    .map((word) => {
      const firstChar = word[0];
      return firstChar ? firstChar.toUpperCase() + word.slice(1) : word;
    })
    .join(" ");
}

export function handleSectionReordered(
  state: PlanReducerState,
  action: { type: "section-reordered"; sectionId: string; newIndex: number },
  exec: (effect: PlanReducerEffect) => void
): PlanReducerState {
  const sortedSections = [...state.plan.sections].sort(
    (a, b) => a.order - b.order
  );
  const currentIndex = sortedSections.findIndex(
    (s) => s.id === action.sectionId
  );
  if (currentIndex === -1 || currentIndex === action.newIndex) return state;

  const [movedSection] = sortedSections.splice(currentIndex, 1) as [Section];
  sortedSections.splice(action.newIndex, 0, movedSection);

  const reorderedSections = sortedSections.map((section, index) => ({
    ...section,
    order: index,
  }));

  const updatedPlan: Plan = {
    ...state.plan,
    sections: reorderedSections,
    updatedAt: getTimestamp(),
  };

  exec({ type: "plan-changed" });

  return {
    ...state,
    plan: updatedPlan,
  };
}

export function handleLessonReordered(
  state: PlanReducerState,
  action: {
    type: "lesson-reordered";
    fromSectionId: string;
    toSectionId: string;
    lessonId: string;
    newIndex: number;
  },
  exec: (effect: PlanReducerEffect) => void
): PlanReducerState {
  const fromSection = state.plan.sections.find(
    (s) => s.id === action.fromSectionId
  );
  const lesson = fromSection?.lessons.find((l) => l.id === action.lessonId);
  if (!lesson) return state;

  const toSection = state.plan.sections.find(
    (s) => s.id === action.toSectionId
  );
  if (!toSection) return state;

  const updatedPlan: Plan = {
    ...state.plan,
    sections: state.plan.sections.map((section) => {
      if (action.fromSectionId === action.toSectionId) {
        if (section.id !== action.toSectionId) return section;

        const sortedLessons = [...section.lessons].sort(
          (a, b) => a.order - b.order
        );
        const currentIndex = sortedLessons.findIndex(
          (l) => l.id === action.lessonId
        );
        if (currentIndex === -1 || currentIndex === action.newIndex)
          return section;

        const [movedLesson] = sortedLessons.splice(currentIndex, 1) as [Lesson];
        sortedLessons.splice(action.newIndex, 0, movedLesson);

        const reorderedLessons = sortedLessons.map((l, index) => ({
          ...l,
          order: index,
        }));

        return {
          ...section,
          lessons: reorderedLessons,
        };
      } else {
        if (section.id === action.fromSectionId) {
          const remainingLessons = section.lessons
            .filter((l) => l.id !== action.lessonId)
            .sort((a, b) => a.order - b.order)
            .map((l, index) => ({ ...l, order: index }));
          return {
            ...section,
            lessons: remainingLessons,
          };
        }
        if (section.id === action.toSectionId) {
          const sortedLessons = [...section.lessons].sort(
            (a, b) => a.order - b.order
          );
          sortedLessons.splice(action.newIndex, 0, lesson);

          const reorderedLessons = sortedLessons.map((l, index) => ({
            ...l,
            order: index,
          }));

          return {
            ...section,
            lessons: reorderedLessons,
          };
        }
      }
      return section;
    }),
    updatedAt: getTimestamp(),
  };

  exec({ type: "plan-changed" });

  return {
    ...state,
    plan: updatedPlan,
  };
}
