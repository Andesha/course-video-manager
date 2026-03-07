/**
 * Schema definitions for ClipService RPC events.
 * Used by the route handler to validate incoming requests.
 */

import { Schema } from "effect";

const InsertionPointSchema = Schema.Union(
  Schema.Struct({
    type: Schema.Literal("start"),
  }),
  Schema.Struct({
    type: Schema.Literal("after-clip"),
    databaseClipId: Schema.String,
  }),
  Schema.Struct({
    type: Schema.Literal("after-clip-section"),
    clipSectionId: Schema.String,
  })
);

const ReorderDirectionSchema = Schema.Union(
  Schema.Literal("up"),
  Schema.Literal("down")
);

const PositionSchema = Schema.Union(
  Schema.Literal("before"),
  Schema.Literal("after")
);

const TargetItemTypeSchema = Schema.Union(
  Schema.Literal("clip"),
  Schema.Literal("clip-section")
);

const ClipInputSchema = Schema.Struct({
  inputVideo: Schema.String,
  startTime: Schema.Number,
  endTime: Schema.Number,
});

const AppendClipsInputSchema = Schema.Struct({
  videoId: Schema.String,
  insertionPoint: InsertionPointSchema,
  clips: Schema.Array(ClipInputSchema),
});

const AppendFromObsInputSchema = Schema.Struct({
  videoId: Schema.String,
  filePath: Schema.optional(Schema.String),
  insertionPoint: InsertionPointSchema,
});

const UpdateClipInputSchema = Schema.Struct({
  id: Schema.String,
  scene: Schema.String,
  profile: Schema.String,
  beatType: Schema.String,
});

const CreateClipSectionAtInsertionPointInputSchema = Schema.Struct({
  videoId: Schema.String,
  name: Schema.String,
  insertionPoint: InsertionPointSchema,
});

const CreateClipSectionAtPositionInputSchema = Schema.Struct({
  videoId: Schema.String,
  name: Schema.String,
  position: PositionSchema,
  targetItemId: Schema.String,
  targetItemType: TargetItemTypeSchema,
});

const CreateVideoFromSelectionModeSchema = Schema.Union(
  Schema.Literal("copy"),
  Schema.Literal("move")
);

const CreateVideoFromSelectionInputSchema = Schema.Struct({
  sourceVideoId: Schema.String,
  clipIds: Schema.Array(Schema.String),
  clipSectionIds: Schema.Array(Schema.String),
  title: Schema.String,
  mode: CreateVideoFromSelectionModeSchema,
});

/**
 * Schema for validating ClipServiceEvent in the route handler.
 * This is a discriminated union matching all possible event types.
 */
export const ClipServiceEventSchema = Schema.Union(
  Schema.Struct({
    type: Schema.Literal("create-video"),
    path: Schema.String,
  }),
  Schema.Struct({
    type: Schema.Literal("get-timeline"),
    videoId: Schema.String,
  }),
  Schema.Struct({
    type: Schema.Literal("append-clips"),
    input: AppendClipsInputSchema,
  }),
  Schema.Struct({
    type: Schema.Literal("append-from-obs"),
    input: AppendFromObsInputSchema,
  }),
  Schema.Struct({
    type: Schema.Literal("archive-clips"),
    clipIds: Schema.Array(Schema.String),
  }),
  Schema.Struct({
    type: Schema.Literal("unarchive-clips"),
    clipIds: Schema.Array(Schema.String),
  }),
  Schema.Struct({
    type: Schema.Literal("update-clips"),
    clips: Schema.Array(UpdateClipInputSchema),
  }),
  Schema.Struct({
    type: Schema.Literal("update-beat"),
    clipId: Schema.String,
    beatType: Schema.String,
  }),
  Schema.Struct({
    type: Schema.Literal("reorder-clip"),
    clipId: Schema.String,
    direction: ReorderDirectionSchema,
  }),
  Schema.Struct({
    type: Schema.Literal("create-clip-section-at-insertion-point"),
    input: CreateClipSectionAtInsertionPointInputSchema,
  }),
  Schema.Struct({
    type: Schema.Literal("create-clip-section-at-position"),
    input: CreateClipSectionAtPositionInputSchema,
  }),
  Schema.Struct({
    type: Schema.Literal("update-clip-section"),
    clipSectionId: Schema.String,
    name: Schema.String,
  }),
  Schema.Struct({
    type: Schema.Literal("archive-clip-sections"),
    clipSectionIds: Schema.Array(Schema.String),
  }),
  Schema.Struct({
    type: Schema.Literal("reorder-clip-section"),
    clipSectionId: Schema.String,
    direction: ReorderDirectionSchema,
  }),
  Schema.Struct({
    type: Schema.Literal("create-video-from-selection"),
    input: CreateVideoFromSelectionInputSchema,
  })
);
