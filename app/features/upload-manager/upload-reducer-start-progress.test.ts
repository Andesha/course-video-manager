import { describe, expect, it } from "vitest";
import { uploadReducer, createInitialUploadState } from "./upload-reducer";

const reduce = (state: uploadReducer.State, action: uploadReducer.Action) =>
  uploadReducer(state, action);

const createState = (
  overrides: Partial<uploadReducer.State> = {}
): uploadReducer.State => ({
  ...createInitialUploadState(),
  ...overrides,
});

const createYouTubeEntry = (
  overrides: Partial<Omit<uploadReducer.YouTubeUploadEntry, "uploadType">> = {}
): uploadReducer.YouTubeUploadEntry => ({
  uploadId: "upload-1",
  videoId: "video-1",
  title: "Test Video",
  progress: 0,
  status: "uploading",
  uploadType: "youtube",
  youtubeVideoId: null,
  errorMessage: null,
  retryCount: 0,
  dependsOn: null,
  ...overrides,
});

const createBufferEntry = (
  overrides: Partial<Omit<uploadReducer.BufferUploadEntry, "uploadType">> = {}
): uploadReducer.BufferUploadEntry => ({
  uploadId: "upload-1",
  videoId: "video-1",
  title: "Test Video",
  progress: 0,
  status: "uploading",
  uploadType: "buffer",
  bufferStage: "copying",
  errorMessage: null,
  retryCount: 0,
  dependsOn: null,
  ...overrides,
});

const createExportEntry = (
  overrides: Partial<Omit<uploadReducer.ExportUploadEntry, "uploadType">> = {}
): uploadReducer.ExportUploadEntry => ({
  uploadId: "upload-1",
  videoId: "video-1",
  title: "Test Video",
  progress: 0,
  status: "uploading",
  uploadType: "export",
  exportStage: "queued",
  isBatchEntry: false,
  errorMessage: null,
  retryCount: 0,
  dependsOn: null,
  ...overrides,
});

describe("START_UPLOAD", () => {
  it("should add a new youtube upload entry", () => {
    const state = reduce(createState(), {
      type: "START_UPLOAD",
      uploadId: "upload-1",
      videoId: "video-1",
      title: "My Video",
    });

    expect(state.uploads["upload-1"]).toEqual({
      uploadId: "upload-1",
      videoId: "video-1",
      title: "My Video",
      progress: 0,
      status: "uploading",
      uploadType: "youtube",
      youtubeVideoId: null,
      errorMessage: null,
      retryCount: 0,
      dependsOn: null,
    });
  });

  it("should not affect existing uploads", () => {
    const existing = createYouTubeEntry({
      uploadId: "upload-1",
      progress: 50,
    });
    const state = reduce(createState({ uploads: { "upload-1": existing } }), {
      type: "START_UPLOAD",
      uploadId: "upload-2",
      videoId: "video-2",
      title: "Second Video",
    });

    expect(state.uploads["upload-1"]).toEqual(existing);
    expect(state.uploads["upload-2"]).toBeDefined();
  });

  it("should overwrite if same uploadId is started again", () => {
    const existing = createYouTubeEntry({
      uploadId: "upload-1",
      progress: 50,
      status: "error",
      retryCount: 3,
    });
    const state = reduce(createState({ uploads: { "upload-1": existing } }), {
      type: "START_UPLOAD",
      uploadId: "upload-1",
      videoId: "video-1",
      title: "Restarted Video",
    });

    expect(state.uploads["upload-1"]).toEqual({
      uploadId: "upload-1",
      videoId: "video-1",
      title: "Restarted Video",
      progress: 0,
      status: "uploading",
      uploadType: "youtube",
      youtubeVideoId: null,
      errorMessage: null,
      retryCount: 0,
      dependsOn: null,
    });
  });

  it("should default uploadType to youtube", () => {
    const state = reduce(createState(), {
      type: "START_UPLOAD",
      uploadId: "upload-1",
      videoId: "video-1",
      title: "My Video",
    });

    expect(state.uploads["upload-1"]!.uploadType).toBe("youtube");
  });

  it("should set uploadType to buffer and initialize bufferStage to copying", () => {
    const state = reduce(createState(), {
      type: "START_UPLOAD",
      uploadId: "upload-1",
      videoId: "video-1",
      title: "Social Post",
      uploadType: "buffer",
    });

    const upload = state.uploads["upload-1"]!;
    expect(upload.uploadType).toBe("buffer");
    expect(upload.uploadType === "buffer" && upload.bufferStage).toBe(
      "copying"
    );
  });

  it("should set uploadType to ai-hero and initialize aiHeroSlug to null", () => {
    const state = reduce(createState(), {
      type: "START_UPLOAD",
      uploadId: "upload-1",
      videoId: "video-1",
      title: "AI Hero Post",
      uploadType: "ai-hero",
    });

    expect(state.uploads["upload-1"]).toEqual({
      uploadId: "upload-1",
      videoId: "video-1",
      title: "AI Hero Post",
      progress: 0,
      status: "uploading",
      uploadType: "ai-hero",
      aiHeroSlug: null,
      errorMessage: null,
      retryCount: 0,
      dependsOn: null,
    });
  });

  it("should set uploadType to export and initialize exportStage to queued", () => {
    const state = reduce(createState(), {
      type: "START_UPLOAD",
      uploadId: "upload-1",
      videoId: "video-1",
      title: "Export Video",
      uploadType: "export",
    });

    expect(state.uploads["upload-1"]).toEqual({
      uploadId: "upload-1",
      videoId: "video-1",
      title: "Export Video",
      progress: 0,
      status: "uploading",
      uploadType: "export",
      exportStage: "queued",
      isBatchEntry: false,
      errorMessage: null,
      retryCount: 0,
      dependsOn: null,
    });
  });
});

describe("UPDATE_PROGRESS", () => {
  it("should update progress for existing upload", () => {
    const state = reduce(
      createState({
        uploads: { "upload-1": createYouTubeEntry() },
      }),
      { type: "UPDATE_PROGRESS", uploadId: "upload-1", progress: 42 }
    );

    expect(state.uploads["upload-1"]!.progress).toBe(42);
  });

  it("should not modify state for non-existent upload", () => {
    const initial = createState();
    const state = reduce(initial, {
      type: "UPDATE_PROGRESS",
      uploadId: "non-existent",
      progress: 50,
    });

    expect(state).toBe(initial);
  });

  it("should not affect other uploads", () => {
    const upload1 = createYouTubeEntry({
      uploadId: "upload-1",
      progress: 10,
    });
    const upload2 = createYouTubeEntry({
      uploadId: "upload-2",
      progress: 20,
    });
    const state = reduce(
      createState({
        uploads: { "upload-1": upload1, "upload-2": upload2 },
      }),
      { type: "UPDATE_PROGRESS", uploadId: "upload-1", progress: 75 }
    );

    expect(state.uploads["upload-1"]!.progress).toBe(75);
    expect(state.uploads["upload-2"]!.progress).toBe(20);
  });
});

describe("UPDATE_BUFFER_STAGE", () => {
  it("should update buffer stage for existing upload", () => {
    const state = reduce(
      createState({
        uploads: {
          "upload-1": createBufferEntry({ bufferStage: "copying" }),
        },
      }),
      { type: "UPDATE_BUFFER_STAGE", uploadId: "upload-1", stage: "syncing" }
    );

    const upload = state.uploads["upload-1"]!;
    expect(upload.uploadType === "buffer" && upload.bufferStage).toBe(
      "syncing"
    );
  });

  it("should transition from syncing to sending-webhook", () => {
    const state = reduce(
      createState({
        uploads: {
          "upload-1": createBufferEntry({ bufferStage: "syncing" }),
        },
      }),
      {
        type: "UPDATE_BUFFER_STAGE",
        uploadId: "upload-1",
        stage: "sending-webhook",
      }
    );

    const upload = state.uploads["upload-1"]!;
    expect(upload.uploadType === "buffer" && upload.bufferStage).toBe(
      "sending-webhook"
    );
  });

  it("should not modify state for non-existent upload", () => {
    const initial = createState();
    const state = reduce(initial, {
      type: "UPDATE_BUFFER_STAGE",
      uploadId: "non-existent",
      stage: "syncing",
    });

    expect(state).toBe(initial);
  });

  it("should not modify state for non-buffer upload", () => {
    const initial = createState({
      uploads: { "upload-1": createYouTubeEntry() },
    });
    const state = reduce(initial, {
      type: "UPDATE_BUFFER_STAGE",
      uploadId: "upload-1",
      stage: "syncing",
    });

    expect(state).toBe(initial);
  });
});

describe("UPDATE_EXPORT_STAGE", () => {
  it("should update export stage for existing upload", () => {
    const state = reduce(
      createState({
        uploads: {
          "upload-1": createExportEntry({
            exportStage: "concatenating-clips",
          }),
        },
      }),
      {
        type: "UPDATE_EXPORT_STAGE",
        uploadId: "upload-1",
        stage: "normalizing-audio",
      }
    );

    const upload = state.uploads["upload-1"]!;
    expect(upload.uploadType === "export" && upload.exportStage).toBe(
      "normalizing-audio"
    );
  });

  it("should update export stage to queued", () => {
    const state = reduce(
      createState({
        uploads: {
          "upload-1": createExportEntry({
            exportStage: "concatenating-clips",
          }),
        },
      }),
      {
        type: "UPDATE_EXPORT_STAGE",
        uploadId: "upload-1",
        stage: "queued",
      }
    );

    const upload = state.uploads["upload-1"]!;
    expect(upload.uploadType === "export" && upload.exportStage).toBe("queued");
  });

  it("should not modify state for non-existent upload", () => {
    const initial = createState();
    const state = reduce(initial, {
      type: "UPDATE_EXPORT_STAGE",
      uploadId: "non-existent",
      stage: "normalizing-audio",
    });

    expect(state).toBe(initial);
  });

  it("should not modify state for non-export upload", () => {
    const initial = createState({
      uploads: { "upload-1": createYouTubeEntry() },
    });
    const state = reduce(initial, {
      type: "UPDATE_EXPORT_STAGE",
      uploadId: "upload-1",
      stage: "normalizing-audio",
    });

    expect(state).toBe(initial);
  });
});
