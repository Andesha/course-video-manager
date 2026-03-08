import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Code,
  Ghost,
  Link2,
  MessageCircle,
  Play,
} from "lucide-react";
import { useState } from "react";
import type {
  FsStatus,
  LessonIcon,
  LessonPriority,
  FlatLesson,
  Action,
} from "./ghost-lessons-reducer";

// ─── Badge Components ───────────────────────────────────────────────────────

export function LessonIconBadge({
  icon,
  fsStatus,
  onClick,
}: {
  icon: LessonIcon;
  fsStatus: FsStatus;
  onClick: () => void;
}) {
  const colors =
    icon === "code"
      ? "bg-yellow-500/20 text-yellow-600"
      : icon === "discussion"
        ? "bg-green-500/20 text-green-600"
        : "bg-purple-500/20 text-purple-600";

  return (
    <button
      className={cn(
        "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center",
        colors,
        fsStatus === "ghost" && "opacity-50"
      )}
      onClick={onClick}
      title={
        icon === "code"
          ? "Interactive (click to change)"
          : icon === "discussion"
            ? "Discussion (click to change)"
            : "Watch (click to change)"
      }
    >
      {icon === "code" ? (
        <Code className="w-3.5 h-3.5" />
      ) : icon === "discussion" ? (
        <MessageCircle className="w-3.5 h-3.5" />
      ) : (
        <Play className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

export function PriorityBadge({
  priority,
  onClick,
}: {
  priority: LessonPriority;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex-shrink-0 text-xs px-2 py-0.5 rounded-sm font-medium",
        priority === 1
          ? "bg-red-500/20 text-red-600"
          : priority === 3
            ? "bg-sky-500/20 text-sky-500"
            : "bg-yellow-500/20 text-yellow-600"
      )}
      onClick={onClick}
      title="Click to toggle priority (P1 > P2 > P3)"
    >
      P{priority}
    </button>
  );
}

export function FsStatusBadge({ fsStatus }: { fsStatus: FsStatus }) {
  if (fsStatus === "real") return null;
  return (
    <span className="flex items-center text-muted-foreground/60">
      <Ghost className="w-3 h-3" />
    </span>
  );
}

// ─── Dependency Selector (inline) ───────────────────────────────────────────

export function InlineDependencySelector({
  lessonId,
  dependencies,
  allLessons,
  violations,
  onDependenciesChange,
}: {
  lessonId: string;
  dependencies: string[];
  allLessons: FlatLesson[];
  violations: FlatLesson[];
  onDependenciesChange: (deps: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const hasViolation = violations.length > 0;
  const hasDeps = dependencies.length > 0;

  const toggle = (id: string) => {
    if (dependencies.includes(id)) {
      onDependenciesChange(dependencies.filter((d) => d !== id));
    } else {
      onDependenciesChange([...dependencies, id]);
    }
  };

  const sections = allLessons.reduce<
    Map<string, { title: string; number: number; lessons: FlatLesson[] }>
  >((acc, lesson) => {
    if (lesson.id === lessonId) return acc;
    if (
      search &&
      !lesson.title.toLowerCase().includes(search.toLowerCase()) &&
      !lesson.number.includes(search)
    )
      return acc;
    if (!acc.has(lesson.sectionId)) {
      acc.set(lesson.sectionId, {
        title: lesson.sectionTitle,
        number: lesson.sectionNumber,
        lessons: [],
      });
    }
    acc.get(lesson.sectionId)!.lessons.push(lesson);
    return acc;
  }, new Map());

  return (
    <div className="relative">
      <button
        className={cn(
          "text-xs flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted",
          hasViolation
            ? "bg-amber-500/20 text-amber-600"
            : "text-muted-foreground hover:text-foreground"
        )}
        title={
          hasViolation
            ? `Order violation: depends on later lessons (${violations.map((v) => v.number).join(", ")})`
            : undefined
        }
        onClick={() => setOpen(!open)}
      >
        <Link2 className="w-3 h-3" />
        {hasDeps && (
          <>
            {dependencies
              .map((id) => allLessons.find((l) => l.id === id)?.number)
              .filter(Boolean)
              .join(", ")}
            {hasViolation && <AlertTriangle className="w-3 h-3" />}
          </>
        )}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-popover border rounded-md shadow-md z-50">
          <div className="p-2 border-b">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lessons..."
              className="h-8 text-sm"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-[300px] p-1">
            {Array.from(sections.entries()).map(([sectionId, section]) => (
              <div key={sectionId}>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {section.number}. {section.title}
                </div>
                {section.lessons.map((l) => (
                  <label
                    key={l.id}
                    className="flex items-center gap-2 px-2 pl-4 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={dependencies.includes(l.id)}
                      onCheckedChange={() => toggle(l.id)}
                    />
                    <span className="text-muted-foreground w-7 text-right shrink-0">
                      {l.number}
                    </span>
                    <span className="truncate">{l.title}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Modals ─────────────────────────────────────────────────────────────────

export function AddGhostLessonModal({
  sectionId,
  open,
  onOpenChange,
  dispatch,
}: {
  sectionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dispatch: React.Dispatch<Action>;
}) {
  const [title, setTitle] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Ghost Lesson</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            dispatch({
              type: "add-ghost-lesson",
              sectionId,
              title: title.trim(),
            });
            setTitle("");
            onOpenChange(false);
          }}
        >
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Understanding Generics"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setTitle("");
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              <Ghost className="w-4 h-4 mr-2" />
              Add Ghost Lesson
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddGhostSectionModal({
  open,
  onOpenChange,
  dispatch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dispatch: React.Dispatch<Action>;
}) {
  const [title, setTitle] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Section</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            dispatch({ type: "add-ghost-section", title: title.trim() });
            setTitle("");
            onOpenChange(false);
          }}
        >
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. 04-generics"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setTitle("");
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              Add Section
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
