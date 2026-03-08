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

describe("multiple concurrent uploads", () => {
  it("should handle starting multiple uploads", () => {
    let state = createState();

    state = reduce(state, {
      type: "START_UPLOAD",
      uploadId: "upload-1",
      videoId: "video-1",
      title: "First Video",
    });
    state = reduce(state, {
      type: "START_UPLOAD",
      uploadId: "upload-2",
      videoId: "video-2",
      title: "Second Video",
    });
    state = reduce(state, {
      type: "START_UPLOAD",
      uploadId: "upload-3",
      videoId: "video-3",
      title: "Third Video",
    });

    expect(Object.keys(state.uploads)).toHaveLength(3);
    expect(state.uploads["upload-1"]!.title).toBe("First Video");
    expect(state.uploads["upload-2"]!.title).toBe("Second Video");
    expect(state.uploads["upload-3"]!.title).toBe("Third Video");
  });

  it("should update progress independently per upload", () => {
    let state = createState({
      uploads: {
        "upload-1": createYouTubeEntry({ uploadId: "upload-1" }),
        "upload-2": createYouTubeEntry({ uploadId: "upload-2" }),
      },
    });

    state = reduce(state, {
      type: "UPDATE_PROGRESS",
      uploadId: "upload-1",
      progress: 75,
    });
    state = reduce(state, {
      type: "UPDATE_PROGRESS",
      uploadId: "upload-2",
      progress: 30,
    });

    expect(state.uploads["upload-1"]!.progress).toBe(75);
    expect(state.uploads["upload-2"]!.progress).toBe(30);
  });

  it("should handle mixed statuses across uploads", () => {
    let state = createState({
      uploads: {
        "upload-1": createYouTubeEntry({ uploadId: "upload-1" }),
        "upload-2": createYouTubeEntry({ uploadId: "upload-2" }),
        "upload-3": createYouTubeEntry({
          uploadId: "upload-3",
          retryCount: 2,
        }),
      },
    });

    state = reduce(state, {
      type: "UPLOAD_SUCCESS",
      uploadId: "upload-1",
      youtubeVideoId: "yt-1",
    });
    state = reduce(state, {
      type: "UPLOAD_ERROR",
      uploadId: "upload-2",
      errorMessage: "failed",
    });
    state = reduce(state, {
      type: "UPLOAD_ERROR",
      uploadId: "upload-3",
      errorMessage: "final fail",
    });

    expect(state.uploads["upload-1"]!.status).toBe("success");
    expect(state.uploads["upload-2"]!.status).toBe("retrying");
    expect(state.uploads["upload-3"]!.status).toBe("error");
  });

  it("should handle concurrent youtube and buffer uploads", () => {
    let state = createState();

    state = reduce(state, {
      type: "START_UPLOAD",
      uploadId: "yt-1",
      videoId: "video-1",
      title: "YouTube Upload",
      uploadType: "youtube",
    });
    state = reduce(state, {
      type: "START_UPLOAD",
      uploadId: "buf-1",
      videoId: "video-1",
      title: "Buffer Post",
      uploadType: "buffer",
    });

    expect(state.uploads["yt-1"]!.uploadType).toBe("youtube");
    expect(state.uploads["buf-1"]!.uploadType).toBe("buffer");

    const bufUpload = state.uploads["buf-1"]!;
    expect(bufUpload.uploadType === "buffer" && bufUpload.bufferStage).toBe(
      "copying"
    );

    // Progress YouTube
    state = reduce(state, {
      type: "UPDATE_PROGRESS",
      uploadId: "yt-1",
      progress: 50,
    });
    // Progress Buffer through stages
    state = reduce(state, {
      type: "UPDATE_PROGRESS",
      uploadId: "buf-1",
      progress: 100,
    });
    state = reduce(state, {
      type: "UPDATE_BUFFER_STAGE",
      uploadId: "buf-1",
      stage: "syncing",
    });

    expect(state.uploads["yt-1"]!.progress).toBe(50);
    const bufAfterStage = state.uploads["buf-1"]!;
    expect(
      bufAfterStage.uploadType === "buffer" && bufAfterStage.bufferStage
    ).toBe("syncing");

    // Complete both
    state = reduce(state, {
      type: "UPLOAD_SUCCESS",
      uploadId: "yt-1",
      youtubeVideoId: "yt-abc",
    });
    state = reduce(state, {
      type: "UPLOAD_SUCCESS",
      uploadId: "buf-1",
    });

    expect(state.uploads["yt-1"]!.status).toBe("success");
    const ytSuccess = state.uploads["yt-1"]!;
    expect(ytSuccess.uploadType === "youtube" && ytSuccess.youtubeVideoId).toBe(
      "yt-abc"
    );
    expect(state.uploads["buf-1"]!.status).toBe("success");
    const bufSuccess = state.uploads["buf-1"]!;
    expect(
      bufSuccess.uploadType === "buffer" && bufSuccess.bufferStage
    ).toBeNull();
  });

  it("should handle concurrent uploads across all three types", () => {
    let state = createState();

    state = reduce(state, {
      type: "START_UPLOAD",
      uploadId: "yt-1",
      videoId: "video-1",
      title: "YouTube Upload",
      uploadType: "youtube",
    });
    state = reduce(state, {
      type: "START_UPLOAD",
      uploadId: "buf-1",
      videoId: "video-1",
      title: "Buffer Post",
      uploadType: "buffer",
    });
    state = reduce(state, {
      type: "START_UPLOAD",
      uploadId: "ah-1",
      videoId: "video-1",
      title: "AI Hero Post",
      uploadType: "ai-hero",
    });

    expect(Object.keys(state.uploads)).toHaveLength(3);
    expect(state.uploads["yt-1"]!.uploadType).toBe("youtube");
    expect(state.uploads["buf-1"]!.uploadType).toBe("buffer");
    expect(state.uploads["ah-1"]!.uploadType).toBe("ai-hero");

    // Progress all three
    state = reduce(state, {
      type: "UPDATE_PROGRESS",
      uploadId: "yt-1",
      progress: 30,
    });
    state = reduce(state, {
      type: "UPDATE_PROGRESS",
      uploadId: "buf-1",
      progress: 60,
    });
    state = reduce(state, {
      type: "UPDATE_PROGRESS",
      uploadId: "ah-1",
      progress: 45,
    });

    expect(state.uploads["yt-1"]!.progress).toBe(30);
    expect(state.uploads["buf-1"]!.progress).toBe(60);
    expect(state.uploads["ah-1"]!.progress).toBe(45);

    // Complete all three
    state = reduce(state, {
      type: "UPLOAD_SUCCESS",
      uploadId: "yt-1",
      youtubeVideoId: "yt-abc",
    });
    state = reduce(state, {
      type: "UPLOAD_SUCCESS",
      uploadId: "buf-1",
    });
    state = reduce(state, {
      type: "UPLOAD_SUCCESS",
      uploadId: "ah-1",
      aiHeroSlug: "my-post~xyz",
    });

    expect(state.uploads["yt-1"]!.status).toBe("success");
    expect(state.uploads["buf-1"]!.status).toBe("success");
    expect(state.uploads["ah-1"]!.status).toBe("success");

    const ahSuccess = state.uploads["ah-1"]!;
    expect(ahSuccess.uploadType === "ai-hero" && ahSuccess.aiHeroSlug).toBe(
      "my-post~xyz"
    );
  });
});

describe("full retry lifecycle", () => {
  it("should go through 3 retries then final error", () => {
    let state = createState();

    // Start upload
    state = reduce(state, {
      type: "START_UPLOAD",
      uploadId: "upload-1",
      videoId: "video-1",
      title: "Flaky Upload",
    });
    expect(state.uploads["upload-1"]!.status).toBe("uploading");

    // First error → retrying (retryCount 1)
    state = reduce(state, {
      type: "UPLOAD_ERROR",
      uploadId: "upload-1",
      errorMessage: "Error 1",
    });
    expect(state.uploads["upload-1"]!.status).toBe("retrying");
    expect(state.uploads["upload-1"]!.retryCount).toBe(1);

    // Context provider would observe "retrying" and call RETRY
    state = reduce(state, { type: "RETRY", uploadId: "upload-1" });
    expect(state.uploads["upload-1"]!.status).toBe("uploading");

    // Second error → retrying (retryCount 2)
    state = reduce(state, {
      type: "UPLOAD_ERROR",
      uploadId: "upload-1",
      errorMessage: "Error 2",
    });
    expect(state.uploads["upload-1"]!.status).toBe("retrying");
    expect(state.uploads["upload-1"]!.retryCount).toBe(2);

    state = reduce(state, { type: "RETRY", uploadId: "upload-1" });
    expect(state.uploads["upload-1"]!.status).toBe("uploading");

    // Third error → final error (retryCount 3)
    state = reduce(state, {
      type: "UPLOAD_ERROR",
      uploadId: "upload-1",
      errorMessage: "Error 3",
    });
    expect(state.uploads["upload-1"]!.status).toBe("error");
    expect(state.uploads["upload-1"]!.retryCount).toBe(3);
    expect(state.uploads["upload-1"]!.errorMessage).toBe("Error 3");
  });

  it("should succeed after retries", () => {
    let state = createState();

    state = reduce(state, {
      type: "START_UPLOAD",
      uploadId: "upload-1",
      videoId: "video-1",
      title: "Eventually Succeeds",
    });

    // First error → retrying
    state = reduce(state, {
      type: "UPLOAD_ERROR",
      uploadId: "upload-1",
      errorMessage: "Transient error",
    });
    state = reduce(state, { type: "RETRY", uploadId: "upload-1" });

    // Succeeds on retry
    state = reduce(state, {
      type: "UPLOAD_SUCCESS",
      uploadId: "upload-1",
      youtubeVideoId: "yt-success",
    });

    expect(state.uploads["upload-1"]!.status).toBe("success");
    const upload = state.uploads["upload-1"]!;
    expect(upload.uploadType === "youtube" && upload.youtubeVideoId).toBe(
      "yt-success"
    );
    expect(upload.retryCount).toBe(1);
  });
});

describe("buffer upload lifecycle", () => {
  it("should progress through all buffer stages to success", () => {
    let state = createState();

    // Start buffer upload
    state = reduce(state, {
      type: "START_UPLOAD",
      uploadId: "buf-1",
      videoId: "video-1",
      title: "Social Post",
      uploadType: "buffer",
    });
    const started = state.uploads["buf-1"]!;
    expect(started.uploadType === "buffer" && started.bufferStage).toBe(
      "copying"
    );
    expect(started.uploadType).toBe("buffer");

    // Copying progress
    state = reduce(state, {
      type: "UPDATE_PROGRESS",
      uploadId: "buf-1",
      progress: 50,
    });
    expect(state.uploads["buf-1"]!.progress).toBe(50);

    state = reduce(state, {
      type: "UPDATE_PROGRESS",
      uploadId: "buf-1",
      progress: 100,
    });

    // Transition to syncing
    state = reduce(state, {
      type: "UPDATE_BUFFER_STAGE",
      uploadId: "buf-1",
      stage: "syncing",
    });
    const syncing = state.uploads["buf-1"]!;
    expect(syncing.uploadType === "buffer" && syncing.bufferStage).toBe(
      "syncing"
    );

    // Transition to sending-webhook
    state = reduce(state, {
      type: "UPDATE_BUFFER_STAGE",
      uploadId: "buf-1",
      stage: "sending-webhook",
    });
    const webhook = state.uploads["buf-1"]!;
    expect(webhook.uploadType === "buffer" && webhook.bufferStage).toBe(
      "sending-webhook"
    );

    // Success
    state = reduce(state, {
      type: "UPLOAD_SUCCESS",
      uploadId: "buf-1",
    });
    const success = state.uploads["buf-1"]!;
    expect(success.status).toBe("success");
    expect(success.uploadType === "buffer" && success.bufferStage).toBeNull();
    expect(success.progress).toBe(100);
  });

  it("should handle error during copying stage", () => {
    let state = reduce(createState(), {
      type: "START_UPLOAD",
      uploadId: "buf-1",
      videoId: "video-1",
      title: "Failing Copy",
      uploadType: "buffer",
    });

    state = reduce(state, {
      type: "UPDATE_PROGRESS",
      uploadId: "buf-1",
      progress: 30,
    });

    state = reduce(state, {
      type: "UPLOAD_ERROR",
      uploadId: "buf-1",
      errorMessage: "Disk full",
    });

    expect(state.uploads["buf-1"]!.status).toBe("retrying");
    expect(state.uploads["buf-1"]!.retryCount).toBe(1);
    expect(state.uploads["buf-1"]!.errorMessage).toBe("Disk full");
  });

  it("should handle error during syncing stage", () => {
    let state = reduce(createState(), {
      type: "START_UPLOAD",
      uploadId: "buf-1",
      videoId: "video-1",
      title: "Sync Fail",
      uploadType: "buffer",
    });

    state = reduce(state, {
      type: "UPDATE_BUFFER_STAGE",
      uploadId: "buf-1",
      stage: "syncing",
    });

    state = reduce(state, {
      type: "UPLOAD_ERROR",
      uploadId: "buf-1",
      errorMessage: "Dropbox sync timeout",
    });

    expect(state.uploads["buf-1"]!.status).toBe("retrying");
    expect(state.uploads["buf-1"]!.errorMessage).toBe("Dropbox sync timeout");
  });

  it("should handle error during sending-webhook stage", () => {
    let state = reduce(createState(), {
      type: "START_UPLOAD",
      uploadId: "buf-1",
      videoId: "video-1",
      title: "Webhook Fail",
      uploadType: "buffer",
    });

    state = reduce(state, {
      type: "UPDATE_BUFFER_STAGE",
      uploadId: "buf-1",
      stage: "sending-webhook",
    });

    state = reduce(state, {
      type: "UPLOAD_ERROR",
      uploadId: "buf-1",
      errorMessage: "Zapier webhook failed (500)",
    });

    expect(state.uploads["buf-1"]!.status).toBe("retrying");
  });

  it("should reset bufferStage to copying on retry", () => {
    let state = reduce(createState(), {
      type: "START_UPLOAD",
      uploadId: "buf-1",
      videoId: "video-1",
      title: "Retrying Buffer",
      uploadType: "buffer",
    });

    // Advance to syncing then error
    state = reduce(state, {
      type: "UPDATE_BUFFER_STAGE",
      uploadId: "buf-1",
      stage: "syncing",
    });
    state = reduce(state, {
      type: "UPLOAD_ERROR",
      uploadId: "buf-1",
      errorMessage: "Sync error",
    });

    expect(state.uploads["buf-1"]!.status).toBe("retrying");

    // Retry resets to copying
    state = reduce(state, { type: "RETRY", uploadId: "buf-1" });
    const retried = state.uploads["buf-1"]!;
    expect(retried.status).toBe("uploading");
    expect(retried.uploadType === "buffer" && retried.bufferStage).toBe(
      "copying"
    );
    expect(retried.progress).toBe(0);
  });

  it("should go through full retry lifecycle for buffer upload", () => {
    let state = reduce(createState(), {
      type: "START_UPLOAD",
      uploadId: "buf-1",
      videoId: "video-1",
      title: "Flaky Buffer",
      uploadType: "buffer",
    });

    // First attempt fails during syncing
    state = reduce(state, {
      type: "UPDATE_BUFFER_STAGE",
      uploadId: "buf-1",
      stage: "syncing",
    });
    state = reduce(state, {
      type: "UPLOAD_ERROR",
      uploadId: "buf-1",
      errorMessage: "Error 1",
    });
    expect(state.uploads["buf-1"]!.status).toBe("retrying");

    state = reduce(state, { type: "RETRY", uploadId: "buf-1" });
    const afterRetry = state.uploads["buf-1"]!;
    expect(afterRetry.uploadType === "buffer" && afterRetry.bufferStage).toBe(
      "copying"
    );

    // Second attempt fails during webhook
    state = reduce(state, {
      type: "UPDATE_BUFFER_STAGE",
      uploadId: "buf-1",
      stage: "sending-webhook",
    });
    state = reduce(state, {
      type: "UPLOAD_ERROR",
      uploadId: "buf-1",
      errorMessage: "Error 2",
    });
    expect(state.uploads["buf-1"]!.status).toBe("retrying");

    state = reduce(state, { type: "RETRY", uploadId: "buf-1" });

    // Third attempt fails → final error
    state = reduce(state, {
      type: "UPLOAD_ERROR",
      uploadId: "buf-1",
      errorMessage: "Error 3",
    });
    expect(state.uploads["buf-1"]!.status).toBe("error");
    expect(state.uploads["buf-1"]!.retryCount).toBe(3);
  });

  it("should dismiss buffer upload", () => {
    let state = reduce(createState(), {
      type: "START_UPLOAD",
      uploadId: "buf-1",
      videoId: "video-1",
      title: "Buffer to Dismiss",
      uploadType: "buffer",
    });

    state = reduce(state, { type: "DISMISS", uploadId: "buf-1" });
    expect(state.uploads["buf-1"]).toBeUndefined();
  });
});
