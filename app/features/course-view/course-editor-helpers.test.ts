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
  it("reorders lessons and submits the new order", () => {
    const submitEvent = vi.fn();
    const handler = createLessonDragHandler(submitEvent);

    const lessons = [
      { id: "db-1", path: "first", title: "First" },
      { id: "db-2", path: "second", title: "Second" },
      { id: "db-3", path: "third", title: "Third" },
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

  it("submits correct new lesson order after drag", () => {
    const submitEvent = vi.fn();
    const handler = createLessonDragHandler(submitEvent);

    const lessons = [
      { id: "db-1", path: "first", title: "First" },
      { id: "db-2", path: "second", title: "Second" },
      { id: "db-3", path: "third", title: "Third" },
    ];

    // Drag "db-1" to position of "db-3" → results in [second, third, first]
    const dragEnd = handler("section-1", lessons);
    dragEnd(makeDragEndEvent("db-1", "db-3"));

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
    const lessons = [{ id: "db-1", path: "first", title: "First" }];

    const dragEnd = handler("section-1", lessons);
    dragEnd(makeDragEndEvent("db-1", "db-1"));

    expect(submitEvent).not.toHaveBeenCalled();
  });

  it("returns without submitting when over is null", () => {
    const submitEvent = vi.fn();
    const handler = createLessonDragHandler(submitEvent);
    const lessons = [{ id: "db-1", path: "first", title: "First" }];

    const dragEnd = handler("section-1", lessons);
    dragEnd({
      active: { id: "db-1" },
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
      { id: "db-1", path: "first", title: "First" },
      { id: "db-2", path: "second", title: "Second" },
    ];

    const dragEnd = handler("section-1", lessons);
    dragEnd(makeDragEndEvent("nonexistent", "db-2"));

    expect(submitEvent).not.toHaveBeenCalled();
  });

  it("returns without submitting when over ID is not found", () => {
    const submitEvent = vi.fn();
    const handler = createLessonDragHandler(submitEvent);
    const lessons = [{ id: "db-1", path: "first", title: "First" }];

    const dragEnd = handler("section-1", lessons);
    dragEnd(makeDragEndEvent("db-1", "nonexistent"));

    expect(submitEvent).not.toHaveBeenCalled();
  });

  it("returns without submitting on empty lessons array", () => {
    const submitEvent = vi.fn();
    const handler = createLessonDragHandler(submitEvent);

    const dragEnd = handler("section-1", []);
    dragEnd(makeDragEndEvent("db-1", "db-2"));

    expect(submitEvent).not.toHaveBeenCalled();
  });

  it("handles two-element reorder correctly", () => {
    const submitEvent = vi.fn();
    const handler = createLessonDragHandler(submitEvent);

    const lessons = [
      { id: "a", path: "first", title: "First" },
      { id: "b", path: "second", title: "Second" },
    ];

    const dragEnd = handler("section-1", lessons);
    dragEnd(makeDragEndEvent("a", "b"));

    const event = submitEvent.mock.calls[0]![0] as CourseEditorEvent & {
      type: "reorder-lessons";
      lessonIds: string[];
    };
    expect(event.lessonIds).toEqual(["b", "a"]);
  });

  it("handles dragging last element to first position", () => {
    const submitEvent = vi.fn();
    const handler = createLessonDragHandler(submitEvent);

    const lessons = [
      { id: "a", path: "first", title: "First" },
      { id: "b", path: "second", title: "Second" },
      { id: "c", path: "third", title: "Third" },
    ];

    const dragEnd = handler("section-1", lessons);
    dragEnd(makeDragEndEvent("c", "a"));

    const event = submitEvent.mock.calls[0]![0] as CourseEditorEvent & {
      type: "reorder-lessons";
      lessonIds: string[];
    };
    expect(event.lessonIds).toEqual(["c", "a", "b"]);
  });
});
