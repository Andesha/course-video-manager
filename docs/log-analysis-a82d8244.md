# Log Analysis: a82d8244-7deb-401b-97dd-021ca9d64b50

**Date of session**: 2026-02-26, 09:07–09:36 UTC
**Log file**: `.data/logs/a82d8244-7deb-401b-97dd-021ca9d64b50.log`

## Issues Found

### 1. Race condition double-insert (lines 1–2)

The very first clip was inserted **twice** within 1ms:

```
Line 1: 09:07:06.619Z → inserted:1, clip 09-06-48.mkv 8.93–15.39
Line 2: 09:07:06.620Z → inserted:1, clip 09-06-48.mkv 8.93–15.39
```

Both events report `inserted:1` and `duplicatesSkipped:0`. The duplicate detection failed because both fired essentially simultaneously — the second insert committed before the first was visible to the duplicate check. Line 3 then archives one copy via `clips-archived`, but the other copy persists in the clip list.

This is likely the **stray clip appended to the end** of the video — a phantom duplicate from the session's very first recording.

### 2. Missing `clips-updated` for 3 inserted clips

Every normally inserted clip gets a `clips-updated` event ~100ms later that assigns its `scene`, `profile`, and `beatType`. Three clips were inserted but **never received classification**:

| Line | Timestamp | Source file    | Start–End     | Duration |
| ---- | --------- | -------------- | ------------- | -------- |
| 60   | 09:08:55  | `09-09-04.mkv` | 81.7–86.31    | 4.6s     |
| 337  | 09:20:09  | `09-11-51.mkv` | 490.72–491.85 | 1.1s     |
| 340  | 09:20:18  | `09-11-51.mkv` | 500.32–503.82 | 3.5s     |

These clips exist in the backend DB but were never sent to the frontend with scene/profile metadata. The frontend would either not show them or show them without proper classification — this is the **backend/frontend desync**.

Line 60 is the most visible case: after its insert, there is a **25-second gap** before the next poll event (vs the normal ~2s polling interval), suggesting the system stalled or the OBS connection was briefly interrupted.

### 3. Pervasive concurrent double-polling

Throughout the entire 729-line log, `clips-appended-from-obs` frequently fires **twice** in rapid succession (< 200ms apart) for the same poll cycle. This happens dozens of times:

```
Line 203: 09:15:15.069Z → detected:0
Line 204: 09:15:15.109Z → detected:0  (40ms later, same poll result)
```

```
Line 502: 09:27:44.433Z → detected:0
Line 503: 09:27:44.444Z → detected:0  (11ms later)
```

The `duplicatesSkipped` mechanism catches most of these — correctly skipping re-inserts in the second fire. But lines 1–2 show it can fail when both fires happen within the same millisecond window, before either insert has been committed.

This pattern suggests **two concurrent subscriptions or poll loops** are running against the same OBS clip source.

## Root Cause Analysis

The double-polling is the root cause of both the stray clip and the missing classifications:

1. **Stray clip**: When two poll results arrive simultaneously, both can insert the same clip before either's duplicate check sees the other. This created the phantom duplicate at lines 1–2.

2. **Missing classifications**: The `clips-updated` classification pipeline may get confused by concurrent writes to the same clip. If two inserts race, the classification for one may target a clip ID that was already superseded or may simply be dropped. The 3 clips without `clips-updated` events (lines 60, 337, 340) likely hit this path.

## Recommendations

- Investigate why `clips-appended-from-obs` fires twice per poll cycle — there may be a duplicate subscription or an event listener registered twice.
- Add a mutex or deduplication lock around the clip insert path so that concurrent polls serialize their writes.
- Consider making the `clips-updated` classification step transactional with the insert, rather than a separate event that can be dropped independently.
