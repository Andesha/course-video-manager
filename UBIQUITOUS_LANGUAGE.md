# Ubiquitous Language

## Course structure

| Term           | Definition                                                                                                            | Aliases to avoid                         |
| -------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **Course**     | The primary domain entity: a structured collection of versions, sections, lessons, and videos, stored in the database | Repo (as domain entity), Project         |
| **CourseRepo** | The local git repository on disk that backs a course, referenced by the course's `repoPath`                           | Repo (ambiguous without "Course" prefix) |
| **Section**    | A directory-backed grouping of lessons within a course version, ordered by fractional index                           | Module, Chapter, Unit                    |
| **Lesson**     | A single learning unit within a section, corresponding to a folder on disk                                            | Exercise, Tutorial, Step                 |

## Course versions

| Term                   | Definition                                                                                                                                                | Aliases to avoid                    |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **CourseVersion**      | A snapshot of a course's section/lesson/video structure at a point in time; either a Draft Version or a Published Version                                 | Version (too vague), Revision       |
| **Draft Version**      | The single mutable CourseVersion that is currently being edited; always the latest by `createdAt`; has no name or description                             | Current version, Working version    |
| **Published Version**  | An immutable CourseVersion with a name and description, created by the Publish flow; cannot be deleted                                                    | Released version, Committed version |
| **Publish**            | The atomic operation that uploads to Dropbox, freezes the Draft Version as a Published Version (setting name/description), and clones a new Draft Version | Commit, Deploy, Push                |
| **Export Version Key** | A hardcoded constant in the codebase (`EXPORT_VERSION`) that, when bumped, invalidates all video export hashes and forces re-export                       | Version number, Build version       |

## Ghost entities

| Term              | Definition                                                                                 | Aliases to avoid             |
| ----------------- | ------------------------------------------------------------------------------------------ | ---------------------------- |
| **Ghost Lesson**  | A lesson that exists in the database but not yet on the file system (`fsStatus = "ghost"`) | Planned lesson, Draft lesson |
| **Ghost Section** | A section that exists in the database but not yet on the file system                       | Planned section              |

## Video and clips

| Term                 | Definition                                                                                               | Aliases to avoid             |
| -------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------- |
| **Video**            | A container of clips and clip sections that represents a single producible video output                  | Recording                    |
| **Standalone Video** | A video with no lesson association (`lessonId = NULL`), used for reference or temporary content          | Orphan video, Unlinked video |
| **Clip**             | A timestamped segment of source footage within a video, defined by start/end times and a source filename | Segment, Cut, Take           |
| **Effect Clip**      | A special clip for non-speech content (white noise, transitions) manually inserted into the timeline     | Filler, Spacer               |
| **ClipSection**      | A named marker/divider within a video's timeline that visually groups related clips                      | Clip group, Divider, Marker  |
| **Optimistic Clip**  | A clip added to the frontend state during recording before it is persisted to the database               | Pending clip, Temporary clip |

## Video export and hashing

| Term                 | Definition                                                                                                                                          | Aliases to avoid                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **Export Hash**      | A SHA256 hash derived from a video's clip filenames, timestamps, clip order, and the Export Version Key; determines whether a video needs re-export | Content hash, Video hash                 |
| **Exported Video**   | A rendered `.mp4` file on disk named `{courseId}-{exportHash}.mp4` in the finished videos directory                                                 | Finished video, Output video             |
| **Unexported Video** | A video whose current Export Hash does not match any file on disk; blocks publishing                                                                | Dirty video, Stale video                 |
| **Purge**            | The deliberate deletion of an Exported Video's `.mp4` file from disk, transitioning it back to an Unexported Video; reversible via re-export        | Clear, Delete from file system, Unexport |

## Recording

| Term                  | Definition                                                                                                                   | Aliases to avoid      |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **Recording Session** | A time-bounded window during which clips are captured via OBS, grouping optimistic clips before persistence                  | Session, Take session |
| **Insertion Point**   | The position in a video timeline where new clips or clip sections will be added (start, after-clip, after-clip-section, end) | Cursor, Drop target   |
| **Transcription**     | The process of populating a clip's `text` field from its audio, tracked by `transcribedAt`                                   | Caption, Subtitle     |

## Planning

| Term            | Definition                                                                                     | Aliases to avoid  |
| --------------- | ---------------------------------------------------------------------------------------------- | ----------------- |
| **Plan**        | An independent (non-file-backed) structured course outline, separate from the course hierarchy | Outline, Syllabus |
| **PlanSection** | A grouping within a plan                                                                       | -                 |
| **PlanLesson**  | A learning objective within a plan section                                                     | -                 |

## Ordering and lifecycle

| Term                 | Definition                                                                                                   | Aliases to avoid     |
| -------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------- |
| **Fractional Index** | A string-based ordering value that allows inserting items between existing items without reindexing siblings | Sort order, Position |
| **Archive**          | Soft-deletion: hiding an entity from active views while retaining it in the database                         | Delete, Remove       |
| **ARCHIVE Section**  | A special section directory whose name ends in `ARCHIVE`, filtered out of the default course view            | -                    |

## Relationships

- A **Course** is backed by a **CourseRepo** on disk, referenced via `repoPath`
- A **Course** contains one or more **CourseVersions**
- A **Course** has exactly one **Draft Version** (the latest CourseVersion) and zero or more **Published Versions**
- A **CourseVersion** contains ordered **Sections**
- A **Section** contains ordered **Lessons**
- A **Lesson** contains one or more **Videos**
- A **Video** contains ordered **Clips** and **ClipSections**, interleaved in a shared ordering space
- A **Video** with at least one **Clip** has an **Export Hash**; a video with no clips is not considered a real video
- An **Exported Video** file is shared across **CourseVersions** via `{courseId}-{exportHash}.mp4` naming — if clips haven't changed, the hash matches and no re-export is needed
- A **Standalone Video** belongs directly to a **Course** with no **Lesson** parent
- A **Recording Session** produces multiple **Optimistic Clips** that become **Clips** on persistence
- A **Plan** is independent of the **Course** hierarchy and contains **PlanSections** with **PlanLessons**
- **Publishing** uploads to Dropbox, freezes the **Draft Version** into a **Published Version**, and creates a new **Draft Version** — all atomically (Dropbox upload must succeed first)

## Example dialogue (updated)

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

## Flagged ambiguities

- **"Version"** — Used both for **CourseVersion** (structural snapshots) and implicitly for content history via `previousVersionLessonId`/`previousVersionSectionId` cross-references. These serve different purposes: one is a named milestone, the other is a migration link between versions. Now additionally distinguished as **Draft Version** vs **Published Version** by position (latest = draft).
- **Clips and ClipSections share an ordering space** — Both use the same `order` field with fractional indexing. The UI must treat them as a single interleaved list, not two separate collections. This is a source of complexity when inserting or reordering.
- **"Plan" vs course structure** — A **Plan** (`plans` table) is entirely disconnected from the **Course**/Section/Lesson hierarchy. There is no enforced link between a **PlanLesson** and an actual **Lesson**. The relationship is purely semantic.
- **"Export Version Key" vs "CourseVersion"** — These are unrelated concepts that both use the word "version." The **Export Version Key** is a build-time constant for cache-busting video exports. A **CourseVersion** is a domain snapshot of course structure. Do not confuse them.
- **"Clear" / "Delete from file system"** (resolved) — Previously used interchangeably for removing exported video files. Now canonicalized as **Purge**. "Clear" described the mechanism (clearing files), not the domain action. **Purge** captures the intent: deliberately removing a cached render artifact to transition a video back to Unexported status.
