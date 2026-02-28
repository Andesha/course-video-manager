import { Console, Effect } from "effect";
import { findOrCreateShortLink } from "@/services/ai-hero-shortlink-service";
import { runtimeLive } from "@/services/layer.server";

/**
 * POST /api/shortlinks/find-or-create
 * Body: { url: string, description: string }
 * Returns: { shortLinkUrl: string }
 */
export const action = async ({ request }: { request: Request }) => {
  const body = await request.json();
  const { url, description } = body as { url: string; description: string };

  if (!url || !description) {
    return Response.json(
      { error: "url and description are required" },
      { status: 400 }
    );
  }

  return Effect.gen(function* () {
    const result = yield* findOrCreateShortLink({ url, description });
    return Response.json(result);
  }).pipe(
    Effect.tapErrorCause((e) => Console.log(e)),
    Effect.catchTag("AiHeroShortLinkError", (e) => {
      return Effect.succeed(
        Response.json({ error: e.message }, { status: 500 })
      );
    }),
    Effect.catchTag("AiHeroNotAuthenticatedError", () => {
      return Effect.succeed(
        Response.json(
          { error: "Not authenticated with AI Hero" },
          { status: 401 }
        )
      );
    }),
    Effect.catchTag("ConfigError", () => {
      return Effect.succeed(
        Response.json(
          { error: "AI_HERO_BASE_URL is not configured" },
          { status: 500 }
        )
      );
    }),
    Effect.catchAll(() => {
      return Effect.succeed(
        Response.json({ error: "Internal server error" }, { status: 500 })
      );
    }),
    runtimeLive.runPromise
  );
};
