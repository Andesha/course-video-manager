# Optimistic Clips UI Redesign — Implementation Guide

## Problem

Optimistic clips in the Video Editor timeline are too opaque to the user. Key issues:

1. **Orphaned clips linger forever.** If speech detection fires more times than the OBS import produces clips, leftover optimistic clips sit in the timeline showing "Detecting silence..." with a spinner indefinitely. The only escape is a page refresh.
2. **"Detecting silence..." is misleading when not recording.** After recording stops, the message implies active processing when none is happening.
3. **No summary of pending state.** In long sessions with 50+ clips, it's easy to scroll past a stuck optimistic clip and never notice.
4. **Metadata transfer is invisible.** Scene/profile are captured at optimistic creation time and transferred to DB clips silently. If the wrong optimistic pairs with the wrong DB clip, the user has no visibility into this.

## Design Decision: Grouped Section with Recoverable Deletes

After prototyping 5 different approaches (status banner, inline badges, floating pill, grouped section, ring + bottom bar), the **grouped section** design was selected. After prototyping 4 delete behaviors (instant remove, fade out, deleted sub-section, undo toast), the **deleted sub-section** was selected.

### Reference Prototype

See `app/routes/prototype.optimistic-clips.tsx` for the working prototype. This file contains:

- A reducer with all the state transitions
- Selectors for derived views (timeline clips, pending clips, archived clips)
- All UI components

### Layout

The timeline is split into two zones:

1. **Main timeline** (top) — resolved, non-archived clips rendered as normal `ClipItem` components in insertion order.
2. **Pending section** (bottom) — a bordered container below the main timeline containing:
   - Header: "Pending Clips" with a resolved count (e.g., "3/5 resolved")
   - Progress bar: blue while processing, amber when orphans exist
   - Pending clip rows: compact rows for unresolved clips showing state (detecting silence / processing / no clip found)
   - Archived sub-section (collapsible): deleted clips with their transcribed text (if resolved) and a Restore button per clip

### Clip Lifecycle

```
Speech detected
    │
    ▼
┌─────────────┐     DB clip arrives     ┌──────────────┐
│  Optimistic  │ ───────────────────────▶│   Resolved   │
│  (pending)   │                         │  (timeline)  │
└─────────────┘                          └──────────────┘
    │                                         │
    │ User deletes                            │ User deletes
    ▼                                         ▼
┌─────────────┐     DB clip arrives     ┌──────────────┐
│  Archived    │ ───────────────────────▶│   Archived   │
│  (awaiting)  │    (still archived,    │  (resolved,  │
│              │     transcribed)        │  restorable) │
└─────────────┘                          └──────────────┘
    │                                         │
    │ User restores                           │ User restores
    ▼                                         ▼
┌─────────────┐                          ┌──────────────┐
│  Optimistic  │                         │   Resolved   │
│  (pending)   │                         │  (timeline)  │
└─────────────┘                          └──────────────┘
```

### Key Behavior: Archived Clips Are Still Transcribed

This is critical. When a user deletes an optimistic clip, they are saying "I don't want this clip." But they might change their mind. The current system skips transcription for archived clips — the new behavior should **always transcribe**, so that when the DB clip arrives and the user sees it in the archived section, they can read the actual transcript and decide whether to restore it.

This means the `"new-database-clips"` handler should **not** immediately fire `archive-clips` for `shouldArchive` clips. Instead:

1. Pair the optimistic clip with the DB clip as normal
2. Transfer scene/profile metadata as normal
3. Transcribe the clip as normal
4. Keep it in the items array with `shouldArchive: true`
5. The UI filters it into the archived sub-section (not the main timeline)
6. User can see the transcribed text and choose to restore or permanently delete

### Delete Behavior

- **Deleting a pending clip**: sets `shouldArchive: true`. Clip moves from pending section to archived sub-section. When DB clip eventually arrives, it resolves in place (archived section shows the transcribed text). User can restore at any time.
- **Deleting a resolved clip**: sets `shouldArchive: true`. Clip moves from main timeline to archived sub-section. User can restore to put it back in its original insertion order position.
- **Restoring**: clears `shouldArchive`. If the clip is resolved, it reappears in the main timeline at its original insertion order position. If unresolved, it goes back to the pending section.
- **Clear all**: permanently removes all archived clips (fires `archive-clips` effect for any with database IDs).

## Implementation Plan

### Files to Modify

| File                                                     | Changes                                                                                                                                                         |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/features/video-editor/clip-state-reducer.ts`        | Add `restore-clip` action. Modify `new-database-clips` to transcribe archived clips instead of immediately archiving. Add `permanently-remove-archived` action. |
| `app/routes/videos.$videoId.edit.tsx`                    | Change the `shouldArchive` filtering (lines 529-540) to pass archived clips separately instead of filtering them out entirely.                                  |
| `app/features/video-editor/components/clip-timeline.tsx` | Add the pending section UI at the bottom of the timeline.                                                                                                       |
| `app/features/video-editor/video-editor-context.tsx`     | Expose new selectors and dispatch wrappers for the pending/archived views.                                                                                      |
| `app/features/video-editor/video-editor-selectors.ts`    | Add selectors: `selectPendingClips`, `selectArchivedClips`, `selectOrphanedCount`.                                                                              |

### Reducer Changes

#### Modify `"new-database-clips"` action

Current behavior when `shouldArchive` is true on the optimistic clip:

```typescript
// Current: immediately archives the DB clip
clipsToArchive.add(databaseClip.id);
newClipsState[index] = undefined;
```

New behavior:

```typescript
// New: resolve in place, keep shouldArchive flag, still transcribe
const newDatabaseClip: ClipOnDatabase = {
  ...databaseClip,
  type: "on-database",
  frontendId: frontendClip.frontendId,
  databaseId: databaseClip.id,
  scene: frontendClip.scene,
  profile: frontendClip.profile,
  insertionOrder: frontendClip.insertionOrder,
  beatType: frontendClip.beatType,
  shouldArchive: true, // NEW: preserve the archive flag
};
newClipsState[index] = newDatabaseClip;
// Still update scene/profile and transcribe — do NOT archive yet
```

This requires adding `shouldArchive` to the `ClipOnDatabase` type.

#### Add `"restore-clip"` action

```typescript
case "restore-clip": {
  return {
    ...state,
    items: state.items.map((item) =>
      item.frontendId === action.clipId
        ? { ...item, shouldArchive: false }
        : item
    ),
  };
}
```

#### Add `"permanently-remove-archived"` action

```typescript
case "permanently-remove-archived": {
  const toArchive: DatabaseId[] = [];
  const newItems = state.items.filter((item) => {
    if ('shouldArchive' in item && item.shouldArchive) {
      if (item.type === "on-database") {
        toArchive.push(item.databaseId);
      }
      return false;
    }
    return true;
  });
  if (toArchive.length > 0) {
    exec({ type: "archive-clips", clipIds: toArchive });
  }
  return { ...state, items: newItems };
}
```

### UI Changes

#### Route-level filtering (`videos.$videoId.edit.tsx`)

Instead of filtering out `shouldArchive` items entirely, pass them as a separate prop or let the context split them:

```typescript
// Before: filter out archived
items={clipState.items.filter((item) => {
  if (item.type === "optimistically-added" && item.shouldArchive) return false;
  if (item.type === "clip-section-optimistically-added" && item.shouldArchive) return false;
  return true;
})}

// After: pass all items, let the UI components split them
items={clipState.items}
```

#### Pending Section Component

Add a new component rendered at the bottom of `ClipTimeline`. See the prototype's UI for the exact layout:

- Bordered container with "Pending Clips" header + resolved count
- Progress bar (blue/amber)
- List of pending clips (compact rows with spinner, state text, scene/profile, delete button)
- Collapsible archived sub-section with strikethrough text and restore buttons
- "Clear all" to permanently remove archived clips

### Selectors

```typescript
// Items for the main timeline (resolved, not archived)
function selectTimelineItems(items: TimelineItem[]): TimelineItem[] {
  return items.filter((item) => {
    if (item.type === "optimistically-added" && !item.shouldArchive)
      return true;
    if (
      item.type === "on-database" &&
      !("shouldArchive" in item && item.shouldArchive)
    )
      return true;
    // clip sections pass through
    if (
      item.type === "clip-section-on-database" ||
      item.type === "clip-section-optimistically-added"
    ) {
      return !item.shouldArchive;
    }
    return false;
  });
}

// Pending: optimistic clips not yet resolved, not archived
function selectPendingClips(items: TimelineItem[]): ClipOptimisticallyAdded[] {
  return items.filter(
    (item): item is ClipOptimisticallyAdded =>
      item.type === "optimistically-added" && !item.shouldArchive
  );
}

// Archived: anything with shouldArchive (both optimistic and resolved)
function selectArchivedItems(items: TimelineItem[]): TimelineItem[] {
  return items.filter((item) => "shouldArchive" in item && item.shouldArchive);
}
```

## Design Decisions Log

1. **Grouped section at bottom, not top.** The pending section sits below the resolved clips. The main timeline is the primary focus; pending state is secondary.
2. **No dismiss button.** Pending clips don't have a bulk dismiss. The user deletes them individually (which moves them to archived) or they resolve naturally.
3. **Archived clips are always transcribed.** Even if the user deleted the optimistic clip before the DB clip arrived, we still transcribe it so the user can see what it contains and decide whether to restore.
4. **Restore preserves insertion order.** When restoring from the archived section, the clip goes back to its original position in the timeline based on `insertionOrder`.
5. **Collapsible archived section.** The archived sub-section is collapsible (default expanded) so it doesn't dominate the pending section if the user has many deleted clips.
6. **Clear all is permanent.** "Clear all" in the archived section fires `archive-clips` for DB clips and removes them from state entirely. This is the point of no return.
