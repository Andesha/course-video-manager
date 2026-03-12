import { useCallback, useMemo } from "react";
import type { FetcherWithComponents } from "react-router";
import type { WritePageAction } from "./write-page-reducer";

export function useVideoContextHandlers({
  videoId,
  transcript,
  isStandalone,
  openFolderFetcher,
  deleteLinkFetcher,
  dispatch,
}: {
  videoId: string;
  transcript: string;
  isStandalone: boolean;
  openFolderFetcher: FetcherWithComponents<unknown>;
  deleteLinkFetcher: FetcherWithComponents<unknown>;
  dispatch: React.Dispatch<WritePageAction>;
}) {
  const handleCopyTranscript = useCallback(
    () => navigator.clipboard.writeText(transcript),
    [transcript]
  );

  const handleIncludeCourseStructureChange = useCallback(
    (checked: boolean) => {
      dispatch({ type: "set-include-course-structure", value: checked });
    },
    [dispatch]
  );

  const handleFileClick = useCallback(
    (filePath: string) => {
      dispatch({ type: "open-preview-modal", filePath });
    },
    [dispatch]
  );

  const handleOpenFolderClick = useCallback(() => {
    openFolderFetcher.submit(null, {
      method: "post",
      action: `/api/videos/${videoId}/open-folder`,
    });
  }, [videoId, openFolderFetcher]);

  const handleAddFromClipboardClick = useMemo(
    () =>
      isStandalone
        ? () => dispatch({ type: "set-paste-modal-open", value: true })
        : () => dispatch({ type: "set-lesson-paste-modal-open", value: true }),
    [isStandalone, dispatch]
  );

  const handleDeleteFile = useCallback(
    (filename: string) => {
      dispatch({ type: "open-delete-modal", filename });
    },
    [dispatch]
  );

  const handleDeleteLink = useCallback(
    (linkId: string) => {
      deleteLinkFetcher.submit(null, {
        method: "post",
        action: `/api/links/${linkId}/delete`,
      });
    },
    [deleteLinkFetcher]
  );

  const handleAddLinkClick = useCallback(
    () => dispatch({ type: "set-add-link-modal-open", value: true }),
    [dispatch]
  );

  const handleMemoryEnabledChange = useCallback(
    (enabled: boolean) => {
      dispatch({ type: "set-memory-enabled", value: enabled });
    },
    [dispatch]
  );

  return {
    handleCopyTranscript,
    handleIncludeCourseStructureChange,
    handleFileClick,
    handleOpenFolderClick,
    handleAddFromClipboardClick,
    handleDeleteFile,
    handleDeleteLink,
    handleAddLinkClick,
    handleMemoryEnabledChange,
  };
}
