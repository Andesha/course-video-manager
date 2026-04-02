import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { Lesson, Section } from "@/features/course-view/course-view-types";
import {
  buildCourseTranscript,
  buildSectionTranscript,
  type TranscriptOptions,
} from "@/features/course-view/section-transcript";
import { ClipboardCopy } from "lucide-react";
import { use, useMemo, useState } from "react";
import { toast } from "sonner";

type CourseMode = {
  mode: "course";
  courseName: string;
  sections: Section[];
};

type SectionMode = {
  mode: "section";
  sectionPath: string;
  sectionDescription?: string;
  lessons: Lesson[];
};

export function CopyTranscriptModal(
  props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    videoTranscripts: Promise<Record<string, string>>;
  } & (CourseMode | SectionMode)
) {
  const [options, setOptions] = useState<TranscriptOptions>({
    includeTranscripts: false,
    includeLessonDescriptions: true,
    includeLessonTitles: true,
    includePriority: false,
    includeExerciseType: false,
    includeSectionDescription: false,
  });

  const resolvedTranscripts = use(props.videoTranscripts);

  const preview = useMemo(() => {
    if (props.mode === "course") {
      return buildCourseTranscript(
        props.courseName,
        props.sections,
        options,
        resolvedTranscripts
      );
    }
    return buildSectionTranscript(
      props.sectionPath,
      props.lessons,
      options,
      resolvedTranscripts,
      props.sectionDescription
    );
  }, [props, options, resolvedTranscripts]);

  const byteCount = new TextEncoder().encode(preview).length;
  const approxTokens = Math.ceil(byteCount / 4);

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000) {
      return `~${(tokens / 1000).toFixed(1)}k tokens`;
    }
    return `~${tokens} tokens`;
  };

  const isCourse = props.mode === "course";
  const label = isCourse ? "Course" : "Section";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(preview);
      toast(`${label} transcript copied to clipboard`);
      props.onOpenChange(false);
    } catch {
      toast.error("Failed to copy transcript to clipboard");
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copy {label} Transcript</DialogTitle>
          <DialogDescription>
            Choose what to include in the exported transcript.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="include-section-description"
                checked={options.includeSectionDescription}
                onCheckedChange={(checked) =>
                  setOptions((o) => ({
                    ...o,
                    includeSectionDescription: checked === true,
                  }))
                }
              />
              <Label
                htmlFor="include-section-description"
                className="cursor-pointer"
              >
                Section description
              </Label>
              <span className="text-xs text-muted-foreground">
                Section-level description
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="include-lesson-titles"
                checked={options.includeLessonTitles}
                onCheckedChange={(checked) =>
                  setOptions((o) => ({
                    ...o,
                    includeLessonTitles: checked === true,
                  }))
                }
              />
              <Label htmlFor="include-lesson-titles" className="cursor-pointer">
                Lesson titles
              </Label>
              <span className="text-xs text-muted-foreground">
                Human-readable lesson names
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="include-lesson-descriptions"
                checked={options.includeLessonDescriptions}
                onCheckedChange={(checked) =>
                  setOptions((o) => ({
                    ...o,
                    includeLessonDescriptions: checked === true,
                  }))
                }
              />
              <Label
                htmlFor="include-lesson-descriptions"
                className="cursor-pointer"
              >
                Lesson descriptions
              </Label>
              <span className="text-xs text-muted-foreground">
                Description metadata
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="include-transcripts"
                checked={options.includeTranscripts}
                onCheckedChange={(checked) =>
                  setOptions((o) => ({
                    ...o,
                    includeTranscripts: checked === true,
                  }))
                }
              />
              <Label htmlFor="include-transcripts" className="cursor-pointer">
                Transcripts
              </Label>
              <span className="text-xs text-muted-foreground">
                Clip text content
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="include-priority"
                checked={options.includePriority}
                onCheckedChange={(checked) =>
                  setOptions((o) => ({
                    ...o,
                    includePriority: checked === true,
                  }))
                }
              />
              <Label htmlFor="include-priority" className="cursor-pointer">
                Priority
              </Label>
              <span className="text-xs text-muted-foreground">
                P1, P2, P3 labels
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="include-exercise-type"
                checked={options.includeExerciseType}
                onCheckedChange={(checked) =>
                  setOptions((o) => ({
                    ...o,
                    includeExerciseType: checked === true,
                  }))
                }
              />
              <Label htmlFor="include-exercise-type" className="cursor-pointer">
                Exercise type
              </Label>
              <span className="text-xs text-muted-foreground">
                Watch, code, or discussion
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
            <span className="text-muted-foreground">Estimated size</span>
            <span className="font-medium">{formatTokens(approxTokens)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCopy}>
            <ClipboardCopy className="w-4 h-4 mr-1" />
            Copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
