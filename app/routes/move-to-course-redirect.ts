export function buildMoveToCourseRedirectUrl(opts: {
  courseId: string;
  lessonId: string;
}): string {
  return `/?courseId=${opts.courseId}#${opts.lessonId}`;
}
