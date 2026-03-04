"use client";

import { DBFunctionsService } from "@/services/db-service.server";
import { sortByOrder } from "@/lib/sort-by-order";
import { runtimeLive } from "@/services/layer.server";
import type { SectionWithWordCount } from "@/features/article-writer/types";
import { Array as EffectArray, Console, Effect } from "effect";
import { useEffect, useRef, useState } from "react";
import { data, useFetcher } from "react-router";
import { toast } from "sonner";
import {
  VideoContextPanel,
  type CourseStructure,
} from "@/components/video-context-panel";
import {
  ALWAYS_EXCLUDED_DIRECTORIES,
  DEFAULT_CHECKED_EXTENSIONS,
  DEFAULT_UNCHECKED_PATHS,
} from "@/services/text-writing-agent";
import { getStandaloneVideoFilePath } from "@/services/standalone-video-files";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FilePreviewModal } from "@/components/file-preview-modal";
import { AddLinkModal } from "@/components/add-link-modal";
import { StandaloneFileManagementModal } from "@/components/standalone-file-management-modal";
import { StandaloneFilePasteModal } from "@/components/standalone-file-paste-modal";
import { DeleteStandaloneFileModal } from "@/components/delete-standalone-file-modal";
import { LessonFilePasteModal } from "@/components/lesson-file-paste-modal";
import { Loader2Icon, SparklesIcon, CopyIcon, LinkIcon } from "lucide-react";
import type { Route } from "./+types/videos.$videoId.social";
import path from "path";
import { FileSystem } from "@effect/platform";

const SOCIAL_CAPTION_STORAGE_KEY = (videoId: string) =>
  `social-caption-${videoId}`;

export const loader = async (args: Route.LoaderArgs) => {
  const { videoId } = args.params;
  return Effect.gen(function* () {
    const db = yield* DBFunctionsService;
    const fs = yield* FileSystem.FileSystem;
    const video = yield* db.getVideoWithClipsById(videoId);

    const globalLinks = yield* db.getLinks();

    const lesson = video.lesson;

    // Build transcript from clips and clip sections
    type ClipItem = { type: "clip"; order: string; text: string | null };
    type ClipSectionItem = {
      type: "clip-section";
      order: string;
      name: string;
    };

    const clipItems: ClipItem[] = video.clips.map((clip) => ({
      type: "clip" as const,
      order: clip.order,
      text: clip.text,
    }));

    const clipSectionItems: ClipSectionItem[] = video.clipSections.map(
      (section) => ({
        type: "clip-section" as const,
        order: section.order,
        name: section.name,
      })
    );

    const sortedItems = sortByOrder([...clipItems, ...clipSectionItems]);

    // Build formatted transcript with sections as H2 headers
    const transcriptParts: string[] = [];
    let currentParagraph: string[] = [];

    for (const item of sortedItems) {
      if (item.type === "clip-section") {
        if (currentParagraph.length > 0) {
          transcriptParts.push(currentParagraph.join(" "));
          currentParagraph = [];
        }
        transcriptParts.push(`## ${item.name}`);
      } else if (item.text) {
        currentParagraph.push(item.text);
      }
    }

    if (currentParagraph.length > 0) {
      transcriptParts.push(currentParagraph.join(" "));
    }

    const transcript = transcriptParts.join("\n\n").trim();
    const transcriptWordCount = transcript ? transcript.split(/\s+/).length : 0;

    // Calculate word count per section
    const sectionsWithWordCount: SectionWithWordCount[] = [];
    let currentSectionIndex = -1;

    for (const item of sortedItems) {
      if (item.type === "clip-section") {
        const section = video.clipSections.find((s) => s.order === item.order);
        if (section) {
          currentSectionIndex = sectionsWithWordCount.length;
          sectionsWithWordCount.push({
            id: section.id,
            name: item.name,
            order: item.order,
            wordCount: 0,
          });
        }
      } else if (item.text && currentSectionIndex >= 0) {
        const wordCount = item.text.split(/\s+/).length;
        sectionsWithWordCount[currentSectionIndex]!.wordCount += wordCount;
      }
    }

    // For standalone videos (no lesson), fetch standalone video files
    if (!lesson) {
      const standaloneVideoDir = getStandaloneVideoFilePath(videoId);
      const dirExists = yield* fs.exists(standaloneVideoDir);

      let standaloneFiles: Array<{
        path: string;
        size: number;
        defaultEnabled: boolean;
      }> = [];

      if (dirExists) {
        const filesInDirectory = yield* fs.readDirectory(standaloneVideoDir);

        standaloneFiles = yield* Effect.forEach(
          filesInDirectory,
          (filename) => {
            return Effect.gen(function* () {
              const filePath = getStandaloneVideoFilePath(videoId, filename);
              const stat = yield* fs.stat(filePath);

              if (stat.type !== "File") {
                return null;
              }

              const extension = path.extname(filename).slice(1);
              const defaultEnabled =
                DEFAULT_CHECKED_EXTENSIONS.includes(extension);

              return {
                path: filename,
                size: Number(stat.size),
                defaultEnabled,
              };
            });
          }
        ).pipe(Effect.map(EffectArray.filter((f) => f !== null)));
      }

      return {
        videoPath: video.path,
        files: standaloneFiles,
        isStandalone: true,
        transcriptWordCount,
        clipSections: sectionsWithWordCount,
        links: globalLinks,
        courseStructure: null as CourseStructure | null,
      };
    }

    const repo = lesson.section.repoVersion.repo;
    const section = lesson.section;

    const lessonPath = path.join(repo.filePath, section.path, lesson.path);

    const allFilesInDirectory = yield* fs
      .readDirectory(lessonPath, {
        recursive: true,
      })
      .pipe(
        Effect.map((files) => files.map((file) => path.join(lessonPath, file)))
      );

    const filteredFiles = allFilesInDirectory.filter((filePath) => {
      return !ALWAYS_EXCLUDED_DIRECTORIES.some((excludedDir) =>
        filePath.includes(excludedDir)
      );
    });

    const filesWithMetadata = yield* Effect.forEach(
      filteredFiles,
      (filePath) => {
        return Effect.gen(function* () {
          const stat = yield* fs.stat(filePath);

          if (stat.type !== "File") {
            return null;
          }

          const relativePath = path.relative(lessonPath, filePath);
          const extension = path.extname(filePath).slice(1);

          const defaultEnabled =
            DEFAULT_CHECKED_EXTENSIONS.includes(extension) &&
            !DEFAULT_UNCHECKED_PATHS.some((uncheckedPath) =>
              relativePath.toLowerCase().includes(uncheckedPath.toLowerCase())
            );

          return {
            path: relativePath,
            size: Number(stat.size),
            defaultEnabled,
          };
        });
      }
    ).pipe(Effect.map(EffectArray.filter((f) => f !== null)));

    // Fetch course structure for non-standalone videos
    const repoWithSections = yield* db.getRepoWithSectionsById(
      section.repoVersion.repoId
    );
    const matchingVersion = repoWithSections?.versions.find(
      (v) => v.id === section.repoVersion.id
    );
    const courseStructure: CourseStructure | null = matchingVersion
      ? {
          repoName: repoWithSections!.name,
          currentSectionPath: section.path,
          currentLessonPath: lesson.path,
          sections: matchingVersion.sections.map((s) => ({
            path: s.path,
            lessons: s.lessons.map((l) => ({ path: l.path })),
          })),
        }
      : null;

    return {
      videoPath: video.path,
      files: filesWithMetadata,
      isStandalone: false,
      transcriptWordCount,
      clipSections: sectionsWithWordCount,
      links: globalLinks,
      courseStructure,
    };
  }).pipe(
    Effect.tapErrorCause((e) => Console.dir(e, { depth: null })),
    Effect.catchTag("NotFoundError", () => {
      return Effect.die(data("Video not found", { status: 404 }));
    }),
    Effect.catchAll(() => {
      return Effect.die(data("Internal server error", { status: 500 }));
    }),
    runtimeLive.runPromise
  );
};

const Video = (props: { src: string }) => {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.playbackRate = 1;
    }
  }, [props.src, ref.current]);

  return <video src={props.src} className="w-full" controls ref={ref} />;
};

export default function SocialPage(props: Route.ComponentProps) {
  const { videoId } = props.params;
  const {
    files,
    isStandalone,
    transcriptWordCount,
    clipSections,
    links,
    courseStructure,
  } = props.loaderData;

  // Context panel state
  const [enabledFiles, setEnabledFiles] = useState<Set<string>>(() => {
    return new Set(files.filter((f) => f.defaultEnabled).map((f) => f.path));
  });
  const [includeTranscript, setIncludeTranscript] = useState(true);
  const [enabledSections, setEnabledSections] = useState<Set<string>>(() => {
    return new Set(clipSections.map((s) => s.id));
  });
  const [includeCourseStructure, setIncludeCourseStructure] = useState(false);

  // File preview modal state
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewFilePath, setPreviewFilePath] = useState<string>("");

  // Add link modal state
  const [isAddLinkModalOpen, setIsAddLinkModalOpen] = useState(false);

  // Delete link fetcher
  const deleteLinkFetcher = useFetcher();
  const openFolderFetcher = useFetcher();

  useEffect(() => {
    const result = openFolderFetcher.data as { error?: string } | undefined;
    if (openFolderFetcher.state === "idle" && result?.error) {
      toast.error(result.error);
    }
  }, [openFolderFetcher.state, openFolderFetcher.data]);

  // Standalone file management state
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);
  const [selectedFilename, setSelectedFilename] = useState<string>("");
  const [selectedFileContent, setSelectedFileContent] = useState<string>("");
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string>("");

  // Lesson file paste modal state
  const [isLessonPasteModalOpen, setIsLessonPasteModalOpen] = useState(false);

  // Social caption state with localStorage persistence
  const [socialCaption, setSocialCaption] = useState(() => {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem(SOCIAL_CAPTION_STORAGE_KEY(videoId)) ?? "";
    }
    return "";
  });

  // Auto-save social caption to localStorage
  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(SOCIAL_CAPTION_STORAGE_KEY(videoId), socialCaption);
    }
  }, [socialCaption, videoId]);

  // Social AI generation state
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [confirmOverwriteCaption, setConfirmOverwriteCaption] = useState(false);
  const [pendingGeneratedCaption, setPendingGeneratedCaption] = useState("");

  const handleGenerateCaption = async () => {
    setIsGeneratingCaption(true);
    try {
      const transcriptEnabled =
        clipSections.length > 0 ? enabledSections.size > 0 : includeTranscript;

      const response = await fetch(`/api/videos/${videoId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "social-caption",
          enabledFiles: Array.from(enabledFiles),
          includeTranscript: transcriptEnabled,
          enabledSections: Array.from(enabledSections),
          courseStructure:
            includeCourseStructure && courseStructure
              ? courseStructure
              : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate caption");
      }

      const result = await response.json();
      const generatedText = result.text as string;

      if (socialCaption.trim()) {
        setPendingGeneratedCaption(generatedText);
        setConfirmOverwriteCaption(true);
      } else {
        setSocialCaption(generatedText);
      }
    } catch (error) {
      console.error("Failed to generate caption:", error);
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  const handleConfirmOverwriteCaption = () => {
    setSocialCaption(pendingGeneratedCaption);
    setConfirmOverwriteCaption(false);
    setPendingGeneratedCaption("");
  };

  const handleCancelOverwriteCaption = () => {
    setConfirmOverwriteCaption(false);
    setPendingGeneratedCaption("");
  };

  // Read the video title from localStorage (set by the YouTube tab)
  const [videoTitle, setVideoTitle] = useState("");
  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      setVideoTitle(
        localStorage.getItem(`post-title-${videoId}`) || "Untitled"
      );
    }
  }, [videoId]);

  // Short link creation state
  const [creatingShortLink, setCreatingShortLink] = useState<string | null>(
    null
  );

  const handleCreateShortLink = async (
    platform: "Newsletter" | "X" | "LinkedIn"
  ) => {
    setCreatingShortLink(platform);
    try {
      const response = await fetch("/api/shortlinks/find-or-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://aihero.dev/newsletter",
          description: `${platform} (${videoTitle})`,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create short link");
      }

      const { shortLinkUrl } = await response.json();
      await navigator.clipboard.writeText(shortLinkUrl);
      toast("Short link copied", {
        description: `${platform} short link copied to clipboard: ${shortLinkUrl}`,
      });
    } catch (error) {
      console.error("Failed to create short link:", error);
      toast.error("Failed to create short link", {
        description:
          error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setCreatingShortLink(null);
    }
  };

  const copyAndNavigate = async (url: string, platform: string) => {
    if (!socialCaption.trim()) return;
    await navigator.clipboard.writeText(socialCaption);
    toast(`Caption copied to clipboard`, {
      description: `Opening ${platform}...`,
    });
    window.open(url, "_blank");
  };

  const handlePostToX = () => {
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(socialCaption)}`;
    copyAndNavigate(url, "X");
  };

  const handlePostToLinkedIn = () => {
    copyAndNavigate("https://www.linkedin.com/feed/", "LinkedIn");
  };

  const handleFileClick = (filePath: string) => {
    setPreviewFilePath(filePath);
    setIsPreviewModalOpen(true);
  };

  const handleEditFile = async (filename: string) => {
    try {
      const response = await fetch(
        `/api/standalone-files/read?videoId=${videoId}&filename=${encodeURIComponent(filename)}`
      );
      if (response.ok) {
        const content = await response.text();
        setSelectedFilename(filename);
        setSelectedFileContent(content);
        setIsFileModalOpen(true);
      }
    } catch (error) {
      console.error("Failed to read file:", error);
    }
  };

  const handleDeleteFile = (filename: string) => {
    setFileToDelete(filename);
    setIsDeleteModalOpen(true);
  };

  return (
    <>
      <div className="flex-1 flex overflow-hidden h-full">
        <VideoContextPanel
          videoSrc={`/api/videos/${videoId}/stream`}
          transcriptWordCount={transcriptWordCount}
          clipSections={clipSections}
          enabledSections={enabledSections}
          onEnabledSectionsChange={setEnabledSections}
          includeTranscript={includeTranscript}
          onIncludeTranscriptChange={setIncludeTranscript}
          courseStructure={courseStructure}
          includeCourseStructure={includeCourseStructure}
          onIncludeCourseStructureChange={setIncludeCourseStructure}
          files={files}
          isStandalone={isStandalone}
          enabledFiles={enabledFiles}
          onEnabledFilesChange={setEnabledFiles}
          onFileClick={handleFileClick}
          onOpenFolderClick={() => {
            openFolderFetcher.submit(null, {
              method: "post",
              action: `/api/videos/${videoId}/open-folder`,
            });
          }}
          onAddFromClipboardClick={
            isStandalone
              ? () => setIsPasteModalOpen(true)
              : () => setIsLessonPasteModalOpen(true)
          }
          onEditFile={handleEditFile}
          onDeleteFile={handleDeleteFile}
          links={links}
          onAddLinkClick={() => setIsAddLinkModalOpen(true)}
          onDeleteLink={(linkId) => {
            deleteLinkFetcher.submit(null, {
              method: "post",
              action: `/api/links/${linkId}/delete`,
            });
          }}
          videoSlot={<Video src={`/api/videos/${videoId}/stream`} />}
        />

        {/* Right panel: Social posting interface */}
        <div className="w-3/4 flex flex-col p-6 overflow-y-auto scrollbar scrollbar-track-transparent scrollbar-thumb-gray-700 hover:scrollbar-thumb-gray-600">
          <div className="max-w-2xl mx-auto w-full space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="social-caption">Caption</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateCaption}
                  disabled={isGeneratingCaption}
                >
                  {isGeneratingCaption ? (
                    <>
                      <Loader2Icon className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="h-4 w-4" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
              <Textarea
                id="social-caption"
                value={socialCaption}
                onChange={(e) => setSocialCaption(e.target.value)}
                placeholder="Enter caption for X and LinkedIn..."
                className="min-h-[200px] resize-y"
              />
            </div>

            {/* Post buttons */}
            <div className="space-y-3">
              <div className="flex gap-3">
                <Button
                  onClick={handlePostToX}
                  disabled={!socialCaption.trim()}
                  className="flex-1"
                  size="lg"
                >
                  <CopyIcon className="h-4 w-4" />
                  Post to X
                </Button>
                <Button
                  onClick={handlePostToLinkedIn}
                  disabled={!socialCaption.trim()}
                  className="flex-1"
                  size="lg"
                  variant="outline"
                >
                  <CopyIcon className="h-4 w-4" />
                  Post to LinkedIn
                </Button>
              </div>

              {!socialCaption.trim() && (
                <p className="text-sm text-muted-foreground text-center">
                  Write or generate a caption before posting.
                </p>
              )}

              <p className="text-xs text-muted-foreground text-center">
                Caption will be copied to clipboard. X will pre-fill the text;
                for LinkedIn, paste from clipboard.
              </p>
            </div>

            {/* Short link buttons */}
            <div className="space-y-3 pt-2 border-t border-border">
              <Label>Short Links</Label>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleCreateShortLink("X")}
                  disabled={creatingShortLink !== null}
                >
                  {creatingShortLink === "X" ? (
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                  ) : (
                    <LinkIcon className="h-4 w-4" />
                  )}
                  X
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleCreateShortLink("LinkedIn")}
                  disabled={creatingShortLink !== null}
                >
                  {creatingShortLink === "LinkedIn" ? (
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                  ) : (
                    <LinkIcon className="h-4 w-4" />
                  )}
                  LinkedIn
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Creates a tracked short link and copies it to clipboard.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* File preview modal */}
      <FilePreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        videoId={videoId}
        filePath={previewFilePath}
        isStandalone={isStandalone}
      />

      {/* Add link modal */}
      <AddLinkModal
        open={isAddLinkModalOpen}
        onOpenChange={setIsAddLinkModalOpen}
      />

      {/* Standalone file modals */}
      {isStandalone && (
        <>
          <StandaloneFileManagementModal
            videoId={videoId}
            filename={selectedFilename}
            content={selectedFileContent}
            open={isFileModalOpen}
            onOpenChange={setIsFileModalOpen}
          />
          <StandaloneFilePasteModal
            videoId={videoId}
            open={isPasteModalOpen}
            onOpenChange={setIsPasteModalOpen}
            existingFiles={files}
            onFileCreated={(filename) => {
              setEnabledFiles((prev) => new Set([...prev, filename]));
            }}
          />
          <DeleteStandaloneFileModal
            videoId={videoId}
            filename={fileToDelete}
            open={isDeleteModalOpen}
            onOpenChange={setIsDeleteModalOpen}
          />
        </>
      )}

      {/* Lesson file paste modal */}
      {!isStandalone && (
        <LessonFilePasteModal
          videoId={videoId}
          open={isLessonPasteModalOpen}
          onOpenChange={setIsLessonPasteModalOpen}
          existingFiles={files}
          onFileCreated={(filename) => {
            setEnabledFiles((prev) => new Set([...prev, filename]));
          }}
        />
      )}

      {/* Overwrite confirmation dialog (Social caption) */}
      <Dialog
        open={confirmOverwriteCaption}
        onOpenChange={(open) => {
          if (!open) handleCancelOverwriteCaption();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace existing caption?</DialogTitle>
            <DialogDescription>
              The caption field already has content. Do you want to replace it
              with the generated text?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelOverwriteCaption}>
              Cancel
            </Button>
            <Button onClick={handleConfirmOverwriteCaption}>Replace</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
