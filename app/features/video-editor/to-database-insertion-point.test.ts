import { describe, expect, it } from "vitest";
import type {
  ClipOnDatabase,
  ClipOptimisticallyAdded,
  ClipSectionOnDatabase,
  ClipSectionOptimisticallyAdded,
  DatabaseId,
  FrontendId,
  TimelineItem,
} from "./clip-state-reducer";
import { toDatabaseInsertionPoint } from "./to-database-insertion-point";

const makeClipOnDatabase = (
  overrides: Partial<ClipOnDatabase> & {
    frontendId: FrontendId;
    databaseId: DatabaseId;
  }
): ClipOnDatabase => ({
  type: "on-database",
  videoFilename: "test.mp4",
  sourceStartTime: 0,
  sourceEndTime: 1,
  text: "",
  transcribedAt: null,
  scene: null,
  profile: null,
  insertionOrder: null,
  beatType: "none",
  ...overrides,
});

const makeSectionOnDatabase = (
  overrides: Partial<ClipSectionOnDatabase> & {
    frontendId: FrontendId;
    databaseId: DatabaseId;
  }
): ClipSectionOnDatabase => ({
  type: "clip-section-on-database",
  name: "Section",
  insertionOrder: null,
  ...overrides,
});

const makeOptimisticClip = (
  overrides: Partial<ClipOptimisticallyAdded> & {
    frontendId: FrontendId;
  }
): ClipOptimisticallyAdded => ({
  type: "optimistically-added",
  scene: "Scene",
  profile: "Profile",
  insertionOrder: 1,
  beatType: "none",
  soundDetectionId: "sound-1",
  ...overrides,
});

const makeOptimisticSection = (
  overrides: Partial<ClipSectionOptimisticallyAdded> & {
    frontendId: FrontendId;
  }
): ClipSectionOptimisticallyAdded => ({
  type: "clip-section-optimistically-added",
  name: "Section",
  insertionOrder: 1,
  ...overrides,
});

describe("toDatabaseInsertionPoint", () => {
  describe("after-clip pointing at optimistic clip after a persisted section", () => {
    it("should resolve to after-clip-section when the nearest persisted item before the optimistic clip is a section", () => {
      const items: TimelineItem[] = [
        makeClipOnDatabase({
          frontendId: "clip-1" as FrontendId,
          databaseId: "db-1" as DatabaseId,
        }),
        makeSectionOnDatabase({
          frontendId: "section-1" as FrontendId,
          databaseId: "db-section-1" as DatabaseId,
        }),
        makeOptimisticClip({
          frontendId: "opt-1" as FrontendId,
        }),
      ];

      const result = toDatabaseInsertionPoint(
        { type: "after-clip", frontendClipId: "opt-1" as FrontendId },
        items
      );

      expect(result).toEqual({
        type: "after-clip-section",
        clipSectionId: "db-section-1",
      });
    });

    it("should resolve to after-clip-section when section is the only item before optimistic clip", () => {
      const items: TimelineItem[] = [
        makeSectionOnDatabase({
          frontendId: "section-1" as FrontendId,
          databaseId: "db-section-1" as DatabaseId,
        }),
        makeOptimisticClip({
          frontendId: "opt-1" as FrontendId,
        }),
      ];

      const result = toDatabaseInsertionPoint(
        { type: "after-clip", frontendClipId: "opt-1" as FrontendId },
        items
      );

      expect(result).toEqual({
        type: "after-clip-section",
        clipSectionId: "db-section-1",
      });
    });

    it("should resolve to after-clip when the nearest persisted item is a clip (not a section)", () => {
      const items: TimelineItem[] = [
        makeSectionOnDatabase({
          frontendId: "section-1" as FrontendId,
          databaseId: "db-section-1" as DatabaseId,
        }),
        makeClipOnDatabase({
          frontendId: "clip-1" as FrontendId,
          databaseId: "db-1" as DatabaseId,
        }),
        makeOptimisticClip({
          frontendId: "opt-1" as FrontendId,
        }),
      ];

      const result = toDatabaseInsertionPoint(
        { type: "after-clip", frontendClipId: "opt-1" as FrontendId },
        items
      );

      expect(result).toEqual({
        type: "after-clip",
        databaseClipId: "db-1",
      });
    });
  });

  describe("after-clip-section pointing at an optimistic section after a persisted section", () => {
    it("should resolve to after-clip-section of the nearest persisted section before the optimistic one", () => {
      const items: TimelineItem[] = [
        makeSectionOnDatabase({
          frontendId: "section-1" as FrontendId,
          databaseId: "db-section-1" as DatabaseId,
        }),
        makeClipOnDatabase({
          frontendId: "clip-1" as FrontendId,
          databaseId: "db-1" as DatabaseId,
        }),
        makeOptimisticSection({
          frontendId: "opt-section-1" as FrontendId,
        }),
      ];

      const result = toDatabaseInsertionPoint(
        {
          type: "after-clip-section",
          frontendClipSectionId: "opt-section-1" as FrontendId,
        },
        items
      );

      expect(result).toEqual({
        type: "after-clip",
        databaseClipId: "db-1",
      });
    });

    it("should resolve to after-clip-section when the nearest persisted item before optimistic section is a persisted section", () => {
      const items: TimelineItem[] = [
        makeSectionOnDatabase({
          frontendId: "section-1" as FrontendId,
          databaseId: "db-section-1" as DatabaseId,
        }),
        makeOptimisticSection({
          frontendId: "opt-section-1" as FrontendId,
        }),
      ];

      const result = toDatabaseInsertionPoint(
        {
          type: "after-clip-section",
          frontendClipSectionId: "opt-section-1" as FrontendId,
        },
        items
      );

      expect(result).toEqual({
        type: "after-clip-section",
        clipSectionId: "db-section-1",
      });
    });
  });

  describe("start", () => {
    it("should return start", () => {
      const result = toDatabaseInsertionPoint({ type: "start" }, []);
      expect(result).toEqual({ type: "start" });
    });
  });

  describe("end", () => {
    it("should return start when there are no persisted items", () => {
      const result = toDatabaseInsertionPoint({ type: "end" }, [
        makeOptimisticClip({ frontendId: "opt-1" as FrontendId }),
      ]);
      expect(result).toEqual({ type: "start" });
    });

    it("should return after-clip when last persisted item is a clip", () => {
      const items: TimelineItem[] = [
        makeClipOnDatabase({
          frontendId: "clip-1" as FrontendId,
          databaseId: "db-1" as DatabaseId,
        }),
      ];

      const result = toDatabaseInsertionPoint({ type: "end" }, items);
      expect(result).toEqual({
        type: "after-clip",
        databaseClipId: "db-1",
      });
    });

    it("should return after-clip-section when last persisted item is a section", () => {
      const items: TimelineItem[] = [
        makeClipOnDatabase({
          frontendId: "clip-1" as FrontendId,
          databaseId: "db-1" as DatabaseId,
        }),
        makeSectionOnDatabase({
          frontendId: "section-1" as FrontendId,
          databaseId: "db-section-1" as DatabaseId,
        }),
      ];

      const result = toDatabaseInsertionPoint({ type: "end" }, items);
      expect(result).toEqual({
        type: "after-clip-section",
        clipSectionId: "db-section-1",
      });
    });
  });
});
