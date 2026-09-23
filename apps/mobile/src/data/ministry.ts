import type { SundaySchoolClass, SundaySchoolDashboard, SundaySchoolLevel } from "@stmark/contracts";
import { LEVEL_ORDER } from "@stmark/domain";

// These are UI affordances only; every API request still authorizes on the server.
export function ministryAccess(dashboard?: SundaySchoolDashboard, classes: SundaySchoolClass[] = []) {
  const admin = dashboard?.standing.isAdmin === true;
  const readOnly = dashboard?.standing.readOnly !== false;
  return {
    admin, readOnly,
    canAddChild: !readOnly && (admin || classes.some(c => c.canServe)),
    canTakeServantAttendance: dashboard?.attendanceTrend.canViewServantAttendance === true,
    createLevels: (readOnly ? [] : admin ? LEVEL_ORDER : dashboard?.ageGroups.filter(g => g.canCoordinate).flatMap(g => g.levels) ?? []) as SundaySchoolLevel[],
  };
}
export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
