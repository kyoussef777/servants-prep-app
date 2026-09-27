import { describe, expect, it } from "vitest";
import {
  marksForRoster,
  rosterProgress,
  sameMarks,
  shiftWeek,
  type AttendanceMarks,
} from "../../apps/mobile/src/data/attendance-draft";

describe("mobile attendance drafts", () => {
  it("starts unmarked, rather than silently marking children present", () => {
    expect(rosterProgress(["a", "b"], {})).toEqual({
      marked: 0,
      present: 0,
      complete: false,
    });
  });

  it("requires a valid status for every child and a nonempty roster", () => {
    expect(rosterProgress([], {}).complete).toBe(false);
    expect(rosterProgress(["a", "b"], { a: "PRESENT" }).complete).toBe(false);
    expect(
      rosterProgress(["a"], { a: "INVALID" } as unknown as AttendanceMarks)
        .complete,
    ).toBe(false);
    expect(
      rosterProgress(["a", "b", "c", "d"], {
        a: "PRESENT",
        b: "LATE",
        c: "ABSENT",
        d: "EXCUSED",
      }),
    ).toEqual({ marked: 4, present: 2, complete: true });
  });

  it("ignores marks from another class when calculating progress", () => {
    expect(rosterProgress(["a"], { b: "PRESENT" })).toEqual({
      marked: 0,
      present: 0,
      complete: false,
    });
  });

  it("takes an independent snapshot containing only the current roster", () => {
    const draft: AttendanceMarks = { a: "PRESENT", b: "ABSENT", other: "LATE" };
    const snapshot = marksForRoster(["a", "b", "unmarked"], draft);
    expect(snapshot).toEqual({ a: "PRESENT", b: "ABSENT" });
    draft.a = "EXCUSED";
    expect(snapshot.a).toBe("PRESENT");
  });

  it("detects unsaved changes only within the selected roster", () => {
    expect(
      sameMarks(["a"], { a: "PRESENT" }, { a: "PRESENT", b: "LATE" }),
    ).toBe(true);
    expect(sameMarks(["a"], { a: "PRESENT" }, { a: "ABSENT" })).toBe(false);
    expect(sameMarks(["a"], { a: "PRESENT" }, {})).toBe(false);
  });

  it.each([
    ["2026-01-03", -1, "2025-12-27"],
    ["2026-12-27", 1, "2027-01-03"],
    ["2026-03-08", -1, "2026-03-01"],
    ["2026-11-01", 1, "2026-11-08"],
    ["2024-02-25", 1, "2024-03-03"],
  ] as const)(
    "shifts %s by %s week without timezone drift",
    (date, direction, expected) => {
      expect(shiftWeek(date, direction)).toBe(expected);
    },
  );
});
