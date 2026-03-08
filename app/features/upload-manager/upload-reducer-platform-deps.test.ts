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

describe("ai-hero upload lifecycle", () => {
  it("should start ai-hero upload with correct initial state", () => {
    const state = reduce(createState(), {
      type: "START_UPLOAD",
      uploadId: "ah-1",
      videoId: "video-1",
      title: "AI Hero Post",
      uploadType: "ai-hero",
    });

    expect(state.uploads["ah-1"]).toEqual({
      uploadId: "ah-1",
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

  it("should update progress for ai-hero upload", () => {
    let state = createState({
      uploads: { "ah-1": createAiHeroEntry({ uploadId: "ah-1" }) },
    });

    state = reduce(state, {
      type: "UPDATE_PROGRESS",
      uploadId: "ah-1",
      progress: 65,
    });

    expect(state.uploads["ah-1"]!.progress).toBe(65);
  });

  it("should complete ai-hero upload with slug", () => {
    let state = createState({
      uploads: {
        "ah-1": createAiHeroEntry({ uploadId: "ah-1", progress: 95 }),
      },
    });

    state = reduce(state, {
      type: "UPLOAD_SUCCESS",
      uploadId: "ah-1",
      aiHeroSlug: "my-article~abc123",
    });

    const upload = state.uploads["ah-1"]!;
    expect(upload.status).toBe("success");
    expect(upload.progress).toBe(100);
    expect(upload.uploadType).toBe("ai-hero");
    expect(upload.uploadType === "ai-hero" && upload.aiHeroSlug).toBe(
      "my-article~abc123"
    );
    expect(upload.errorMessage).toBeNull();
  });

  it("should handle ai-hero upload error", () => {
    let state = createState({
      uploads: {
        "ah-1": createAiHeroEntry({ uploadId: "ah-1", progress: 40 }),
      },
    });

    state = reduce(state, {
      type: "UPLOAD_ERROR",
      uploadId: "ah-1",
      errorMessage: "S3 upload failed",
    });

    expect(state.uploads["ah-1"]!.status).toBe("retrying");
    expect(state.uploads["ah-1"]!.retryCount).toBe(1);
    expect(state.uploads["ah-1"]!.errorMessage).toBe("S3 upload failed");
  });

  it("should retry ai-hero upload resetting progress and slug", () => {
    let state = createState({
      uploads: {
        "ah-1": createAiHeroEntry({
          uploadId: "ah-1",
          status: "retrying",
          retryCount: 1,
          progress: 40,
        }),
      },
    });

    state = reduce(state, { type: "RETRY", uploadId: "ah-1" });

    const upload = state.uploads["ah-1"]!;
    expect(upload.status).toBe("uploading");
    expect(upload.progress).toBe(0);
    expect(upload.uploadType).toBe("ai-hero");
    expect(upload.uploadType === "ai-hero" && upload.aiHeroSlug).toBeNull();
  });

  it("should dismiss ai-hero upload", () => {
    let state = createState({
      uploads: {
        "ah-1": createAiHeroEntry({ uploadId: "ah-1" }),
      },
    });

    state = reduce(state, { type: "DISMISS", uploadId: "ah-1" });
    expect(state.uploads["ah-1"]).toBeUndefined();
  });

  it("should go through full ai-hero lifecycle: start → progress → success", () => {
    let state = createState();

    // Start
    state = reduce(state, {
      type: "START_UPLOAD",
      uploadId: "ah-1",
      videoId: "video-1",
      title: "My AI Hero Article",
      uploadType: "ai-hero",
    });
    expect(state.uploads["ah-1"]!.status).toBe("uploading");
    expect(state.uploads["ah-1"]!.uploadType).toBe("ai-hero");

    // Progress
    state = reduce(state, {
      type: "UPDATE_PROGRESS",
      uploadId: "ah-1",
      progress: 25,
    });
    state = reduce(state, {
      type: "UPDATE_PROGRESS",
      uploadId: "ah-1",
      progress: 50,
    });
    state = reduce(state, {
      type: "UPDATE_PROGRESS",
      uploadId: "ah-1",
      progress: 90,
    });
    expect(state.uploads["ah-1"]!.progress).toBe(90);

    // Success
    state = reduce(state, {
      type: "UPLOAD_SUCCESS",
      uploadId: "ah-1",
      aiHeroSlug: "my-ai-hero-article~def456",
    });

    const upload = state.uploads["ah-1"]!;
    expect(upload.status).toBe("success");
    expect(upload.progress).toBe(100);
    expect(upload.uploadType === "ai-hero" && upload.aiHeroSlug).toBe(
      "my-ai-hero-article~def456"
    );
  });

  it("should go through full ai-hero lifecycle: start → error → retry → success", () => {
    let state = createState();

    // Start
    state = reduce(state, {
      type: "START_UPLOAD",
      uploadId: "ah-1",
      videoId: "video-1",
      title: "Flaky AI Hero Post",
      uploadType: "ai-hero",
    });

    // Progress then error
    state = reduce(state, {
      type: "UPDATE_PROGRESS",
      uploadId: "ah-1",
      progress: 60,
    });
    state = reduce(state, {
      type: "UPLOAD_ERROR",
      uploadId: "ah-1",
      errorMessage: "Connection reset",
    });
    expect(state.uploads["ah-1"]!.status).toBe("retrying");
    expect(state.uploads["ah-1"]!.retryCount).toBe(1);

    // Retry
    state = reduce(state, { type: "RETRY", uploadId: "ah-1" });
    expect(state.uploads["ah-1"]!.status).toBe("uploading");
    expect(state.uploads["ah-1"]!.progress).toBe(0);

    // Success on retry
    state = reduce(state, {
      type: "UPDATE_PROGRESS",
      uploadId: "ah-1",
      progress: 100,
    });
    state = reduce(state, {
      type: "UPLOAD_SUCCESS",
      uploadId: "ah-1",
      aiHeroSlug: "recovered-post~ghi789",
    });

    const upload = state.uploads["ah-1"]!;
    expect(upload.status).toBe("success");
    expect(upload.retryCount).toBe(1);
    expect(upload.uploadType === "ai-hero" && upload.aiHeroSlug).toBe(
      "recovered-post~ghi789"
    );
  });

  it("should go through full ai-hero retry lifecycle to final error", () => {
    let state = createState();

    state = reduce(state, {
      type: "START_UPLOAD",
      uploadId: "ah-1",
      videoId: "video-1",
      title: "Doomed AI Hero Post",
      uploadType: "ai-hero",
    });

    // First error → retrying
    state = reduce(state, {
      type: "UPLOAD_ERROR",
      uploadId: "ah-1",
      errorMessage: "Error 1",
    });
    expect(state.uploads["ah-1"]!.status).toBe("retrying");
    state = reduce(state, { type: "RETRY", uploadId: "ah-1" });

    // Second error → retrying
    state = reduce(state, {
      type: "UPLOAD_ERROR",
      uploadId: "ah-1",
      errorMessage: "Error 2",
    });
    expect(state.uploads["ah-1"]!.status).toBe("retrying");
    state = reduce(state, { type: "RETRY", uploadId: "ah-1" });

    // Third error → final error
    state = reduce(state, {
      type: "UPLOAD_ERROR",
      uploadId: "ah-1",
      errorMessage: "Error 3",
    });
    expect(state.uploads["ah-1"]!.status).toBe("error");
    expect(state.uploads["ah-1"]!.retryCount).toBe(3);
    expect(state.uploads["ah-1"]!.errorMessage).toBe("Error 3");
  });
});

describe("export upload lifecycle", () => {
  it("should progress through all export stages to success", () => {
    let state = createState();

    // Start export
    state = reduce(state, {
      type: "START_UPLOAD",
      uploadId: "exp-1",
      videoId: "video-1",
      title: "Export Video",
      uploadType: "export",
    });
    const started = state.uploads["exp-1"]!;
    expect(started.uploadType === "export" && started.exportStage).toBe(
      "queued"
    );

    // Transition to concatenating-clips
    state = reduce(state, {
      type: "UPDATE_EXPORT_STAGE",
      uploadId: "exp-1",
      stage: "concatenating-clips",
    });
    const concatenating = state.uploads["exp-1"]!;
    expect(
      concatenating.uploadType === "export" && concatenating.exportStage
    ).toBe("concatenating-clips");

    // Transition to normalizing-audio
    state = reduce(state, {
      type: "UPDATE_EXPORT_STAGE",
      uploadId: "exp-1",
      stage: "normalizing-audio",
    });
    const normalizing = state.uploads["exp-1"]!;
    expect(normalizing.uploadType === "export" && normalizing.exportStage).toBe(
      "normalizing-audio"
    );

    // Success
    state = reduce(state, {
      type: "UPLOAD_SUCCESS",
      uploadId: "exp-1",
    });
    const success = state.uploads["exp-1"]!;
    expect(success.status).toBe("success");
    expect(success.uploadType === "export" && success.exportStage).toBeNull();
    expect(success.progress).toBe(100);
  });

  it("should progress through queued → concatenating-clips → normalizing-audio → success", () => {
    let state = createState();

    // Start export with queued stage
    state = reduce(state, {
      type: "START_UPLOAD",
      uploadId: "exp-1",
      videoId: "video-1",
      title: "Export Video",
      uploadType: "export",
    });

    // Set to queued (batch export waiting for GPU semaphore)
    state = reduce(state, {
      type: "UPDATE_EXPORT_STAGE",
      uploadId: "exp-1",
      stage: "queued",
    });
    const queued = state.uploads["exp-1"]!;
    expect(queued.uploadType === "export" && queued.exportStage).toBe("queued");

    // Transition to concatenating-clips (GPU semaphore acquired)
    state = reduce(state, {
      type: "UPDATE_EXPORT_STAGE",
      uploadId: "exp-1",
      stage: "concatenating-clips",
    });
    const concatenating = state.uploads["exp-1"]!;
    expect(
      concatenating.uploadType === "export" && concatenating.exportStage
    ).toBe("concatenating-clips");

    // Transition to normalizing-audio
    state = reduce(state, {
      type: "UPDATE_EXPORT_STAGE",
      uploadId: "exp-1",
      stage: "normalizing-audio",
    });
    const normalizing = state.uploads["exp-1"]!;
    expect(normalizing.uploadType === "export" && normalizing.exportStage).toBe(
      "normalizing-audio"
    );

    // Success
    state = reduce(state, {
      type: "UPLOAD_SUCCESS",
      uploadId: "exp-1",
    });
    const success = state.uploads["exp-1"]!;
    expect(success.status).toBe("success");
    expect(success.uploadType === "export" && success.exportStage).toBeNull();
    expect(success.progress).toBe(100);
  });

  it("should reset exportStage to queued on retry", () => {
    let state = reduce(createState(), {
      type: "START_UPLOAD",
      uploadId: "exp-1",
      videoId: "video-1",
      title: "Retrying Export",
      uploadType: "export",
    });

    // Advance to normalizing-audio then error
    state = reduce(state, {
      type: "UPDATE_EXPORT_STAGE",
      uploadId: "exp-1",
      stage: "normalizing-audio",
    });
    state = reduce(state, {
      type: "UPLOAD_ERROR",
      uploadId: "exp-1",
      errorMessage: "FFmpeg crashed",
    });

    expect(state.uploads["exp-1"]!.status).toBe("retrying");

    // Retry resets to queued
    state = reduce(state, { type: "RETRY", uploadId: "exp-1" });
    const retried = state.uploads["exp-1"]!;
    expect(retried.status).toBe("uploading");
    expect(retried.uploadType === "export" && retried.exportStage).toBe(
      "queued"
    );
    expect(retried.progress).toBe(0);
  });

  it("should dismiss export upload", () => {
    let state = createState({
      uploads: {
        "exp-1": createExportEntry({ uploadId: "exp-1" }),
      },
    });

    state = reduce(state, { type: "DISMISS", uploadId: "exp-1" });
    expect(state.uploads["exp-1"]).toBeUndefined();
  });
});

describe("job dependencies", () => {
  it("should start job in waiting status when dependsOn is set", () => {
    let state = createState();

    // Start export job
    state = reduce(state, {
      type: "START_UPLOAD",
      uploadId: "export-1",
      videoId: "video-1",
      title: "Export Video",
      uploadType: "export",
    });

    // Start YouTube upload with dependency on export
    state = reduce(state, {
      type: "START_UPLOAD",
      uploadId: "yt-1",
      videoId: "video-1",
      title: "Upload to YouTube",
      uploadType: "youtube",
      dependsOn: "export-1",
    });

    expect(state.uploads["yt-1"]!.status).toBe("waiting");
    expect(state.uploads["yt-1"]!.dependsOn).toBe("export-1");
  });

  it("should activate waiting job when dependency succeeds", () => {
    let state = createState();

    // Start export
    state = reduce(state, {
      type: "START_UPLOAD",
      uploadId: "export-1",
      videoId: "video-1",
      title: "Export Video",
      uploadType: "export",
    });

    // Start upload depending on export
    state = reduce(state, {
      type: "START_UPLOAD",
      uploadId: "yt-1",
      videoId: "video-1",
      title: "Upload to YouTube",
      dependsOn: "export-1",
    });
    expect(state.uploads["yt-1"]!.status).toBe("waiting");

    // Complete export
    state = reduce(state, {
      type: "UPLOAD_SUCCESS",
      uploadId: "export-1",
    });

    expect(state.uploads["export-1"]!.status).toBe("success");
    expect(state.uploads["yt-1"]!.status).toBe("uploading");
  });

  it("should fail waiting job when dependency fails permanently", () => {
    let state = createState();

    // Start export
    state = reduce(state, {
      type: "START_UPLOAD",
      uploadId: "export-1",
      videoId: "video-1",
      title: "Export Video",
      uploadType: "export",
    });

    // Start upload depending on export
    state = reduce(state, {
      type: "START_UPLOAD",
      uploadId: "yt-1",
      videoId: "video-1",
      title: "Upload to YouTube",
      dependsOn: "export-1",
    });

    // Exhaust retries (3 errors)
    state = reduce(state, {
      type: "UPLOAD_ERROR",
      uploadId: "export-1",
      errorMessage: "Error 1",
    });
    state = reduce(state, { type: "RETRY", uploadId: "export-1" });
    state = reduce(state, {
      type: "UPLOAD_ERROR",
      uploadId: "export-1",
      errorMessage: "Error 2",
    });
    state = reduce(state, { type: "RETRY", uploadId: "export-1" });
    state = reduce(state, {
      type: "UPLOAD_ERROR",
      uploadId: "export-1",
      errorMessage: "Error 3",
    });

    expect(state.uploads["export-1"]!.status).toBe("error");
    expect(state.uploads["yt-1"]!.status).toBe("error");
    expect(state.uploads["yt-1"]!.errorMessage).toBe(
      'Dependency "Export Video" failed'
    );
  });

  it("should not affect waiting job when dependency is retrying", () => {
    let state = createState();

    state = reduce(state, {
      type: "START_UPLOAD",
      uploadId: "export-1",
      videoId: "video-1",
      title: "Export Video",
      uploadType: "export",
    });

    state = reduce(state, {
      type: "START_UPLOAD",
      uploadId: "yt-1",
      videoId: "video-1",
      title: "Upload to YouTube",
      dependsOn: "export-1",
    });

    // First error triggers retry, not final failure
    state = reduce(state, {
      type: "UPLOAD_ERROR",
      uploadId: "export-1",
      errorMessage: "Transient error",
    });

    expect(state.uploads["export-1"]!.status).toBe("retrying");
    expect(state.uploads["yt-1"]!.status).toBe("waiting");
  });

  it("should activate multiple waiting jobs when dependency succeeds", () => {
    let state = createState();

    state = reduce(state, {
      type: "START_UPLOAD",
      uploadId: "export-1",
      videoId: "video-1",
      title: "Export Video",
      uploadType: "export",
    });

    state = reduce(state, {
      type: "START_UPLOAD",
      uploadId: "yt-1",
      videoId: "video-1",
      title: "Upload to YouTube",
      dependsOn: "export-1",
    });

    state = reduce(state, {
      type: "START_UPLOAD",
      uploadId: "ah-1",
      videoId: "video-1",
      title: "Post to AI Hero",
      uploadType: "ai-hero",
      dependsOn: "export-1",
    });

    expect(state.uploads["yt-1"]!.status).toBe("waiting");
    expect(state.uploads["ah-1"]!.status).toBe("waiting");

    state = reduce(state, {
      type: "UPLOAD_SUCCESS",
      uploadId: "export-1",
    });

    expect(state.uploads["yt-1"]!.status).toBe("uploading");
    expect(state.uploads["ah-1"]!.status).toBe("uploading");
  });

  it("should preserve dependsOn through retry", () => {
    let state = createState();

    state = reduce(state, {
      type: "START_UPLOAD",
      uploadId: "export-1",
      videoId: "video-1",
      title: "Export Video",
      uploadType: "export",
    });

    // Complete export
    state = reduce(state, {
      type: "UPLOAD_SUCCESS",
      uploadId: "export-1",
    });

    // Start dependent upload (it goes straight to uploading since dep is done)
    // But if we create it before success with dependsOn, then it becomes uploading
    // Let's test that dependsOn is preserved through retry cycle
    let stateWithDep = createState({
      uploads: {
        "yt-1": createYouTubeEntry({
          uploadId: "yt-1",
          status: "uploading",
          dependsOn: "export-1",
        }),
      },
    });

    // Error then retry
    stateWithDep = reduce(stateWithDep, {
      type: "UPLOAD_ERROR",
      uploadId: "yt-1",
      errorMessage: "Timeout",
    });
    stateWithDep = reduce(stateWithDep, { type: "RETRY", uploadId: "yt-1" });

    expect(stateWithDep.uploads["yt-1"]!.dependsOn).toBe("export-1");
  });

  it("should start job in uploading status when no dependsOn is set", () => {
    const state = reduce(createState(), {
      type: "START_UPLOAD",
      uploadId: "yt-1",
      videoId: "video-1",
      title: "Upload to YouTube",
    });

    expect(state.uploads["yt-1"]!.status).toBe("uploading");
    expect(state.uploads["yt-1"]!.dependsOn).toBeNull();
  });
});
