export namespace uploadReducer {
  export type UploadStatus = "uploading" | "retrying" | "success" | "error";

  export interface UploadEntry {
    uploadId: string;
    videoId: string;
    title: string;
    progress: number;
    status: UploadStatus;
    youtubeVideoId: string | null;
    errorMessage: string | null;
    retryCount: number;
  }

  export interface State {
    uploads: Record<string, UploadEntry>;
  }

  export type Action =
    | {
        type: "START_UPLOAD";
        uploadId: string;
        videoId: string;
        title: string;
      }
    | { type: "UPDATE_PROGRESS"; uploadId: string; progress: number }
    | {
        type: "UPLOAD_SUCCESS";
        uploadId: string;
        youtubeVideoId: string;
      }
    | { type: "UPLOAD_ERROR"; uploadId: string; errorMessage: string }
    | { type: "RETRY"; uploadId: string }
    | { type: "DISMISS"; uploadId: string };
}

export const createInitialUploadState = (): uploadReducer.State => ({
  uploads: {},
});

export const uploadReducer = (
  state: uploadReducer.State,
  action: uploadReducer.Action
): uploadReducer.State => {
  switch (action.type) {
    case "START_UPLOAD": {
      return {
        ...state,
        uploads: {
          ...state.uploads,
          [action.uploadId]: {
            uploadId: action.uploadId,
            videoId: action.videoId,
            title: action.title,
            progress: 0,
            status: "uploading",
            youtubeVideoId: null,
            errorMessage: null,
            retryCount: 0,
          },
        },
      };
    }

    case "UPDATE_PROGRESS": {
      const upload = state.uploads[action.uploadId];
      if (!upload) return state;

      return {
        ...state,
        uploads: {
          ...state.uploads,
          [action.uploadId]: {
            ...upload,
            progress: action.progress,
          },
        },
      };
    }

    case "UPLOAD_SUCCESS": {
      const upload = state.uploads[action.uploadId];
      if (!upload) return state;

      return {
        ...state,
        uploads: {
          ...state.uploads,
          [action.uploadId]: {
            ...upload,
            status: "success",
            progress: 100,
            youtubeVideoId: action.youtubeVideoId,
            errorMessage: null,
          },
        },
      };
    }

    case "UPLOAD_ERROR": {
      const upload = state.uploads[action.uploadId];
      if (!upload) return state;

      const nextRetryCount = upload.retryCount + 1;

      if (nextRetryCount < 3) {
        return {
          ...state,
          uploads: {
            ...state.uploads,
            [action.uploadId]: {
              ...upload,
              status: "retrying",
              retryCount: nextRetryCount,
              errorMessage: action.errorMessage,
            },
          },
        };
      }

      return {
        ...state,
        uploads: {
          ...state.uploads,
          [action.uploadId]: {
            ...upload,
            status: "error",
            retryCount: nextRetryCount,
            errorMessage: action.errorMessage,
          },
        },
      };
    }

    case "RETRY": {
      const upload = state.uploads[action.uploadId];
      if (!upload) return state;

      return {
        ...state,
        uploads: {
          ...state.uploads,
          [action.uploadId]: {
            ...upload,
            status: "uploading",
            progress: 0,
          },
        },
      };
    }

    case "DISMISS": {
      const { [action.uploadId]: _, ...remaining } = state.uploads;
      return {
        ...state,
        uploads: remaining,
      };
    }

    default:
      return state;
  }
};
