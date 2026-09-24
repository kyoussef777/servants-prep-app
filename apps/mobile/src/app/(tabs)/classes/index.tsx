import { View } from "react-native";
import { router, Stack } from "expo-router";
import { getClassMeetingDayName, getLevelDisplayName } from "@stmark/domain";
import {
  Button,
  Card,
  Copy,
  Icon,
  ConnectionBadge,
  Screen,
  styles,
} from "@/components/ui";
import { meetingDate, attendanceKey, usePortal } from "@/data/portal-provider";
import { DataStatus } from "@/components/data-status";
import { useAppTheme } from "@/theme";
import type { SundaySchoolDashboard } from "@stmark/contracts";
import { endpoint, useResource } from "@/data/resources";
import { ministryAccess } from "@/data/ministry";

export default function Classes() {
  const { colors } = useAppTheme();
  const { attendance, classes, loading, error, refresh } = usePortal();
  const dashboard = useResource<SundaySchoolDashboard>(endpoint("dashboard"));
  const canCreateClass =
    ministryAccess(dashboard.data).createLevels.length > 0;
  const onlyClass = classes.length === 1 ? classes[0] : undefined;
  const onlyClassAttendance = onlyClass
    ? attendance[attendanceKey(onlyClass.id, meetingDate(onlyClass))]
    : undefined;
  const onlyClassChildCount = onlyClass?._count?.children ?? 0;
  return (
    <>
      <Stack.Screen options={{ title: onlyClass ? "My class" : "My classes" }} />
      <Screen refreshing={loading} onRefresh={() => void refresh()}>
        <ConnectionBadge />
        <DataStatus />
        {canCreateClass && <Button label="New class" onPress={() => router.push({ pathname: "/class/[id]", params: { id: "new" } })} />}
        {!loading && !error && !classes.length && (
          <Card>
            <Copy>No assigned classes yet.</Copy>
          </Card>
        )}
        {!onlyClass && classes.length > 1 && (
          <View style={{ gap: 8 }}>
            <Copy kind="title">
              Small communities.{"\n"}Growing together.
            </Copy>
            <Copy color={colors.muted}>
              The classes connected to your ministry.
            </Copy>
          </View>
        )}
        {onlyClass ? (
          <>
            <View style={{ gap: 8 }}>
              <Copy kind="eyebrow">Your class</Copy>
              <Copy kind="title">{onlyClass.name}</Copy>
              <Copy color={colors.muted}>
                {getLevelDisplayName(onlyClass.level)} ·{" "}
                {getClassMeetingDayName(onlyClass.level)}s ·{" "}
                {onlyClassChildCount}{" "}
                {onlyClassChildCount === 1 ? "child" : "children"}
              </Copy>
            </View>
            <Card>
              <View
                style={[
                  styles.row,
                  { justifyContent: "space-between", flexWrap: "wrap" },
                ]}
              >
                <View style={styles.row}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      backgroundColor: colors.primarySoft,
                      borderRadius: 15,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon ios="person.2.fill" android="groups" />
                  </View>
                  <Copy style={{ fontWeight: "600" }}>This week</Copy>
                </View>
                <View
                  style={[
                    styles.pill,
                    {
                      backgroundColor: onlyClassAttendance
                        ? colors.successSoft
                        : colors.warningSoft,
                    },
                  ]}
                >
                  <Copy
                    kind="caption"
                    color={
                      onlyClassAttendance ? colors.success : colors.warning
                    }
                  >
                    {!onlyClass.canServe
                      ? "Read-only"
                      : onlyClassAttendance
                        ? "Attendance recorded"
                        : "Attendance to do"}
                  </Copy>
                </View>
              </View>
              <Button
                label={
                  onlyClass.canServe
                    ? "Take attendance"
                    : "View attendance"
                }
                onPress={() =>
                  router.push({
                    pathname: "/attendance/[classId]",
                    params: { classId: onlyClass.id },
                  })
                }
              />
              <Button
                secondary
                label="Class details"
                onPress={() =>
                  router.push({
                    pathname: "/class/[id]",
                    params: { id: onlyClass.id },
                  })
                }
              />
            </Card>
            <Copy kind="caption">Your current ministry assignment.</Copy>
          </>
        ) : classes.length > 1 ? classes.map((cls) => {
          const saved = attendance[attendanceKey(cls.id, meetingDate(cls))];
          const childCount = cls._count?.children ?? 0;
          return (
            <Card key={cls.id}>
              <View style={styles.row}>
                <View
                  style={{
                    width: 52,
                    height: 52,
                    backgroundColor: colors.primarySoft,
                    borderRadius: 17,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon ios="person.2.fill" android="groups" />
                </View>
                <View style={{ gap: 4 }}>
                  <Copy kind="heading">{cls.name}</Copy>
                  <Copy kind="caption">
                    {getLevelDisplayName(cls.level)} ·{" "}
                    {getClassMeetingDayName(cls.level)}s
                  </Copy>
                </View>
              </View>
              <View
                style={[
                  styles.row,
                  { justifyContent: "space-between", flexWrap: "wrap" },
                ]}
              >
                <Copy>
                  {childCount} {childCount === 1 ? "child" : "children"}
                </Copy>
                <View
                  style={[
                    styles.pill,
                    {
                      backgroundColor: saved
                        ? colors.successSoft
                        : colors.warningSoft,
                    },
                  ]}
                >
                  <Copy
                    kind="caption"
                    color={saved ? colors.success : colors.warning}
                  >
                    {!cls.canServe
                      ? "Read-only"
                      : saved
                        ? "Attendance recorded"
                        : "Attendance to do"}
                  </Copy>
                </View>
              </View>
              <Button
                label="Open class"
                onPress={() =>
                  router.push({
                    pathname: "/class/[id]",
                    params: { id: cls.id },
                  })
                }
              />
            </Card>
          );
        }) : null}
        {!onlyClass && classes.length > 1 && (
          <Copy kind="caption">
            Class access follows your current ministry assignments.
          </Copy>
        )}
      </Screen>
    </>
  );
}
