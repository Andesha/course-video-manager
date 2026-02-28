import { runtimeLive } from "@/services/layer.server";
import { batchExportProgram } from "@/services/batch-export.server";
import type { Route } from "./+types/api.repoVersions.$versionId.batch-export-sse";

export const action = async (args: Route.ActionArgs) => {
  const { versionId } = args.params;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      batchExportProgram(versionId, sendEvent)
        .pipe(runtimeLive.runPromise)
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
