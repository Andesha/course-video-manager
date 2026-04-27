import { describe, expect, it, vi } from "vitest";
import { createLessonDragHandler } from "./course-editor-helpers";
import type { CourseEditorEvent } from "@/services/course-editor-service";
import type { DragEndEvent } from "@dnd-kit/core";

// Helper to create a fake DragEndEvent
function makeDragEndEvent(activeId: string, overId: string): DragEndEvent {
  return {
    active: {
      id: activeId,
      data: { current: undefined },
      rect: { current: { initial: null, translated: null } },
    },
    over: {
      id: overId,
      data: { current: undefined },
      rect: { left: 0, top: 0, bottom: 0, right: 0, width: 0, height: 0 },
    },
    activatorEvent: {} as Event,
    collisions: null,
    delta: { x: 0, y: 0 },
  } as unknown as DragEndEvent;
}

describe("createLessonDragHandler", () => {
  it("reorders when active/over IDs are databaseIds (pre-existing lessons)", () => {
    const submitEvent = vi.fn();
    const handler = createLessonDragHandler(submitEvent);

    const lessons = [
      { id: "db-1", frontendId: "db-1", path: "first", title: "First" },
      { id: "db-2", frontendId: "db-2", path: "second", title: "Second" },
      { id: "db-3", frontendId: "db-3", path: "third", title: "Third" },
    ];

    const dragEnd = handler("section-1", lessons);
    dragEnd(makeDragEndEvent("db-1", "db-3"));

    expect(submitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "reorder-lessons",
        sectionId: "section-1",
      })
    );
  });

  it("reorders when active/over IDs are frontendIds (reconciled lessons)", () => {
    const submitEvent = vi.fn();
    const handler = createLessonDragHandler(submitEvent);

    const lessons = [
      { id: "db-1", frontendId: "fe-1", path: "first", title: "First" },
      { id: "db-2", frontendId: "fe-2", path: "second", title: "Second" },
      { id: "db-3", frontendId: "fe-3", path: "third", title: "Third" },
    ];

    const dragEnd = handler("section-1", lessons);
    dragEnd(makeDragEndEvent("fe-1", "fe-3"));

    expect(submitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "reorder-lessons",
        sectionId: "section-1",
      })
    );
  });

  it("submits correct new lesson order when using frontendIds as drag IDs", () => {
    const submitEvent = vi.fn();
    const handler = createLessonDragHandler(submitEvent);

    const lessons = [
      { id: "db-1", frontendId: "fe-1", path: "first", title: "First" },
      { id: "db-2", frontendId: "fe-2", path: "second", title: "Second" },
      { id: "db-3", frontendId: "fe-3", path: "third", title: "Third" },
    ];

    // Drag "fe-1" to position of "fe-3" → results in [second, third, first]
    const dragEnd = handler("section-1", lessons);
    dragEnd(makeDragEndEvent("fe-1", "fe-3"));

    const event = submitEvent.mock.calls[0]![0] as CourseEditorEvent & {
      type: "reorder-lessons";
      lessonIds: string[];
    };
    expect(event.type).toBe("reorder-lessons");
    expect(event.lessonIds).toEqual(["db-2", "db-3", "db-1"]);
  });

  it("returns without submitting when active and over are the same", () => {
    const submitEvent = vi.fn();
    const handler = createLessonDragHandler(submitEvent);
    const lessons = [
      { id: "db-1", frontendId: "fe-1", path: "first", title: "First" },
    ];

    const dragEnd = handler("section-1", lessons);
    dragEnd(makeDragEndEvent("fe-1", "fe-1"));

    expect(submitEvent).not.toHaveBeenCalled();
  });

  it("returns without submitting when over is null", () => {
    const submitEvent = vi.fn();
    const handler = createLessonDragHandler(submitEvent);
    const lessons = [
      { id: "db-1", frontendId: "fe-1", path: "first", title: "First" },
    ];

    const dragEnd = handler("section-1", lessons);
    dragEnd({
      active: { id: "fe-1" },
      over: null,
      activatorEvent: {} as Event,
      collisions: null,
      delta: { x: 0, y: 0 },
    } as unknown as DragEndEvent);

    expect(submitEvent).not.toHaveBeenCalled();
  });

  it("returns without submitting when active ID is not found", () => {
    const submitEvent = vi.fn();
    const handler = createLessonDragHandler(submitEvent);
    const lessons = [
      { id: "db-1", frontendId: "fe-1", path: "first", title: "First" },
      { id: "db-2", frontendId: "fe-2", path: "second", title: "Second" },
    ];

    const dragEnd = handler("section-1", lessons);
    dragEnd(makeDragEndEvent("nonexistent", "fe-2"));

    expect(submitEvent).not.toHaveBeenCalled();
  });

  it("returns without submitting when over ID is not found", () => {
    const submitEvent = vi.fn();
    const handler = createLessonDragHandler(submitEvent);
    const lessons = [
      { id: "db-1", frontendId: "fe-1", path: "first", title: "First" },
    ];

    const dragEnd = handler("section-1", lessons);
    dragEnd(makeDragEndEvent("fe-1", "nonexistent"));

    expect(submitEvent).not.toHaveBeenCalled();
  });

  it("falls back to id when frontendId is omitted", () => {
    const submitEvent = vi.fn();
    const handler = createLessonDragHandler(submitEvent);
    const lessons = [
      { id: "db-1", path: "first", title: "First" },
      { id: "db-2", path: "second", title: "Second" },
    ];

    const dragEnd = handler("section-1", lessons);
    dragEnd(makeDragEndEvent("db-1", "db-2"));

    expect(submitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "reorder-lessons",
        lessonIds: ["db-2", "db-1"],
      })
    );
  });

  it("returns without submitting on empty lessons array", () => {
    const submitEvent = vi.fn();
    const handler = createLessonDragHandler(submitEvent);

    const dragEnd = handler("section-1", []);
    dragEnd(makeDragEndEvent("fe-1", "fe-2"));

    expect(submitEvent).not.toHaveBeenCalled();
  });
});
