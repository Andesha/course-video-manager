import type { CourseEditorEvent } from "@/services/course-editor-service";
import type { LoaderData, Lesson, Section } from "./course-view-types";

/**
 * Fetcher key convention: `course-editor:<event-type>:<entity-id>`.
 *
 * Two mutations on the same entity + event type share a key (only the
 * latest intent is visible); different entities get separate fetcher slots.
 */
export function courseEditorFetcherKey(
  eventType: string,
  entityId: string
): string {
  return `course-editor:${eventType}:${entityId}`;
}

export const COURSE_EDITOR_KEY_PREFIX = "course-editor:";

export function courseEditorFetcherKeyForEvent(
  event: CourseEditorEvent
): string {
  const id = entityIdForEvent(event);
  return courseEditorFetcherKey(event.type, id);
}

function entityIdForEvent(event: CourseEditorEvent): string {
  switch (event.type) {
    case "create-section":
      return event.repoVersionId;
    case "update-section-name":
    case "update-section-description":
    case "archive-section":
      return event.sectionId;
    case "reorder-sections":
      return "batch";
    case "reorder-lessons":
      return event.sectionId;
    case "add-ghost-lesson":
    case "create-real-lesson":
      return event.sectionId;
    case "update-lesson-name":
    case "update-lesson-title":
    case "update-lesson-description":
    case "update-lesson-icon":
    case "update-lesson-priority":
    case "update-lesson-dependencies":
    case "delete-lesson":
    case "move-lesson-to-section":
    case "convert-to-ghost":
    case "create-on-disk":
    case "set-lesson-authoring-status":
      return event.lessonId;
  }
}

export function applyOptimisticEvent(
  loaderData: LoaderData,
  event: CourseEditorEvent
): LoaderData {
  switch (event.type) {
    case "update-lesson-icon":
      return withPatchedLesson(loaderData, event.lessonId, () => ({
        icon: event.icon,
      }));
    case "update-lesson-title":
      return withPatchedLesson(loaderData, event.lessonId, () => ({
        title: event.title,
      }));
    case "update-lesson-name":
      return withPatchedLesson(loaderData, event.lessonId, (lesson) => ({
        path: replaceSlug(lesson.path, event.newSlug),
      }));
    case "update-lesson-description":
      return withPatchedLesson(loaderData, event.lessonId, () => ({
        description: event.description,
      }));
    case "update-lesson-priority":
      return withPatchedLesson(loaderData, event.lessonId, () => ({
        priority: event.priority,
      }));
    case "update-lesson-dependencies":
      return withPatchedLesson(loaderData, event.lessonId, () => ({
        dependencies: event.dependencies,
      }));
    case "set-lesson-authoring-status":
      return withPatchedLesson(loaderData, event.lessonId, () => ({
        authoringStatus: event.status,
      }));
    case "update-section-name":
      return withPatchedSection(loaderData, event.sectionId, (section) => ({
        path: replaceSlug(section.path, event.title),
      }));
    case "update-section-description":
      return withPatchedSection(loaderData, event.sectionId, () => ({
        description: event.description,
      }));
    default:
      return loaderData;
  }
}

function replaceSlug(path: string, newSlug: string): string {
  const match = path.match(/^(\d[\d.]*-)/);
  return match ? match[1] + newSlug : newSlug;
}

function withPatchedLesson(
  loaderData: LoaderData,
  lessonId: string,
  patchFn: (lesson: Lesson) => Partial<Lesson>
): LoaderData {
  const course = loaderData.selectedCourse;
  if (!course) return loaderData;

  let found = false;
  const sections = course.sections.map((section) => {
    if (found) return section;
    let sectionChanged = false;
    const lessons = section.lessons.map((lesson) => {
      if (lesson.id === lessonId) {
        found = true;
        sectionChanged = true;
        return { ...lesson, ...patchFn(lesson) };
      }
      return lesson;
    });
    return sectionChanged ? { ...section, lessons } : section;
  });

  if (!found) return loaderData;

  return {
    ...loaderData,
    selectedCourse: { ...course, sections },
  };
}

function withPatchedSection(
  loaderData: LoaderData,
  sectionId: string,
  patchFn: (section: Section) => Partial<Section>
): LoaderData {
  const course = loaderData.selectedCourse;
  if (!course) return loaderData;

  let found = false;
  const sections = course.sections.map((section) => {
    if (section.id === sectionId) {
      found = true;
      return { ...section, ...patchFn(section) };
    }
    return section;
  });

  if (!found) return loaderData;

  return {
    ...loaderData,
    selectedCourse: { ...course, sections },
  };
}
