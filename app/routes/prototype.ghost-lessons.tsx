import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { Ghost, Plus } from "lucide-react";
import { useState, useCallback, useReducer } from "react";
import type { Lesson } from "@/features/ghost-lessons/ghost-lessons-reducer";
import {
  INITIAL_SECTIONS,
  sectionsReducer,
  flattenLessons,
  sectionIsGhost,
} from "@/features/ghost-lessons/ghost-lessons-reducer";
import {
  AddGhostLessonModal,
  AddGhostSectionModal,
} from "@/features/ghost-lessons/ghost-lessons-components";
import { SortableLessonItem } from "@/features/ghost-lessons/ghost-lessons-sortable-lesson";

export default function GhostLessonsPrototype() {
  const [sections, dispatch] = useReducer(sectionsReducer, INITIAL_SECTIONS);
  const [addGhostSectionId, setAddGhostSectionId] = useState<string | null>(
    null
  );
  const [showAddSection, setShowAddSection] = useState(false);

  const allFlatLessons = flattenLessons(sections);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (sectionId: string, lessons: Lesson[]) => (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = lessons.findIndex((l) => l.id === active.id);
      const newIndex = lessons.findIndex((l) => l.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const newOrder = arrayMove(
        lessons.map((l) => l.id),
        oldIndex,
        newIndex
      );
      dispatch({ type: "reorder-lessons", sectionId, lessonIds: newOrder });
    },
    []
  );

  const sortedSections = [...sections].sort((a, b) => a.order - b.order);

  // Stats
  const totalLessons = sections.reduce((acc, s) => acc + s.lessons.length, 0);
  const ghostCount = sections.reduce(
    (acc, s) => acc + s.lessons.filter((l) => l.fsStatus === "ghost").length,
    0
  );
  const realCount = totalLessons - ghostCount;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold">
              TypeScript Pro Essentials
              <span className="text-sm font-normal text-muted-foreground ml-3">
                prototype / ghost lessons
              </span>
            </h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddSection(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Section
            </Button>
          </div>
          <div className="flex gap-3 text-sm text-muted-foreground">
            <span>{totalLessons} lessons</span>
            <span>
              <span className="text-foreground font-medium">{realCount}</span>{" "}
              real
            </span>
            <span>
              <span className="text-foreground font-medium">{ghostCount}</span>{" "}
              ghost
            </span>
          </div>
        </div>

        <div className="space-y-6">
          {/* Main course structure */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {sortedSections.map((section) => {
              const isGhostSection = sectionIsGhost(section);
              const sortedLessons = [...section.lessons].sort(
                (a, b) => a.order - b.order
              );

              return (
                <div key={section.id} className="rounded-lg border bg-card">
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div className="px-4 py-3 border-b bg-muted/30 cursor-context-menu">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h2
                              className={cn(
                                "font-medium text-sm",
                                isGhostSection &&
                                  "text-muted-foreground/70 italic"
                              )}
                            >
                              {section.title}
                            </h2>
                            {isGhostSection && (
                              <Ghost className="w-3.5 h-3.5 text-muted-foreground/40" />
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px]">
                              {
                                section.lessons.filter(
                                  (l) => l.fsStatus === "real"
                                ).length
                              }
                              /{section.lessons.length}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem
                        onSelect={() => setAddGhostSectionId(section.id)}
                      >
                        <Ghost className="w-4 h-4" />
                        Add Ghost Lesson
                      </ContextMenuItem>
                      <ContextMenuItem
                        onSelect={() => setAddGhostSectionId(section.id)}
                      >
                        <Plus className="w-4 h-4" />
                        Add Lesson
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                  <AddGhostLessonModal
                    sectionId={section.id}
                    open={addGhostSectionId === section.id}
                    onOpenChange={(open) =>
                      setAddGhostSectionId(open ? section.id : null)
                    }
                    dispatch={dispatch}
                  />
                  <div className="p-2">
                    {sortedLessons.length === 0 ? (
                      <div className="py-6 text-center">
                        <Ghost className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                        <p className="text-xs text-muted-foreground/50">
                          Empty section
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 text-xs"
                          onClick={() => setAddGhostSectionId(section.id)}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add ghost lesson
                        </Button>
                      </div>
                    ) : (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd(section.id, sortedLessons)}
                      >
                        <SortableContext
                          items={sortedLessons.map((l) => l.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {sortedLessons.map((lesson, li) => (
                            <SortableLessonItem
                              key={lesson.id}
                              lesson={lesson}
                              lessonIndex={li}
                              section={section}
                              allFlatLessons={allFlatLessons}
                              dispatch={dispatch}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <AddGhostSectionModal
          open={showAddSection}
          onOpenChange={setShowAddSection}
          dispatch={dispatch}
        />
      </div>
    </div>
  );
}
