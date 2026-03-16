import { Effect, Schema } from "effect";
import { runtimeLive } from "@/services/layer.server";
import type { Route } from "./+types/api.courses.$courseId.publish-sse";
import { CoursePublishService } from "@/services/course-publish-service";

const publishSchema = Schema.Struct({
  name: Schema.String,
  description: Schema.optional(Schema.String),
});

export const action = async (args: Route.ActionArgs) => {
  const { courseId } = args.params;
  const body = await args.request.json();
  const parsed = Schema.decodeUnknownSync(publishSchema)(body);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      const program = Effect.gen(function* () {
        const publishService = yield* CoursePublishService;

        const result = yield* publishService.publish(
          courseId,
          parsed.name,
          parsed.description ?? "",
          (stage) => {
            sendEvent("progress", { stage });
          }
        );

        sendEvent("complete", {
          publishedVersionId: result.publishedVersionId,
          newDraftVersionId: result.newDraftVersionId,
        });
      });

      program
        .pipe(
          Effect.catchTag("PublishValidationError", (e) =>
            Effect.sync(() => {
              sendEvent("error", {
                message: `${e.unexportedVideoIds.length} video(s) are not yet exported`,
                type: "validation",
                unexportedVideoIds: e.unexportedVideoIds,
              });
            })
          ),
          Effect.catchTag("NotFoundError", () =>
            Effect.sync(() => {
              sendEvent("error", { message: "Course not found" });
            })
          ),
          Effect.catchAll((e) =>
            Effect.sync(() => {
              sendEvent("error", {
                message:
                  "message" in e && typeof e.message === "string"
                    ? e.message
                    : "Publish failed unexpectedly",
              });
            })
          ),
          runtimeLive.runPromise
        )
        .finally(() => {
          controller.close();
        });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};
