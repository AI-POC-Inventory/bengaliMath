/** Groups a class's chapters by subject (পাটীগণিত/বীজগণিত/জ্যামিতি/বিবিধ) for
 * the chapter list, instead of showing them in whatever order the API
 * returns. Only Class 7 is mapped today -- matches this project's existing
 * "ship generalized, Class VII only functional" pattern (see e.g.
 * chapter_gcs_map). A class with no entry here just isn't grouped: the
 * caller falls back to the book's own chapter order, ungrouped.
 *
 * The mapping itself: Class 7's WBBSE book has no trigonometry (confirmed
 * against its own printed contents page) -- it covers arithmetic, algebra
 * and geometry, plus two chapters (bar graphs, fun math) that fit neither,
 * grouped here as বিবিধ rather than forced into one of the three.
 */

export type SubjectKey = 'patiganit' | 'bijganit' | 'jyamiti' | 'bibidh';

export const SUBJECT_LABELS: Record<SubjectKey, string> = {
  patiganit: 'পাটীগণিত',
  bijganit: 'বীজগণিত',
  jyamiti: 'জ্যামিতি',
  bibidh: 'বিবিধ',
};

export const SUBJECT_ORDER: SubjectKey[] = ['patiganit', 'bijganit', 'jyamiti', 'bibidh'];

export const CHAPTER_SUBJECTS: Record<number, Record<string, SubjectKey>> = {
  7: {
    // পাটীগণিত (arithmetic)
    '7-1': 'patiganit', '7-2': 'patiganit', '7-4': 'patiganit',
    '7-10': 'patiganit', '7-11': 'patiganit', '7-15': 'patiganit',
    // বীজগণিত (algebra)
    '7-3': 'bijganit', '7-5': 'bijganit', '7-6': 'bijganit',
    '7-12': 'bijganit', '7-19': 'bijganit', '7-22': 'bijganit',
    // জ্যামিতি (geometry)
    '7-7': 'jyamiti', '7-8': 'jyamiti', '7-13': 'jyamiti', '7-14': 'jyamiti',
    '7-17': 'jyamiti', '7-18': 'jyamiti', '7-20': 'jyamiti', '7-21': 'jyamiti',
    // বিবিধ (neither -- bar graphs, fun math)
    '7-16': 'bibidh', '7-23': 'bibidh',
  },
};

export interface SubjectGroup<T> {
  subject: SubjectKey | null;   // null = "unmapped" (no entry for this class, or a chapter the map doesn't cover yet)
  label: string | null;
  chapters: T[];
}

/** chapter.id is expected in the "{classId}-{n}" shape used throughout this
 * app (e.g. "7-14"); the trailing number orders chapters within a subject
 * group back into the book's own sequence, since the API doesn't guarantee
 * any particular order. */
function chapterNumber(id: string): number {
  const n = parseInt(id.split('-').pop() ?? '', 10);
  return Number.isNaN(n) ? 0 : n;
}

export function groupChaptersBySubject<T extends { id: string }>(
  classId: number, chapters: T[],
): SubjectGroup<T>[] {
  const map = CHAPTER_SUBJECTS[classId];
  if (!map) return [{ subject: null, label: null, chapters }];

  const bySubject = new Map<SubjectKey, T[]>();
  const unmapped: T[] = [];
  for (const ch of chapters) {
    const subject = map[ch.id];
    if (!subject) { unmapped.push(ch); continue; }
    (bySubject.get(subject) ?? bySubject.set(subject, []).get(subject)!).push(ch);
  }

  const groups: SubjectGroup<T>[] = SUBJECT_ORDER
    .filter(s => bySubject.has(s))
    .map(subject => ({
      subject, label: SUBJECT_LABELS[subject],
      chapters: [...bySubject.get(subject)!].sort((a, b) => chapterNumber(a.id) - chapterNumber(b.id)),
    }));

  // Safety net, not expected to trigger today: a chapter this class's map
  // doesn't cover yet (e.g. a newly added one) still shows up, just ungrouped
  // at the end, rather than silently disappearing from the list.
  if (unmapped.length) groups.push({ subject: null, label: null, chapters: unmapped });

  return groups;
}
