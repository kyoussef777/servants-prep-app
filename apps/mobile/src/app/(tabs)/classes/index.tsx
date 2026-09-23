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
  return (
    <>
      <Stack.Screen options={{ title: "My classes" }} />
      <Screen refreshing={loading} onRefresh={() => void refresh()}>
        <ConnectionBadge />
        <DataStatus />
        {ministryAccess(dashboard.data).createLevels.length > 0 && <Button label="New class" onPress={() => router.push({ pathname: "/class/[id]", params: { id: "new" } })} />}
        <View style={{ gap: 8 }}>
          <Copy kind="title">Small communities.{"\n"}Growing together.</Copy>
          <Copy color={colors.muted}>
            The classes connected to your ministry.
          </Copy>
        </View>
        {!loading && !error && !classes.length && (
          <Card>
            <Copy>No assigned classes yet.</Copy>
          </Card>
        )}
        {classes.map((cls) => {
          const saved = attendance[attendanceKey(cls.id, meetingDate(cls))];
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
                <Copy>{cls._count?.children} children</Copy>
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
        })}
        <Copy kind="caption">
          Class access follows your current ministry assignments.
        </Copy>
      </Screen>
    </>
  );
}
