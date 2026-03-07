import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";
import {
  clipStateReducer,
  type DatabaseId,
  type FrontendId,
} from "./clip-state-reducer";
import { ReducerTester } from "@/test-utils/reducer-tester";

const createInitialState = (
  overrides: Partial<clipStateReducer.State> = {}
): clipStateReducer.State => ({
  clipIdsBeingTranscribed: new Set(),
  items: [],
  insertionPoint: { type: "end" },
  insertionOrder: 0,
  error: null,
  sessions: [],
  ...overrides,
});

describe("clipStateReducer", () => {
  describe("Inserting clips with clip sections", () => {
    it("Should correctly insert a clip just before a section (after a clip that precedes the section)", () => {
      // Setup: Clip 1 -> Section -> Clip 2
      const tester = new ReducerTester(clipStateReducer, createInitialState());

      // Add first clip
      const stateWithFirstClip = tester
        .send(
          fromPartial({
            type: "new-optimistic-clip-detected",
            scene: "Clip 1",
            soundDetectionId: "sound-1",
          })
        )
        .getState();

      const firstClipId = stateWithFirstClip.items[0]!.frontendId;

      // Add section after first clip
      const stateWithSection = tester
        .send({
          type: "add-clip-section",
          name: "Section 1",
        })
        .getState();

      const sectionId = stateWithSection.items[1]!.frontendId;

      // Add second clip after section
      const stateWithTwoClipsAndSection = tester
        .send(
          fromPartial({
            type: "new-optimistic-clip-detected",
            scene: "Clip 2",
            soundDetectionId: "sound-2",
          })
        )
        .getState();

      // Verify structure: [Clip 1, Section, Clip 2]
      expect(stateWithTwoClipsAndSection.items).toHaveLength(3);
      expect(stateWithTwoClipsAndSection.items[0]).toMatchObject({
        scene: "Clip 1",
      });
      expect(stateWithTwoClipsAndSection.items[1]).toMatchObject({
        name: "Section 1",
      });
      expect(stateWithTwoClipsAndSection.items[2]).toMatchObject({
        scene: "Clip 2",
      });

      // Now set insertion point BEFORE the section (which means after Clip 1)
      const stateWithInsertionBeforeSection = tester
        .send({
          type: "set-insertion-point-before",
          clipId: sectionId,
        })
        .getState();

      // Insertion point should be after Clip 1
      expect(stateWithInsertionBeforeSection.insertionPoint).toEqual({
        type: "after-clip",
        frontendClipId: firstClipId,
      });

      // Insert a new clip (Clip 3) at this insertion point
      const stateWithNewClip = tester
        .send(
          fromPartial({
            type: "new-optimistic-clip-detected",
            scene: "Clip 3",
            soundDetectionId: "sound-3",
          })
        )
        .getState();

      // Verify structure: [Clip 1, Clip 3, Section, Clip 2]
      expect(stateWithNewClip.items).toHaveLength(4);
      expect(stateWithNewClip.items).toMatchObject([
        { scene: "Clip 1" },
        { scene: "Clip 3" },
        { name: "Section 1" },
        { scene: "Clip 2" },
      ]);

      // Insertion point should now be after Clip 3
      expect(stateWithNewClip.insertionPoint).toEqual({
        type: "after-clip",
        frontendClipId: stateWithNewClip.items[1]!.frontendId,
      });
    });

    it("Should correctly handle insertion point when setting it before a section at the start", () => {
      const tester = new ReducerTester(clipStateReducer, createInitialState());

      // Add section at start
      const stateWithSection = tester
        .send({
          type: "add-clip-section",
          name: "Section 1",
        })
        .getState();

      const sectionId = stateWithSection.items[0]!.frontendId;

      // Add clip after section
      tester.send(
        fromPartial({
          type: "new-optimistic-clip-detected",
          scene: "Clip 1",
          soundDetectionId: "sound-1",
        })
      );

      // Set insertion point before the section (should be "start")
      const stateWithInsertionBeforeSection = tester
        .send({
          type: "set-insertion-point-before",
          clipId: sectionId,
        })
        .getState();

      expect(stateWithInsertionBeforeSection.insertionPoint).toEqual({
        type: "start",
      });

      // Insert a new clip (should go before the section)
      const stateWithNewClip = tester
        .send(
          fromPartial({
            type: "new-optimistic-clip-detected",
            scene: "Clip 2",
            soundDetectionId: "sound-2",
          })
        )
        .getState();

      // Verify structure: [Clip 2, Section, Clip 1]
      expect(stateWithNewClip.items).toMatchObject([
        { scene: "Clip 2" },
        { name: "Section 1" },
        { scene: "Clip 1" },
      ]);
    });

    it("Should correctly insert clips after a section", () => {
      const tester = new ReducerTester(clipStateReducer, createInitialState());

      // Add clip
      tester.send(
        fromPartial({
          type: "new-optimistic-clip-detected",
          scene: "Clip 1",
          soundDetectionId: "sound-1",
        })
      );

      // Add section
      const stateWithSection = tester
        .send({
          type: "add-clip-section",
          name: "Section 1",
        })
        .getState();

      // Insertion point should now be after the section
      expect(stateWithSection.insertionPoint).toEqual({
        type: "after-clip-section",
        frontendClipSectionId: stateWithSection.items[1]!.frontendId,
      });

      // Insert a new clip after the section
      const stateWithNewClip = tester
        .send(
          fromPartial({
            type: "new-optimistic-clip-detected",
            scene: "Clip 2",
            soundDetectionId: "sound-2",
          })
        )
        .getState();

      // Verify structure: [Clip 1, Section, Clip 2]
      expect(stateWithNewClip.items).toMatchObject([
        { scene: "Clip 1" },
        { name: "Section 1" },
        { scene: "Clip 2" },
      ]);

      // Insertion point should be after Clip 2
      expect(stateWithNewClip.insertionPoint).toEqual({
        type: "after-clip",
        frontendClipId: stateWithNewClip.items[2]!.frontendId,
      });
    });
  });

  describe("Adding clip section after optimistic clip section", () => {
    it("Should add a clip section after an optimistically added clip section", () => {
      const tester = new ReducerTester(clipStateReducer, createInitialState());

      // Add first section via add-clip-section (creates an optimistically added section)
      const stateWithFirstSection = tester
        .send({
          type: "add-clip-section",
          name: "Section 1",
        })
        .getState();

      expect(stateWithFirstSection.items).toHaveLength(1);
      expect(stateWithFirstSection.items[0]).toMatchObject({
        type: "clip-section-optimistically-added",
        name: "Section 1",
      });

      const firstSectionId = stateWithFirstSection.items[0]!.frontendId;

      // Now add another section after the optimistic section via add-clip-section-at
      const stateWithSecondSection = tester
        .send({
          type: "add-clip-section-at",
          name: "Section 2",
          position: "after",
          itemId: firstSectionId,
        })
        .getState();

      // Should have both sections
      expect(stateWithSecondSection.items).toHaveLength(2);
      expect(stateWithSecondSection.items).toMatchObject([
        { name: "Section 1" },
        { name: "Section 2" },
      ]);
    });

    it("Should add a clip section before an optimistically added clip section", () => {
      const tester = new ReducerTester(clipStateReducer, createInitialState());

      // Add first section
      const stateWithFirstSection = tester
        .send({
          type: "add-clip-section",
          name: "Section 1",
        })
        .getState();

      const firstSectionId = stateWithFirstSection.items[0]!.frontendId;

      // Add section before the optimistic section
      const stateWithSecondSection = tester
        .send({
          type: "add-clip-section-at",
          name: "Section 0",
          position: "before",
          itemId: firstSectionId,
        })
        .getState();

      expect(stateWithSecondSection.items).toHaveLength(2);
      expect(stateWithSecondSection.items).toMatchObject([
        { name: "Section 0" },
        { name: "Section 1" },
      ]);
    });
  });

  describe("Clip section lifecycle (optimistic → on-database)", () => {
    it("Should transition an optimistic clip section to on-database when clip-section-created is dispatched", () => {
      const tester = new ReducerTester(clipStateReducer, createInitialState());

      // Add an optimistic section
      const stateWithSection = tester
        .send({
          type: "add-clip-section",
          name: "Section 1",
        })
        .getState();

      expect(stateWithSection.items[0]).toMatchObject({
        type: "clip-section-optimistically-added",
        name: "Section 1",
      });

      const frontendId = stateWithSection.items[0]!.frontendId;

      // Simulate the DB responding with the created section
      const stateAfterCreated = tester
        .send(
          fromPartial({
            type: "clip-section-created",
            frontendId,
            databaseId: "db-s1",
          })
        )
        .getState();

      // Should now be on-database
      expect(stateAfterCreated.items[0]).toMatchObject({
        type: "clip-section-on-database",
        frontendId,
        databaseId: "db-s1",
        name: "Section 1",
      });
    });

    it("Should fire reorder-clip-section effect when moving a section that was optimistic but has been persisted", () => {
      const tester = new ReducerTester(
        clipStateReducer,
        createInitialState({
          items: [
            fromPartial({
              type: "on-database",
              frontendId: "fe-1" as FrontendId,
              databaseId: "db-1" as DatabaseId,
              scene: "Clip 1",
              insertionOrder: null,
            }),
          ],
        })
      );

      // Add an optimistic section after Clip 1
      const stateWithSection = tester
        .send({
          type: "add-clip-section",
          name: "Section 1",
        })
        .getState();

      const sectionFrontendId = stateWithSection.items[1]!.frontendId;

      // Simulate DB response - section now has a database ID
      tester.send(
        fromPartial({
          type: "clip-section-created",
          frontendId: sectionFrontendId,
          databaseId: "db-s1",
        })
      );

      // Move the section up past Clip 1
      tester.send({
        type: "move-clip",
        clipId: sectionFrontendId,
        direction: "up",
      });

      // The reorder effect should have fired with the database ID
      expect(tester.getExec()).toHaveBeenCalledWith({
        type: "reorder-clip-section",
        clipSectionId: "db-s1",
        direction: "up",
      });
    });
  });
});
