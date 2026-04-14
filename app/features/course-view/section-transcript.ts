import type { Lesson, Section } from "./course-view-types";
import { filterLessons } from "./section-grid-utils";

export type TranscriptOptions = {
  includeTranscripts: boolean;
  includeLessonDescriptions: boolean;
  includeLessonTitles: boolean;
  includePriority: boolean;
  includeExerciseType: boolean;
  includeSectionDescription: boolean;
};

const defaultOptions: TranscriptOptions = {
  includeTranscripts: false,
  includeLessonDescriptions: true,
  includeLessonTitles: true,
  includePriority: false,
  includeExerciseType: false,
  includeSectionDescription: false,
};

export function buildCourseTranscript(
  coursePath: string,
  sections: Section[],
  options: TranscriptOptions = defaultOptions,
  videoTranscripts: Record<string, string> = {}
) {
  const lines: string[] = [`<course title="${escapeAttr(coursePath)}">`];
  for (const section of sections) {
    const sectionLines = buildSectionTranscript(
      section.path,
      section.lessons,
      options,
      videoTranscripts,
      section.description ?? undefined
    );
    // Indent each line of the section transcript by 2 spaces
    for (const line of sectionLines.split("\n")) {
      lines.push(`  ${line}`);
    }
  }
  lines.push("</course>");
  return lines.join("\n");
}

export function buildSectionTranscript(
  sectionPath: string,
  lessons: Lesson[],
  options: TranscriptOptions = defaultOptions,
  videoTranscripts: Record<string, string> = {},
  sectionDescription?: string
) {
  const lines: string[] = [`<section title="${escapeAttr(sectionPath)}">`];
  if (options.includeSectionDescription && sectionDescription) {
    lines.push(
      `  <description>${escapeAttr(sectionDescription)}</description>`
    );
  }
  for (const lesson of lessons) {
    const lessonAttrs = [
      `title="${escapeAttr(lesson.path)}"`,
      ...(options.includeLessonTitles && lesson.title
        ? [`name="${escapeAttr(lesson.title)}"`]
        : []),
      ...(options.includePriority
        ? [`priority="p${lesson.priority ?? 2}"`]
        : []),
      ...(options.includeExerciseType && lesson.icon
        ? [`type="${escapeAttr(lesson.icon)}"`]
        : []),
    ].join(" ");
    lines.push(`  <lesson ${lessonAttrs}>`);
    if (options.includeLessonDescriptions && lesson.description) {
      lines.push(
        `    <description>${escapeAttr(lesson.description)}</description>`
      );
    }
    if (lesson.videos.length === 0) {
      lines.push("    (no videos)");
      lines.push("  </lesson>");
      continue;
    }
    for (const video of lesson.videos) {
      lines.push(`    <video title="${escapeAttr(video.path)}">`);
      if (options.includeTranscripts) {
        if (video.clipCount === 0) {
          lines.push("      (no clips)");
          lines.push("    </video>");
          continue;
        }
        const transcript = videoTranscripts[video.id];
        lines.push(`      ${transcript || "(no transcript)"}`);
      }
      lines.push("    </video>");
    }
    lines.push("  </lesson>");
  }
  lines.push("</section>");
  return lines.join("\n");
}

export type TranscriptFilterOptions = {
  priorityFilter: number[];
  iconFilter: string[];
  fsStatusFilter: string | null;
  searchQuery: string;
};

export function filterSectionsForTranscript(
  sections: Section[],
  filters: TranscriptFilterOptions
): Section[] {
  return sections
    .map((section) => {
      const { filteredLessons } = filterLessons(section.lessons, filters);
      return { ...section, lessons: filteredLessons } as Section;
    })
    .filter((section) => section.lessons.length > 0);
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
