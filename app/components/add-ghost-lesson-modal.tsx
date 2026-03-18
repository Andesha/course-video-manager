import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { capitalizeTitle } from "@/utils/capitalize-title";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

export function AddGhostLessonModal(props: {
  sectionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fetcher?: ReturnType<typeof useFetcher>;
  adjacentLessonId?: string | null;
  position?: "before" | "after" | null;
  mode?: "ghost" | "real";
  courseFilePath?: string | null;
}) {
  const internalFetcher = useFetcher();
  const fetcher = props.fetcher ?? internalFetcher;
  const [title, setTitle] = useState("");
  const [filePath, setFilePath] = useState("");
  const wasSubmitting = useRef(false);

  // Close modal when fetcher completes successfully
  useEffect(() => {
    if (fetcher.state === "submitting" || fetcher.state === "loading") {
      wasSubmitting.current = true;
    }
    if (wasSubmitting.current && fetcher.state === "idle") {
      wasSubmitting.current = false;
      setTitle("");
      setFilePath("");
      props.onOpenChange(false);
    }
  }, [fetcher.state, props.onOpenChange]);
  const isReal = props.mode === "real";
  const isGhostCourse = isReal && !props.courseFilePath;
  const isValid =
    title.trim().length > 0 && (!isGhostCourse || filePath.trim().length > 0);
  const actionUrl = isReal
    ? "/api/lessons/create-real"
    : "/api/lessons/add-ghost";

  const dialogTitle = isReal
    ? isGhostCourse
      ? "Materialize Course & Create Lesson"
      : props.position === "before"
        ? "Create Real Lesson Before"
        : props.position === "after"
          ? "Create Real Lesson After"
          : "Create Real Lesson"
    : props.position === "before"
      ? "Add Ghost Lesson Before"
      : props.position === "after"
        ? "Add Ghost Lesson After"
        : "Add Ghost Lesson";

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open) {
          setTitle("");
          setFilePath("");
        }
        props.onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <fetcher.Form
          method="post"
          action={actionUrl}
          className="space-y-4 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!isValid) return;
            const formData = new FormData(e.currentTarget);
            formData.set("title", capitalizeTitle(title.trim()));
            if (isGhostCourse) {
              formData.set("filePath", filePath.trim());
            }
            fetcher.submit(formData, {
              method: "post",
              action: actionUrl,
            });
          }}
        >
          <input type="hidden" name="sectionId" value={props.sectionId} />
          {props.adjacentLessonId && (
            <input
              type="hidden"
              name="adjacentLessonId"
              value={props.adjacentLessonId}
            />
          )}
          {props.position && (
            <input type="hidden" name="position" value={props.position} />
          )}
          {isGhostCourse && (
            <div className="space-y-2">
              <Label htmlFor="course-file-path">Course File Path</Label>
              <Input
                id="course-file-path"
                name="filePath"
                placeholder="e.g. /path/to/existing/directory"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Must point to an existing directory. This will permanently assign
                a file path to the course.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="ghost-lesson-title">Title</Label>
            <Input
              id="ghost-lesson-title"
              name="title"
              placeholder="e.g. Understanding Generics"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus={!isGhostCourse}
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                setTitle("");
                setFilePath("");
                props.onOpenChange(false);
              }}
              type="button"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || fetcher.state !== "idle"}>
              {fetcher.state !== "idle" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isGhostCourse ? (
                "Materialize & Create"
              ) : isReal ? (
                "Create Lesson"
              ) : (
                "Add Lesson"
              )}
            </Button>
          </div>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}
