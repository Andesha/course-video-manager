import type { Lesson, LessonPriority, LessonIcon, Plan } from "./types";

export type PlanReducerState = {
  plan: Plan;
  syncError: string | null;
  editingTitle: { active: true; value: string } | { active: false };
  editingSection: { sectionId: string; value: string } | null;
  addingSection: { active: true; value: string } | { active: false };
  editingLesson: { lessonId: string; value: string } | null;
  addingLesson: { sectionId: string; value: string } | null;
  editingDescription: { lessonId: string; value: string } | null;
  focusRequest: { type: "add-lesson-button"; sectionId: string } | null;
  deletingSection: { sectionId: string; lessonCount: number } | null;
  deletingLesson: { sectionId: string; lessonId: string } | null;
  // Priority filter: empty = show all, or show only lessons with matching priority
  // Multiple priorities can be selected (empty array = show all)
  priorityFilter: LessonPriority[];
  // Pinned lessons are kept visible even if they don't match the filter
  // (used when user edits priority of a lesson while filter is active)
  pinnedLessonIds: string[];
  // Icon filter: null = show all, or show only lessons with matching icon
  // Multiple icons can be selected (empty array = show all)
  iconFilter: LessonIcon[];
};

export type PlanReducerAction =
  // Plan Title (1-4)
  | { type: "plan-title-clicked" }
  | { type: "plan-title-changed"; value: string }
  | { type: "plan-title-save-requested" }
  | { type: "plan-title-cancel-requested" }
  // Add Section (5-8)
  | { type: "add-section-clicked" }
  | { type: "new-section-title-changed"; value: string }
  | { type: "new-section-save-requested" }
  | { type: "new-section-cancel-requested" }
  // Edit Section (9-11)
  | { type: "section-title-clicked"; sectionId: string }
  | { type: "section-title-changed"; value: string }
  | { type: "section-save-requested" }
  | { type: "section-cancel-requested" }
  // Delete Section (12)
  | { type: "section-delete-clicked"; sectionId: string }
  | { type: "section-delete-confirmed" }
  | { type: "section-delete-cancelled" }
  // Add Lesson (13-16)
  | { type: "add-lesson-clicked"; sectionId: string }
  | { type: "new-lesson-title-changed"; value: string }
  | { type: "new-lesson-save-requested" }
  | { type: "new-lesson-cancel-requested" }
  // Edit Lesson (17-20)
  | { type: "lesson-title-clicked"; lessonId: string; sectionId: string }
  | { type: "lesson-title-changed"; value: string }
  | { type: "lesson-save-requested" }
  | { type: "lesson-cancel-requested" }
  // Delete Lesson (21)
  | { type: "lesson-delete-clicked"; sectionId: string; lessonId: string }
  | { type: "lesson-delete-confirmed" }
  | { type: "lesson-delete-cancelled" }
  // Lesson Description (22-25)
  | {
      type: "lesson-description-clicked";
      lessonId: string;
      sectionId: string;
    }
  | { type: "lesson-description-changed"; value: string }
  | { type: "lesson-description-save-requested" }
  | { type: "lesson-description-cancel-requested" }
  // Lesson Icon (26)
  | {
      type: "lesson-icon-changed";
      sectionId: string;
      lessonId: string;
      icon: Lesson["icon"];
    }
  // Lesson Status
  | {
      type: "lesson-status-toggled";
      sectionId: string;
      lessonId: string;
    }
  // Lesson Priority
  | {
      type: "lesson-priority-set";
      sectionId: string;
      lessonId: string;
      priority: LessonPriority;
    }
  // Lesson Dependencies (27)
  | {
      type: "lesson-dependencies-changed";
      sectionId: string;
      lessonId: string;
      dependencies: string[];
    }
  // Reordering (28-30)
  | { type: "section-reordered"; sectionId: string; newIndex: number }
  | {
      type: "lesson-reordered";
      fromSectionId: string;
      toSectionId: string;
      lessonId: string;
      newIndex: number;
    }
  // Sync (31-32)
  | { type: "sync-failed"; error: string }
  | { type: "sync-retry-requested" }
  // Focus (33)
  | { type: "focus-handled" }
  // Priority Filter (34)
  | { type: "priority-filter-toggled"; priority: LessonPriority }
  // Icon Filter (35)
  | { type: "icon-filter-toggled"; icon: LessonIcon };

export type PlanReducerEffect =
  | { type: "plan-changed" }
  | {
      type: "focus-element";
      target: { type: "add-lesson-button"; sectionId: string };
    };
