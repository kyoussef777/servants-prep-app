import type { AttendanceStatus } from "@stmark/contracts";

export type AttendanceMarks = Record<string, AttendanceStatus>;
export function rosterProgress(ids: string[], marks: AttendanceMarks) {
  const statuses = ids.map((id) => marks[id]);
  return {
    marked: statuses.filter(Boolean).length,
    present: statuses.filter((value) => value === "PRESENT" || value === "LATE")
      .length,
    complete:
      ids.length > 0 &&
      statuses.every((value) =>
        ["PRESENT", "LATE", "ABSENT", "EXCUSED"].includes(value),
      ),
  };
}

export function marksForRoster(
  ids: string[],
  marks: AttendanceMarks,
): AttendanceMarks {
  return Object.fromEntries(
    ids.filter((id) => marks[id]).map((id) => [id, marks[id]]),
  );
}

export function sameMarks(
  ids: string[],
  left: AttendanceMarks,
  right: AttendanceMarks,
) {
  return ids.every((id) => left[id] === right[id]);
}

export function shiftWeek(date: string, direction: -1 | 1) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + direction * 7);
  return value.toISOString().slice(0, 10);
}
