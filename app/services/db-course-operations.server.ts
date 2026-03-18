import type { DrizzleDB } from "@/services/drizzle-service.server";
import {
  clips,
  courses,
  courseVersions,
  sections,
  lessons,
  videos,
} from "@/db/schema";
import {
  AmbiguousCourseUpdateError,
  NotFoundError,
  UnknownDBServiceError,
} from "@/services/db-service-errors";
import { asc, desc, eq } from "drizzle-orm";
import { Effect } from "effect";

const makeDbCall = <T>(fn: () => Promise<T>) => {
  return Effect.tryPromise({
    try: fn,
    catch: (e) => new UnknownDBServiceError({ cause: e }),
  });
};

export const createCourseOperations = (db: DrizzleDB) => {
  const getCourseById = Effect.fn("getCourseById")(function* (id: string) {
    const course = yield* makeDbCall(() =>
      db.query.courses.findFirst({
        where: eq(courses.id, id),
      })
    );

    if (!course) {
      return yield* new NotFoundError({
        type: "getCourse",
        params: { id },
      });
    }

    return course;
  });

  const getCourseByFilePath = Effect.fn("getCourseByFilePath")(function* (
    filePath: string
  ) {
    const course = yield* makeDbCall(() =>
      db.query.courses.findFirst({
        where: eq(courses.filePath, filePath),
      })
    );

    if (!course) {
      return yield* new NotFoundError({
        type: "getCourseByFilePath",
        params: { filePath },
      });
    }

    return course;
  });

  const getCourseWithSectionsById = Effect.fn("getCourseWithSectionsById")(
    function* (id: string) {
      const course = yield* makeDbCall(() =>
        db.query.courses.findFirst({
          where: eq(courses.id, id),
          with: {
            versions: {
              orderBy: desc(courseVersions.createdAt),
              with: {
                sections: {
                  with: {
                    lessons: {
                      with: {
                        videos: {
                          orderBy: asc(videos.path),
                          where: eq(videos.archived, false),
                          with: {
                            clips: {
                              orderBy: asc(clips.order),
                              where: eq(clips.archived, false),
                            },
                          },
                        },
                      },
                      orderBy: asc(lessons.order),
                    },
                  },
                  orderBy: asc(sections.order),
                },
              },
            },
          },
        })
      );

      if (!course) {
        return yield* new NotFoundError({
          type: "getCourseWithSections",
          params: { id },
        });
      }

      return course;
    }
  );

  const getCourseWithSectionsByFilePath = Effect.fn(
    "getCourseWithSectionsByFilePath"
  )(function* (filePath: string) {
    const course = yield* getCourseByFilePath(filePath);
    return yield* getCourseWithSectionsById(course.id);
  });

  const getCourses = Effect.fn("getCourses")(function* () {
    const result = yield* makeDbCall(() =>
      db.query.courses.findMany({
        where: eq(courses.archived, false),
      })
    );
    return result;
  });

  const getArchivedCourses = Effect.fn("getArchivedCourses")(function* () {
    const result = yield* makeDbCall(() =>
      db.query.courses.findMany({
        where: eq(courses.archived, true),
      })
    );
    return result;
  });

  const createCourse = Effect.fn("createCourse")(function* (input: {
    filePath: string;
    name: string;
  }) {
    const result = yield* makeDbCall(() =>
      db.insert(courses).values(input).returning()
    );

    const course = result[0];

    if (!course) {
      return yield* new UnknownDBServiceError({
        cause: "No course was returned from the database",
      });
    }

    return course;
  });

  const createGhostCourse = Effect.fn("createGhostCourse")(function* (input: {
    name: string;
  }) {
    const result = yield* makeDbCall(() =>
      db.insert(courses).values({ name: input.name, filePath: null }).returning()
    );

    const course = result[0];

    if (!course) {
      return yield* new UnknownDBServiceError({
        cause: "No course was returned from the database",
      });
    }

    return course;
  });

  const updateCourseName = Effect.fn("updateCourseName")(function* (opts: {
    repoId: string;
    name: string;
  }) {
    const { repoId, name } = opts;
    const [updated] = yield* makeDbCall(() =>
      db.update(courses).set({ name }).where(eq(courses.id, repoId)).returning()
    );

    if (!updated) {
      return yield* new NotFoundError({
        type: "updateCourseName",
        params: { repoId },
      });
    }

    return updated;
  });

  const updateCourseMemory = Effect.fn("updateCourseMemory")(function* (opts: {
    repoId: string;
    memory: string;
  }) {
    const { repoId, memory } = opts;
    const [updated] = yield* makeDbCall(() =>
      db
        .update(courses)
        .set({ memory })
        .where(eq(courses.id, repoId))
        .returning()
    );

    if (!updated) {
      return yield* new NotFoundError({
        type: "updateCourseMemory",
        params: { repoId },
      });
    }

    return updated;
  });

  const updateCourseArchiveStatus = Effect.fn("updateCourseArchiveStatus")(
    function* (opts: { repoId: string; archived: boolean }) {
      const { repoId, archived } = opts;
      const [updated] = yield* makeDbCall(() =>
        db
          .update(courses)
          .set({ archived })
          .where(eq(courses.id, repoId))
          .returning()
      );

      if (!updated) {
        return yield* new NotFoundError({
          type: "updateCourseArchiveStatus",
          params: { repoId },
        });
      }

      return updated;
    }
  );

  const updateCourseFilePath = Effect.fn("updateCourseFilePath")(
    function* (opts: { repoId: string; filePath: string | null }) {
      const { repoId, filePath } = opts;

      const currentCourse = yield* makeDbCall(() =>
        db.query.courses.findFirst({
          where: eq(courses.id, repoId),
        })
      );

      if (!currentCourse) {
        return yield* new NotFoundError({
          type: "updateCourseFilePath",
          params: { repoId },
        });
      }

      if (currentCourse.filePath) {
        const coursesWithSamePath = yield* makeDbCall(() =>
          db.query.courses.findMany({
            where: eq(courses.filePath, currentCourse.filePath!),
          })
        );

        if (coursesWithSamePath.length > 1) {
          return yield* new AmbiguousCourseUpdateError({
            filePath: currentCourse.filePath,
            repoCount: coursesWithSamePath.length,
          });
        }
      }

      const [updated] = yield* makeDbCall(() =>
        db
          .update(courses)
          .set({ filePath })
          .where(eq(courses.id, repoId))
          .returning()
      );

      if (!updated) {
        return yield* new NotFoundError({
          type: "updateCourseFilePath",
          params: { repoId },
        });
      }

      return updated;
    }
  );

  const deleteCourse = Effect.fn("deleteCourse")(function* (repoId: string) {
    yield* makeDbCall(() => db.delete(courses).where(eq(courses.id, repoId)));
  });

  return {
    getCourseById,
    getCourseByFilePath,
    getCourseWithSectionsById,
    getCourseWithSectionsByFilePath,
    getCourses,
    getArchivedCourses,
    createCourse,
    createGhostCourse,
    updateCourseName,
    updateCourseMemory,
    updateCourseArchiveStatus,
    updateCourseFilePath,
    deleteCourse,
  };
};
