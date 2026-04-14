/** localStorage-based reading progress tracker */

const PREFIX = "learn_progress_";
const BOOKMARK_PREFIX = "learn_bookmark_";

export interface CourseProgress {
  completedPageIds: Set<number>;
  /** page_id → slug info for the last-read page */
  bookmark?: { pageId: number; href: string; title: string };
}

function storageKey(courseSlug: string): string {
  return `${PREFIX}${courseSlug}`;
}

function bookmarkKey(courseSlug: string): string {
  return `${BOOKMARK_PREFIX}${courseSlug}`;
}

/** Get set of completed page IDs for a course */
export function getCompletedPages(courseSlug: string): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(storageKey(courseSlug));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    return new Set();
  }
}

/** Mark a page as read */
export function markPageRead(courseSlug: string, pageId: number): void {
  if (typeof window === "undefined") return;
  const completed = getCompletedPages(courseSlug);
  completed.add(pageId);
  localStorage.setItem(storageKey(courseSlug), JSON.stringify([...completed]));
}

/** Save bookmark (last-read position) */
export function saveBookmark(
  courseSlug: string,
  pageId: number,
  href: string,
  title: string,
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    bookmarkKey(courseSlug),
    JSON.stringify({ pageId, href, title }),
  );
}

/** Get bookmark for a course */
export function getBookmark(
  courseSlug: string,
): { pageId: number; href: string; title: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(bookmarkKey(courseSlug));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Count total pages in a course */
export function countPages(
  sections: { pages?: { id: number }[] }[],
): number {
  return sections.reduce((sum, s) => sum + (s.pages?.length ?? 0), 0);
}
