import { Console, Effect, Schema } from "effect";
import type { Route } from "./+types/api.sections.create";
import { DBFunctionsService } from "@/services/db-service.server";
import { runtimeLive } from "@/services/layer.server";
import { withDatabaseDump } from "@/services/dump-service";
import { data } from "react-router";
import { toSlug } from "@/services/lesson-path-service";
import { buildSectionPath } from "@/services/section-path-service";

const createSectionSchema = Schema.Struct({
  repoVersionId: Schema.String.pipe(
    Schema.minLength(1, { message: () => "Repo version ID is required" })
  ),
  title: Schema.String.pipe(
    Schema.minLength(1, { message: () => "Title is required" })
  ),
  maxOrder: Schema.NumberFromString,
});

export const action = async (args: Route.ActionArgs) => {
  const formData = await args.request.formData();
  const formDataObject = Object.fromEntries(formData);

  return Effect.gen(function* () {
    const { repoVersionId, title, maxOrder } =
      yield* Schema.decodeUnknown(createSectionSchema)(formDataObject);

    const db = yield* DBFunctionsService;

    const sectionNumber = maxOrder + 1;
    const [newSection] = yield* db.createSections({
      repoVersionId,
      sections: [
        {
          sectionPathWithNumber: buildSectionPath(
            sectionNumber,
            toSlug(title) || "untitled"
          ),
          sectionNumber,
        },
      ],
    });

    return { success: true, sectionId: newSection!.id };
  }).pipe(
    withDatabaseDump,
    Effect.tapErrorCause((e) => Console.dir(e, { depth: null })),
    Effect.catchTag("ParseError", () => {
      return Effect.die(data("Invalid request", { status: 400 }));
    }),
    Effect.catchAll(() => {
      return Effect.die(data("Internal server error", { status: 500 }));
    }),
    runtimeLive.runPromise
  );
};
