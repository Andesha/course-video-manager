# Course Video Manager

A tool for authoring courses as structured collections of sections, lessons, and videos — backed by a git repo on disk and published as immutable snapshots.

## Language

### Course structure

**Course**:
The primary domain entity: a structured collection of versions, sections, lessons, and videos, stored in the database.
_Avoid_: Repo (as domain entity), Project

**CourseRepo**:
The local git repository on disk that backs a course, referenced by the course's `repoPath`.
_Avoid_: Repo (ambiguous without "Course" prefix)

**Section**:
A directory-backed grouping of lessons within a course version, ordered by fractional index.
_Avoid_: Module, Chapter, Unit

**Lesson**:
A single learning unit within a section, corresponding to a folder on disk.
_Avoid_: Exercise, Tutorial, Step

### Course versions

**CourseVersion**:
A snapshot of a course's section/lesson/video structure at a point in time; either a Draft Version or a Published Version.
_Avoid_: Version (too vague), Revision

**Draft Version**:
The single mutable CourseVersion that is currently being edited; always the latest by `createdAt`; has no name or description.
_Avoid_: Current version, Working version

**Published Version**:
An immutable CourseVersion with a name and description, created by the Publish flow; cannot be deleted.
_Avoid_: Released version, Committed version

**Publish**:
The atomic operation that uploads to Dropbox, freezes the Draft Version as a Published Version (setting name/description), and clones a new Draft Version.
_Avoid_: Commit, Deploy, Push

**Export Version Key**:
A hardcoded constant in the codebase (`EXPORT_VERSION`) that, when bumped, invalidates all video export hashes and forces re-export.
_Avoid_: Version number, Build version

### Ghost entities

**Ghost Lesson**:
A lesson that exists in the database but not yet on the file system (`fsStatus = "ghost"`).
_Avoid_: Planned lesson, Draft lesson

**Ghost Section**:
A section that exists in the database but not yet on the file system.
_Avoid_: Planned section

**Ghost Course**:
A course with no file path (`filePath = NULL`); exists only in the database as a planning space.
_Avoid_: Planned course, Draft course

**Materialize**:
The act of transitioning a ghost entity to a real entity by creating its on-disk representation.
_Avoid_: Create on disk, Realize

**Materialization Cascade**:
The chain reaction when materializing a lesson inside a ghost course: assigns file path to course, materializes section, then materializes lesson — all in one flow.

### Video and clips

**Video**:
A container of clips and clip sections that represents a single producible video output.
_Avoid_: Recording

**Standalone Video**:
A video with no lesson association (`lessonId = NULL`), used for reference or temporary content.
_Avoid_: Orphan video, Unlinked video

**Clip**:
A timestamped segment of source footage within a video, defined by start/end times and a source filename.
_Avoid_: Segment, Cut, Take

**Effect Clip**:
A special clip for non-speech content (white noise, transitions) manually inserted into the timeline.
_Avoid_: Filler, Spacer

**ClipSection**:
A named marker/divider within a video's timeline that visually groups related clips.
_Avoid_: Clip group, Divider, Marker

**Optimistic Clip**:
A clip added to the frontend state during recording before it is persisted to the database.
_Avoid_: Pending clip, Temporary clip

### Video export and hashing

**Export Hash**:
A SHA256 hash derived from a video's clip filenames, timestamps, clip order, and the Export Version Key; determines whether a video needs re-export.
_Avoid_: Content hash, Video hash

**Exported Video**:
A rendered `.mp4` file on disk named `{courseId}-{exportHash}.mp4` in the finished videos directory.
_Avoid_: Finished video, Output video

**Unexported Video**:
A video whose current Export Hash does not match any file on disk; blocks publishing.
_Avoid_: Dirty video, Stale video

**Purge**:
The deliberate deletion of an Exported Video's `.mp4` file from disk, transitioning it back to an Unexported Video; reversible via re-export.
_Avoid_: Clear, Delete from file system, Unexport

### Recording

**Recording Session**:
A time-bounded window during which clips are captured via OBS, grouping optimistic clips before persistence.
_Avoid_: Session, Take session

**Pause Length**:
A per-Recording-Session setting (`short` or `long`) that controls how long a silence must last before it ends a clip. `short` (default) cuts on brief mid-sentence pauses; `long` only cuts on extended pauses. Locked at the start of recording and applied symmetrically to both the frontend speech detector and the backend FFmpeg silence detection.
_Avoid_: Silence mode, Silence sensitivity, Pause threshold

**Insertion Point**:
The position in a video timeline where new clips or clip sections will be added (start, after-clip, after-clip-section, end).
_Avoid_: Cursor, Drop target

**Transcription**:
The process of populating a clip's `text` field from its audio, tracked by `transcribedAt`.
_Avoid_: Caption, Subtitle

### Planning

**Plan**:
An independent (non-file-backed) structured course outline, separate from the course hierarchy.
_Avoid_: Outline, Syllabus

**PlanSection**:
A grouping within a plan.

**PlanLesson**:
A learning objective within a plan section.

### Ordering and lifecycle

**Fractional Index**:
A string-based ordering value that allows inserting items between existing items without reindexing siblings.
_Avoid_: Sort order, Position

**Archive**:
Soft-deletion: hiding an entity from active views while retaining it in the database.
_Avoid_: Delete, Remove

**ARCHIVE Section**:
A special section directory whose name ends in `ARCHIVE`, filtered out of the default course view.

## Relationships

- A **Course** is either a **Ghost Course** (no file path, planning-only) or backed by a **CourseRepo** on disk, referenced via `repoPath`
- A **Ghost Course** becomes a real **Course** permanently when a file path is assigned during **Materialization Cascade**; a real course never reverts to ghost
- A **Course** contains one or more **CourseVersions**
- A **Course** has exactly one **Draft Version** (the latest CourseVersion) and zero or more **Published Versions**
- A **CourseVersion** contains ordered **Sections**
- A **Section** contains ordered **Lessons**
- A **Lesson** contains zero or more **Videos** (ghost lessons have none)
- A **Video** contains ordered **Clips** and **ClipSections**, interleaved in a shared ordering space
- A **Video** with at least one **Clip** has an **Export Hash**; a video with no clips is not considered a real video
- An **Exported Video** file is shared across **CourseVersions** via `{courseId}-{exportHash}.mp4` naming — if clips haven't changed, the hash matches and no re-export is needed
- A **Standalone Video** belongs directly to a **Course** with no **Lesson** parent
- A **Recording Session** produces multiple **Optimistic Clips** that become **Clips** on persistence
- A **Plan** is independent of the **Course** hierarchy and contains **PlanSections** with **PlanLessons**
- **Publishing** uploads to Dropbox, freezes the **Draft Version** into a **Published Version**, and creates a new **Draft Version** — all atomically (Dropbox upload must succeed first)

## Example dialogue

> **Dev:** "When a user wants to push changes to the course, what's the flow?"
> **Domain expert:** "They go to the Publish page. It shows them a changelog preview — the diff between the current **Draft Version** and the last **Published Version**. They enter a name and description, and hit Publish."

> **Dev:** "What if some videos haven't been exported yet?"
> **Domain expert:** "The Publish page checks every **Video** that has **Clips** for a matching **Exported Video** on disk. If any are **Unexported Videos**, the publish button is disabled and they see export buttons inline. A **Video** with no **Clips** is ignored — it's not a real video."

> **Dev:** "How does the system know if a video needs re-export?"
> **Domain expert:** "It computes the **Export Hash** from the clip filenames, timestamps, order, and the **Export Version Key**. Then it checks for `{courseId}-{exportHash}.mp4`. If the file exists, it's already exported. If not, it's an **Unexported Video**."

> **Dev:** "What happens when we bump the **Export Version Key**?"
> **Domain expert:** "Every video's **Export Hash** changes, so nothing matches on disk anymore. Everything becomes an **Unexported Video** and needs re-export."

> **Dev:** "What if I want to free up disk space without re-exporting everything?"
> **Domain expert:** "You can **Purge** — either a single video or all exports for a version. Purging deletes the `.mp4` from disk, so the video becomes an **Unexported Video** again. You can always re-export later."

> **Dev:** "After publishing, what happens to old exported files with stale hashes?"
> **Domain expert:** "Automatic cleanup happens at export time — we collect all valid **Export Hashes** across every **CourseVersion**, then delete any `{courseId}-*.mp4` files whose hash isn't in that set. That's different from a manual **Purge**, which is a deliberate user action."

> **Dev:** "And the **Published Version** is immutable? Can it be deleted?"
> **Domain expert:** "Correct. Once published, the version's name, description, and structure are frozen. It cannot be deleted. The **Draft Version** is always the only mutable version."

## Example dialogue: ghost courses

> **Dev:** "What if I want to plan a course but don't have a repo yet?"
> **Domain expert:** "Create a **Ghost Course** — just give it a name. You can add **Ghost Sections** and **Ghost Lessons** freely. It's pure planning, no filesystem needed."

> **Dev:** "What happens when I'm ready to commit one of those lessons to disk?"
> **Domain expert:** "Hit 'Create Real Lesson.' Since the course is a **Ghost Course**, it triggers a **Materialization Cascade** — a modal asks you to point at an existing directory for the file path. Then the **Course**, **Section**, and **Lesson** all **Materialize** in one step."

> **Dev:** "Can the course go back to ghost if I delete that lesson?"
> **Domain expert:** "No. Once a **Course** has a file path, it stays real forever. The repo on disk doesn't disappear just because you removed a lesson."

> **Dev:** "What about deleting a real lesson entirely — not converting to ghost?"
> **Domain expert:** "There's a 'Delete' action that purges from disk and removes from the database in one step. Separate from 'Convert to Ghost,' which keeps the planning entry."

## Flagged ambiguities

- **"Version"** — Used both for **CourseVersion** (structural snapshots) and implicitly for content history via `previousVersionLessonId`/`previousVersionSectionId` cross-references. These serve different purposes: one is a named milestone, the other is a migration link between versions. Now additionally distinguished as **Draft Version** vs **Published Version** by position (latest = draft).
- **Clips and ClipSections share an ordering space** — Both use the same `order` field with fractional indexing. The UI must treat them as a single interleaved list, not two separate collections. This is a source of complexity when inserting or reordering.
- **"Plan" vs course structure** — A **Plan** (`plans` table) is entirely disconnected from the **Course**/Section/Lesson hierarchy. There is no enforced link between a **PlanLesson** and an actual **Lesson**. The relationship is purely semantic.
- **"Export Version Key" vs "CourseVersion"** — These are unrelated concepts that both use the word "version." The **Export Version Key** is a build-time constant for cache-busting video exports. A **CourseVersion** is a domain snapshot of course structure. Do not confuse them.
- **"Clear" / "Delete from file system"** (resolved) — Previously used interchangeably for removing exported video files. Now canonicalized as **Purge**. "Clear" described the mechanism (clearing files), not the domain action. **Purge** captures the intent: deliberately removing a cached render artifact to transition a video back to Unexported status.
- **"Delete" for lessons** — "Delete" means two different things depending on context: for a **Ghost Lesson**, it removes the DB row. For a real **Lesson**, it purges from disk AND removes from DB. This is distinct from "Convert to Ghost" which only removes from disk. The UI should make the distinction clear through labeling.
