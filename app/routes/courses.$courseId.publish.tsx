import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFocusRevalidate } from "@/hooks/use-focus-revalidate";
import { generateChangelog } from "@/services/changelog-service";
import { CoursePublishService } from "@/services/course-publish-service";
import { DBFunctionsService } from "@/services/db-service.server";
import { runtimeLive } from "@/services/layer.server";
import { Console, Effect } from "effect";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { data, Link, useNavigate, useRevalidator } from "react-router";
import type { Route } from "./+types/courses.$courseId.publish";

export const loader = async (args: Route.LoaderArgs) => {
  const { courseId } = args.params;

  return Effect.gen(function* () {
    const db = yield* DBFunctionsService;
    const publishService = yield* CoursePublishService;

    const course = yield* db.getCourseById(courseId);
    const latestVersion = yield* db.getLatestCourseVersion(courseId);

    if (!latestVersion) {
      return yield* Effect.die(data("No version found", { status: 404 }));
    }

    // Get changelog preview (treat draft as if it were published with a placeholder name)
    const allVersions = yield* db.getAllVersionsWithStructure(courseId);
    const changelogVersions = allVersions.map((v) =>
      v.id === latestVersion.id
        ? { ...v, name: "(Draft — pending publish)" }
        : v
    );
    const changelog = generateChangelog(changelogVersions);

    // Get unexported videos
    const { unexportedVideoIds } = yield* publishService.validatePublishability(
      latestVersion.id
    );

    // Get video details for unexported videos
    const version = yield* db.getVersionWithSections(latestVersion.id);
    const unexportedVideos: Array<{
      id: string;
      path: string;
      sectionPath: string;
      lessonPath: string;
    }> = [];

    for (const section of version.sections) {
      for (const lesson of section.lessons) {
        if (lesson.fsStatus === "ghost") continue;
        for (const video of lesson.videos) {
          if (unexportedVideoIds.includes(video.id)) {
            unexportedVideos.push({
              id: video.id,
              path: video.path,
              sectionPath: section.path,
              lessonPath: lesson.path,
            });
          }
        }
      }
    }

    return {
      course,
      latestVersion,
      changelog,
      unexportedVideos,
    };
  }).pipe(
    Effect.tapErrorCause((e) => Console.dir(e, { depth: null })),
    Effect.catchTag("NotFoundError", () => {
      return Effect.die(data("Course not found", { status: 404 }));
    }),
    Effect.catchAll(() => {
      return Effect.die(data("Internal server error", { status: 500 }));
    }),
    runtimeLive.runPromise
  );
};

type PublishStage =
  | "idle"
  | "validating"
  | "uploading"
  | "freezing"
  | "cloning"
  | "complete"
  | "error";

const STAGE_LABELS: Record<PublishStage, string> = {
  idle: "",
  validating: "Validating...",
  uploading: "Uploading to Dropbox...",
  freezing: "Freezing version...",
  cloning: "Creating new draft...",
  complete: "Published!",
  error: "Publish failed",
};

export default function Component(props: Route.ComponentProps) {
  const { course, changelog, unexportedVideos } = props.loaderData;
  const navigate = useNavigate();
  const revalidator = useRevalidator();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [publishStage, setPublishStage] = useState<PublishStage>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [exportingVideoIds, setExportingVideoIds] = useState<Set<string>>(
    new Set()
  );
  const abortControllerRef = useRef<AbortController | null>(null);

  useFocusRevalidate({ enabled: publishStage === "idle" });

  const hasUnexportedVideos = unexportedVideos.length > 0;
  const canPublish =
    name.trim().length > 0 && !hasUnexportedVideos && publishStage === "idle";

  const handleExportVideo = useCallback(
    async (videoId: string) => {
      setExportingVideoIds((prev) => new Set(prev).add(videoId));

      try {
        const response = await fetch(`/api/videos/${videoId}/export-sse`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });

        if (!response.ok || !response.body) {
          throw new Error("Failed to start export");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          let eventType = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7);
            } else if (line.startsWith("data: ") && eventType) {
              const eventData = JSON.parse(line.slice(6));
              if (eventType === "error") {
                throw new Error(eventData.message);
              }
              eventType = "";
            }
          }
        }

        // Revalidate to refresh the unexported videos list
        revalidator.revalidate();
      } catch (e) {
        console.error("Export failed:", e);
      } finally {
        setExportingVideoIds((prev) => {
          const next = new Set(prev);
          next.delete(videoId);
          return next;
        });
      }
    },
    [revalidator]
  );

  const handlePublish = useCallback(async () => {
    setPublishStage("validating");
    setErrorMessage(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch(`/api/courses/${course.id}/publish-sse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
        }),
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        setPublishStage("error");
        setErrorMessage("Failed to start publish");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7);
          } else if (line.startsWith("data: ") && eventType) {
            const eventData = JSON.parse(line.slice(6));

            if (eventType === "progress") {
              setPublishStage(eventData.stage);
            } else if (eventType === "complete") {
              setPublishStage("complete");
              // Navigate to the new draft after a brief delay
              setTimeout(() => {
                navigate(
                  `/?courseId=${course.id}&versionId=${eventData.newDraftVersionId}`
                );
              }, 1500);
            } else if (eventType === "error") {
              setPublishStage("error");
              setErrorMessage(eventData.message);
            }
            eventType = "";
          }
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setPublishStage("error");
      setErrorMessage(e instanceof Error ? e.message : "Publish failed");
    }
  }, [course.id, name, description, navigate]);

  const isPublishing =
    publishStage !== "idle" &&
    publishStage !== "error" &&
    publishStage !== "complete";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto p-6">
        <div className="mb-6">
          <Link
            to={`/?courseId=${course.id}`}
            onClick={(e) => e.preventDefault()}
            onMouseDown={(e) => {
              if (e.button === 0) navigate(`/?courseId=${course.id}`);
            }}
          >
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to {course.name}
            </Button>
          </Link>
        </div>

        <h1 className="text-2xl font-bold mb-6">Publish {course.name}</h1>

        {/* Publish Form */}
        <div className="space-y-4 mb-8">
          <div className="space-y-2">
            <Label htmlFor="version-name">Version Name *</Label>
            <Input
              id="version-name"
              placeholder='e.g. "v2.1 — Added auth module"'
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPublishing || publishStage === "complete"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="version-description">Description</Label>
            <Textarea
              id="version-description"
              placeholder="Optional description of what changed..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isPublishing || publishStage === "complete"}
              rows={3}
            />
          </div>
        </div>

        {/* Unexported Videos */}
        {hasUnexportedVideos && (
          <div className="mb-8 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-amber-500">
                {unexportedVideos.length} Unexported Video
                {unexportedVideos.length !== 1 ? "s" : ""}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              All videos with clips must be exported before publishing.
            </p>
            <div className="space-y-2">
              {unexportedVideos.map((video) => (
                <div
                  key={video.id}
                  className="flex items-center justify-between rounded-md border border-border bg-background p-3"
                >
                  <span className="text-sm font-mono">
                    {video.sectionPath}/{video.lessonPath}/{video.path}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExportVideo(video.id)}
                    disabled={exportingVideoIds.has(video.id)}
                  >
                    {exportingVideoIds.has(video.id) ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="w-3 h-3 mr-1" />
                        Export
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Publish Button */}
        <div className="mb-8">
          {publishStage === "error" && errorMessage && (
            <div className="mb-3 rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
              {errorMessage}
            </div>
          )}

          {publishStage === "complete" && (
            <div className="mb-3 rounded-md border border-green-500/50 bg-green-500/5 p-3 text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Published successfully! Redirecting to new draft...
            </div>
          )}

          <Button
            onClick={handlePublish}
            disabled={!canPublish}
            className="w-full"
            size="lg"
          >
            {isPublishing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {STAGE_LABELS[publishStage]}
              </>
            ) : publishStage === "error" ? (
              "Retry Publish"
            ) : (
              "Publish"
            )}
          </Button>

          {publishStage === "error" && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full"
              onClick={() => {
                setPublishStage("idle");
                setErrorMessage(null);
              }}
            >
              Reset
            </Button>
          )}
        </div>

        {/* Changelog Preview */}
        <div className="border-t border-border pt-6">
          <h2 className="text-lg font-semibold mb-4">Changelog Preview</h2>
          <div className="prose dark:prose-invert max-w-none">
            <Markdown rehypePlugins={[rehypeRaw]}>{changelog}</Markdown>
          </div>
        </div>
      </div>
    </div>
  );
}
