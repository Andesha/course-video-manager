import { describe, it, expect } from "vitest";
import { buildMoveToCourseRedirectUrl } from "./move-to-course-redirect";

describe("buildMoveToCourseRedirectUrl", () => {
  it("should include courseId query param and lesson anchor fragment", () => {
    const url = buildMoveToCourseRedirectUrl({
      courseId: "course-123",
      lessonId: "lesson-456",
    });
    expect(url).toBe("/?courseId=course-123#lesson-456");
  });

  it("should handle special characters in IDs", () => {
    const url = buildMoveToCourseRedirectUrl({
      courseId: "abc-def-ghi",
      lessonId: "xyz-123-456",
    });
    expect(url).toBe("/?courseId=abc-def-ghi#xyz-123-456");
  });
});
