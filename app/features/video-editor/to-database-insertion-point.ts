import type {
  ApiInsertionPoint,
  FrontendInsertionPoint,
  TimelineItem,
} from "./clip-state-reducer";

export const toDatabaseInsertionPoint = (
  insertionPoint: FrontendInsertionPoint,
  items: TimelineItem[]
): ApiInsertionPoint => {
  if (insertionPoint.type === "start") {
    return { type: "start" };
  }
  if (insertionPoint.type === "after-clip") {
    const frontendClipIndex = items.findIndex(
      (c) => c.frontendId === insertionPoint.frontendClipId
    );
    if (frontendClipIndex === -1) {
      throw new Error("Clip not found");
    }

    const previousPersistedItem = items
      .slice(0, frontendClipIndex + 1)
      .findLast(
        (c) => c.type === "on-database" || c.type === "clip-section-on-database"
      );

    if (!previousPersistedItem) {
      return { type: "start" };
    }

    if (previousPersistedItem.type === "clip-section-on-database") {
      return {
        type: "after-clip-section",
        clipSectionId: previousPersistedItem.databaseId,
      };
    }

    return {
      type: "after-clip",
      databaseClipId: previousPersistedItem.databaseId,
    };
  }

  if (insertionPoint.type === "after-clip-section") {
    const frontendClipSectionIndex = items.findIndex(
      (c) => c.frontendId === insertionPoint.frontendClipSectionId
    );
    if (frontendClipSectionIndex === -1) {
      throw new Error("Clip section not found");
    }

    const section = items[frontendClipSectionIndex]!;

    // If the section is persisted, use the new after-clip-section API type
    if (section.type === "clip-section-on-database") {
      return {
        type: "after-clip-section",
        clipSectionId: section.databaseId,
      };
    }

    // Optimistic section (no DB ID yet) — fall back to last persisted item before it
    const previousPersistedItem = items
      .slice(0, frontendClipSectionIndex + 1)
      .findLast(
        (c) => c.type === "on-database" || c.type === "clip-section-on-database"
      );

    if (!previousPersistedItem) {
      return { type: "start" };
    }

    if (previousPersistedItem.type === "clip-section-on-database") {
      return {
        type: "after-clip-section",
        clipSectionId: previousPersistedItem.databaseId,
      };
    }

    return {
      type: "after-clip",
      databaseClipId: previousPersistedItem.databaseId,
    };
  }

  if (insertionPoint.type === "end") {
    // Find the last persisted item (clip or section)
    const lastPersistedItem = items.findLast(
      (c) => c.type === "on-database" || c.type === "clip-section-on-database"
    );

    if (!lastPersistedItem) {
      return { type: "start" };
    }

    if (lastPersistedItem.type === "clip-section-on-database") {
      return {
        type: "after-clip-section",
        clipSectionId: lastPersistedItem.databaseId,
      };
    }

    return {
      type: "after-clip",
      databaseClipId: lastPersistedItem.databaseId,
    };
  }

  throw new Error("Invalid insertion point");
};
