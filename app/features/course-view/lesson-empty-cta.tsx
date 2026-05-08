import { Button } from "@/components/ui/button";
import { courseViewReducer } from "@/features/course-view/course-view-reducer";
import type { CourseEditorEvent } from "@/services/course-editor-service";
import type { Lesson } from "./course-view-types";
import { BookOpen, Plus } from "lucide-react";

export function LessonEmptyCTA(props: {
  lesson: Lesson;
  isGhost: boolean;
  isGhostCourse: boolean | undefined;
  dispatch: (action: courseViewReducer.Action) => void;
  submitEvent: (event: CourseEditorEvent) => void;
}) {
  const { lesson, isGhost, isGhostCourse, dispatch, submitEvent } = props;

  if (isGhost) {
    return (
      <div className="ml-5 mt-3 flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant="default"
          onClick={() => {
            if (isGhostCourse) {
              dispatch({
                type: "set-create-on-disk-lesson-id",
                lessonId: lesson.id,
              });
            } else {
              submitEvent({ type: "create-on-disk", lessonId: lesson.id });
            }
          }}
        >
          <BookOpen className="w-4 h-4 mr-1" />
          Create lesson on disk to start recording
        </Button>
        <span className="text-xs text-muted-foreground">
          This lesson is still a ghost, so it can't have videos yet.
        </span>
      </div>
    );
  }

  return (
    <div className="ml-5 mt-3 flex items-center gap-2 flex-wrap">
      <Button
        size="sm"
        onClick={() => {
          dispatch({ type: "set-add-video-to-lesson-id", lessonId: lesson.id });
        }}
      >
        <Plus className="w-4 h-4 mr-1" />
        {lesson.videos.length === 0
          ? "Start by adding a video"
          : "Add another video"}
      </Button>
      <span className="text-xs text-muted-foreground">
        {lesson.videos.length === 0
          ? "Then you'll be taken straight to the video editor to record clips."
          : "New videos open in the editor right away."}
      </span>
    </div>
  );
}
