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

const createAiHeroEntry = (
  overrides: Partial<Omit<uploadReducer.AiHeroUploadEntry, "uploadType">> = {}
): uploadReducer.AiHeroUploadEntry => ({
  uploadId: "upload-1",
  videoId: "video-1",
  title: "Test Video",
  progress: 0,
  status: "uploading",
  uploadType: "ai-hero",
  aiHeroSlug: null,
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

describe("UPLOAD_SUCCESS", () => {
  it("should set status to success and store youtube video id", () => {
    const state = reduce(
      createState({
        uploads: {
          "upload-1": createYouTubeEntry({ progress: 95 }),
        },
      }),
      {
        type: "UPLOAD_SUCCESS",
        uploadId: "upload-1",
        youtubeVideoId: "yt-abc123",
      }
    );

    const upload = state.uploads["upload-1"]!;
    expect(upload.status).toBe("success");
    expect(upload.progress).toBe(100);
    expect(upload.uploadType === "youtube" && upload.youtubeVideoId).toBe(
      "yt-abc123"
    );
    expect(upload.errorMessage).toBeNull();
  });

  it("should not modify state for non-existent upload", () => {
    const initial = createState();
    const state = reduce(initial, {
      type: "UPLOAD_SUCCESS",
      uploadId: "non-existent",
      youtubeVideoId: "yt-abc",
    });

    expect(state).toBe(initial);
  });

  it("should clear any previous error message", () => {
    const state = reduce(
      createState({
        uploads: {
          "upload-1": createYouTubeEntry({
            errorMessage: "previous error",
            status: "uploading",
          }),
        },
      }),
      {
        type: "UPLOAD_SUCCESS",
        uploadId: "upload-1",
        youtubeVideoId: "yt-abc",
      }
    );

    expect(state.uploads["upload-1"]!.errorMessage).toBeNull();
  });

  it("should work without youtubeVideoId for buffer uploads", () => {
    const state = reduce(
      createState({
        uploads: {
          "upload-1": createBufferEntry({
            bufferStage: "sending-webhook",
            progress: 100,
          }),
        },
      }),
      {
        type: "UPLOAD_SUCCESS",
        uploadId: "upload-1",
      }
    );

    const upload = state.uploads["upload-1"]!;
    expect(upload.status).toBe("success");
    expect(upload.progress).toBe(100);
    expect(upload.uploadType).toBe("buffer");
  });

  it("should clear bufferStage on success", () => {
    const state = reduce(
      createState({
        uploads: {
          "upload-1": createBufferEntry({
            bufferStage: "sending-webhook",
          }),
        },
      }),
      {
        type: "UPLOAD_SUCCESS",
        uploadId: "upload-1",
      }
    );

    const upload = state.uploads["upload-1"]!;
    expect(upload.uploadType === "buffer" && upload.bufferStage).toBeNull();
  });

  it("should store aiHeroSlug for ai-hero uploads", () => {
    const state = reduce(
      createState({
        uploads: {
          "upload-1": createAiHeroEntry({ progress: 95 }),
        },
      }),
      {
        type: "UPLOAD_SUCCESS",
        uploadId: "upload-1",
        aiHeroSlug: "my-post~abc123",
      }
    );

    const upload = state.uploads["upload-1"]!;
    expect(upload.status).toBe("success");
    expect(upload.progress).toBe(100);
    expect(upload.uploadType === "ai-hero" && upload.aiHeroSlug).toBe(
      "my-post~abc123"
    );
    expect(upload.errorMessage).toBeNull();
  });

  it("should clear exportStage on success for export uploads", () => {
    const state = reduce(
      createState({
        uploads: {
          "upload-1": createExportEntry({
            exportStage: "normalizing-audio",
          }),
        },
      }),
      {
        type: "UPLOAD_SUCCESS",
        uploadId: "upload-1",
      }
    );

    const upload = state.uploads["upload-1"]!;
    expect(upload.status).toBe("success");
    expect(upload.progress).toBe(100);
    expect(upload.uploadType).toBe("export");
    expect(upload.uploadType === "export" && upload.exportStage).toBeNull();
  });
});

describe("UPLOAD_ERROR", () => {
  it("should transition to retrying when retryCount < 3", () => {
    const state = reduce(
      createState({
        uploads: {
          "upload-1": createYouTubeEntry({ retryCount: 0 }),
        },
      }),
      {
        type: "UPLOAD_ERROR",
        uploadId: "upload-1",
        errorMessage: "Network error",
      }
    );

    const upload = state.uploads["upload-1"]!;
    expect(upload.status).toBe("retrying");
    expect(upload.retryCount).toBe(1);
    expect(upload.errorMessage).toBe("Network error");
  });

  it("should transition to retrying on second error", () => {
    const state = reduce(
      createState({
        uploads: {
          "upload-1": createYouTubeEntry({ retryCount: 1 }),
        },
      }),
      {
        type: "UPLOAD_ERROR",
        uploadId: "upload-1",
        errorMessage: "Network error again",
      }
    );

    const upload = state.uploads["upload-1"]!;
    expect(upload.status).toBe("retrying");
    expect(upload.retryCount).toBe(2);
  });

  it("should transition to error when retryCount reaches 3", () => {
    const state = reduce(
      createState({
        uploads: {
          "upload-1": createYouTubeEntry({ retryCount: 2 }),
        },
      }),
      {
        type: "UPLOAD_ERROR",
        uploadId: "upload-1",
        errorMessage: "Final failure",
      }
    );

    const upload = state.uploads["upload-1"]!;
    expect(upload.status).toBe("error");
    expect(upload.retryCount).toBe(3);
    expect(upload.errorMessage).toBe("Final failure");
  });

  it("should not modify state for non-existent upload", () => {
    const initial = createState();
    const state = reduce(initial, {
      type: "UPLOAD_ERROR",
      uploadId: "non-existent",
      errorMessage: "error",
    });

    expect(state).toBe(initial);
  });
});

describe("RETRY", () => {
  it("should reset status to uploading and progress to 0", () => {
    const state = reduce(
      createState({
        uploads: {
          "upload-1": createYouTubeEntry({
            status: "retrying",
            retryCount: 1,
            progress: 50,
          }),
        },
      }),
      { type: "RETRY", uploadId: "upload-1" }
    );

    const upload = state.uploads["upload-1"]!;
    expect(upload.status).toBe("uploading");
    expect(upload.progress).toBe(0);
    expect(upload.retryCount).toBe(1);
  });

  it("should not modify state for non-existent upload", () => {
    const initial = createState();
    const state = reduce(initial, {
      type: "RETRY",
      uploadId: "non-existent",
    });

    expect(state).toBe(initial);
  });

  it("should reset bufferStage to copying for buffer uploads", () => {
    const state = reduce(
      createState({
        uploads: {
          "upload-1": createBufferEntry({
            bufferStage: "syncing",
            status: "retrying",
            retryCount: 1,
          }),
        },
      }),
      { type: "RETRY", uploadId: "upload-1" }
    );

    const upload = state.uploads["upload-1"]!;
    expect(upload.uploadType === "buffer" && upload.bufferStage).toBe(
      "copying"
    );
  });

  it("should keep youtube type on retry", () => {
    const state = reduce(
      createState({
        uploads: {
          "upload-1": createYouTubeEntry({
            status: "retrying",
            retryCount: 1,
          }),
        },
      }),
      { type: "RETRY", uploadId: "upload-1" }
    );

    expect(state.uploads["upload-1"]!.uploadType).toBe("youtube");
  });

  it("should reset aiHeroSlug to null for ai-hero uploads", () => {
    const state = reduce(
      createState({
        uploads: {
          "upload-1": createAiHeroEntry({
            status: "retrying",
            retryCount: 1,
            aiHeroSlug: "old-slug~123",
          }),
        },
      }),
      { type: "RETRY", uploadId: "upload-1" }
    );

    const upload = state.uploads["upload-1"]!;
    expect(upload.uploadType).toBe("ai-hero");
    expect(upload.uploadType === "ai-hero" && upload.aiHeroSlug).toBeNull();
    expect(upload.status).toBe("uploading");
    expect(upload.progress).toBe(0);
  });
});

describe("DISMISS", () => {
  it("should remove upload from state", () => {
    const state = reduce(
      createState({
        uploads: {
          "upload-1": createYouTubeEntry({
            status: "success",
          }),
        },
      }),
      { type: "DISMISS", uploadId: "upload-1" }
    );

    expect(state.uploads["upload-1"]).toBeUndefined();
    expect(Object.keys(state.uploads)).toHaveLength(0);
  });

  it("should not affect other uploads", () => {
    const upload2 = createYouTubeEntry({
      uploadId: "upload-2",
      videoId: "video-2",
    });
    const state = reduce(
      createState({
        uploads: {
          "upload-1": createYouTubeEntry(),
          "upload-2": upload2,
        },
      }),
      { type: "DISMISS", uploadId: "upload-1" }
    );

    expect(state.uploads["upload-1"]).toBeUndefined();
    expect(state.uploads["upload-2"]).toEqual(upload2);
  });

  it("should handle dismissing non-existent upload gracefully", () => {
    const upload1 = createYouTubeEntry();
    const state = reduce(createState({ uploads: { "upload-1": upload1 } }), {
      type: "DISMISS",
      uploadId: "non-existent",
    });

    expect(state.uploads["upload-1"]).toEqual(upload1);
  });

  it("should allow dismissing an upload that is still uploading", () => {
    const state = reduce(
      createState({
        uploads: {
          "upload-1": createYouTubeEntry({
            status: "uploading",
            progress: 50,
          }),
        },
      }),
      { type: "DISMISS", uploadId: "upload-1" }
    );

    expect(state.uploads["upload-1"]).toBeUndefined();
  });
});
