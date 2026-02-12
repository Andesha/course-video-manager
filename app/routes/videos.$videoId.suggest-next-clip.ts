import { layerLive } from "@/services/layer";
import { acquireTextWritingContext } from "@/services/text-writing-agent";
import {
  generateSuggestNextClipPrompt,
  type FewShotExample,
} from "@/prompts/generate-suggest-next-clip";
import { DBService } from "@/services/db-service";
import { Experimental_Agent as Agent } from "ai";
import { Console, Effect, Schema } from "effect";
import type { Route } from "./+types/videos.$videoId.suggest-next-clip";
import { anthropic } from "@ai-sdk/anthropic";
import { data } from "react-router";

const requestSchema = Schema.Struct({
  enabledFiles: Schema.optionalWith(Schema.Array(Schema.String), {
    default: () => [],
  }),
});

export const action = async (args: Route.ActionArgs) => {
  const body = await args.request.json();
  const videoId = args.params.videoId;

  return Effect.gen(function* () {
    const db = yield* DBService;
    const parsed = yield* Schema.decodeUnknown(requestSchema)(body);
    const enabledFiles: string[] = [...parsed.enabledFiles];

    const videoContext = yield* acquireTextWritingContext({
      videoId,
      enabledFiles,
      includeTranscript: true,
      enabledSections: [],
    });

    // Get videos for few-shot examples (excluding current video)
    const exampleVideos = yield* db.getVideosForFewShotExamples(videoId);

    // Build few-shot examples from the example videos
    // For each video, take the clip transcripts to show the progression
    const fewShotExamples: FewShotExample[] = exampleVideos
      .map((video) => {
        // Get all clip transcripts that have text
        const clipTranscripts = video.clips
          .filter((clip) => clip.text && clip.text.trim().length > 0)
          .map((clip) => clip.text);

        return { clipTranscripts };
      })
      .filter((example) => example.clipTranscripts.length >= 2);

    const systemPrompt = generateSuggestNextClipPrompt({
      code: videoContext.textFiles,
      transcript: videoContext.transcript,
      fewShotExamples,
    });

    const agent = new Agent({
      model: anthropic("claude-haiku-4-5"),
      system: systemPrompt,
    });

    const result = agent.stream({
      messages: [
        {
          role: "user",
          content: "Suggest what I should say next.",
        },
      ],
    });

    return result.toUIMessageStreamResponse();
  }).pipe(
    Effect.tapErrorCause((e) => Console.dir(e, { depth: null })),
    Effect.catchTag("ParseError", () => {
      return Effect.die(data("Invalid request", { status: 400 }));
    }),
    Effect.catchAll(() => {
      return Effect.die(data("Internal server error", { status: 500 }));
    }),
    Effect.provide(layerLive),
    Effect.runPromise
  );
};
