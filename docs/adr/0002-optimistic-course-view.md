# Optimistic UI for the course view

The course view applies optimistic UI by deriving rendered state purely from `loaderData + in-flight fetcher submissions`, with no local component state. A pure module `optimistic-applier.ts` exposes `(loaderData, event) => loaderData` and is reduced over `useFetchers()` in a `useOptimisticCourse` hook. Failures surface as toasts; the merge layer reverts automatically when `fetcher.formData` clears.

## Scope

In scope (mutations applied optimistically):

- All `update-*` events on sections and lessons (name, title, description, icon, priority, dependencies, authoring status).
- `archive-section`, `delete-lesson`.
- `reorder-sections`, `reorder-lessons`, `move-lesson-to-section` (intent-based — payloads already carry full ordered ids; the applier reorders the array directly without recomputing fractional indexes).
- `convert-to-ghost` (real → ghost; flips `fsStatus`, no row removal).
- `delete-video` for lesson-bound videos.

Out of scope:

- **All creates** (`create-section`, `add-ghost-lesson`, `create-real-lesson`) — avoids client-supplied id machinery.
- **`create-on-disk` (materialize)** — the materialization cascade is too complex to mirror client-side.
- **Sidebar mutations** (`archive-course`, standalone-video changes) — applier operates on `selectedCourse` only.
- **SSE flows** (publish, batch-export, video generate) — not fetchers; they have dedicated progress UIs.
- **`reveal-video`, `git-push`, `purge-export`** — no entity state to patch (Finder open, native `fetcher.state` indicator, deferred Suspense map respectively).

## Why this shape

- **One shared `useFetcher()` was rejected** in favour of per-action fetcher keys, so `useFetchers()` can surface concurrent in-flight events without one clobbering another.
- **Centralised pure applier** (over distributed per-component patching) keeps the merge logic testable and matches the existing `courseViewReducer` pattern for UI state.
- **Intent-based reorder payloads** (already in place) mean the client never replicates the server's fractional-index algorithm.
- **No local optimistic state** — the merge is pure derivation, so failure handling is "toast + let `formData` clear"; there is nothing to roll back.
