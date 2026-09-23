import { Pressable, View } from "react-native";
import { router, Stack } from "expo-router";
import { getLevelDisplayName } from "@stmark/domain";
import {
  Brand,
  Button,
  CalendarDate,
  Card,
  Copy,
  Icon,
  ConnectionBadge,
  RowLink,
  Screen,
  SectionTitle,
  styles,
} from "@/components/ui";
import { attendanceKey, meetingDate, usePortal } from "@/data/portal-provider";
import { DataStatus } from "@/components/data-status";
import { useAppTheme } from "@/theme";

export default function Home() {
  const { colors } = useAppTheme();
  const {
    attendance,
    classes,
    lessons,
    unreadCount: unread,
    loading,
    error,
    refresh,
  } = usePortal();
  const pending = classes.filter(
    (cls) =>
      cls.canServe && !attendance[attendanceKey(cls.id, meetingDate(cls))],
  );
  const nextClass = pending[0] ?? classes[0];
  return (
    <>
      <Stack.Screen
        options={{
          title: "Sunday School",
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Notifications, ${unread} unread`}
              onPress={() => router.push("/notifications")}
              style={{
                minWidth: 44,
                minHeight: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon ios="bell" android="notifications" />
              {unread > 0 && (
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    position: "absolute",
                    top: 8,
                    right: 9,
                    backgroundColor: colors.primary,
                  }}
                />
              )}
            </Pressable>
          ),
        }}
      />
      <Screen refreshing={loading} onRefresh={() => void refresh()}>
        <View style={{ gap: 18 }}>
          <Brand />
          <ConnectionBadge />
        </View>
        <View style={{ gap: 10 }}>
          <Copy kind="eyebrow">Welcome to your ministry</Copy>
          <Copy kind="title">
            A little preparation.{"\n"}A lasting difference.
          </Copy>
          <Copy color={colors.muted}>
            Your classes, lessons, and moments of service, all in one place.
          </Copy>
        </View>
        <DataStatus />
        {!loading && !error && !classes.length && (
          <Card>
            <Copy>No classes are assigned to this account yet.</Copy>
          </Card>
        )}
        {nextClass && (
          <Card
            style={{
              backgroundColor: colors.hero,
              borderColor: colors.hero,
              padding: 24,
            }}
          >
            <View style={[styles.row, { justifyContent: "space-between" }]}>
              <Copy kind="eyebrow" color="#F9D0D9">
                THIS WEEK
              </Copy>
              <Icon
                ios="checklist"
                android="checklist"
                size={26}
                color="#F9D0D9"
              />
            </View>
            <Copy kind="heading" color={colors.onHero}>
              {pending.length
                ? "Every child belongs."
                : "Thank you for showing up."}
            </Copy>
            <Copy color="#FCE7EB">
              {pending.length
                ? `Attendance is waiting for ${pending.length} ${pending.length === 1 ? "class" : "classes"}. Start with ${nextClass.name}.`
                : "Open your class to review its roster and attendance."}
            </Copy>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: "/attendance/[classId]",
                  params: { classId: nextClass.id },
                })
              }
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: "#FFFFFF",
                  opacity: pressed ? 0.85 : 1,
                  flexDirection: "row",
                  gap: 10,
                },
              ]}
            >
              <Icon
                ios="checkmark.circle"
                android="check_circle"
                color={colors.hero}
                size={20}
              />
              <Copy color={colors.hero} style={{ fontWeight: "600" }}>
                {pending.length ? "Take attendance" : "Review attendance"}
              </Copy>
            </Pressable>
          </Card>
        )}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Card style={{ flex: 1 }}>
            <Copy kind="title">{classes.length}</Copy>
            <Copy kind="caption">Your classes</Copy>
          </Card>
          <Card style={{ flex: 1 }}>
            <Copy kind="title">
              {classes.reduce(
                (total, cls) => total + (cls._count?.children ?? 0),
                0,
              )}
            </Copy>
            <Copy kind="caption">Children enrolled</Copy>
          </Card>
        </View>
        <SectionTitle
          title="Prepare for class"
          subtitle="A meaningful lesson starts with you."
        />
        <Card>
          {!loading && !lessons.length && <Copy>No upcoming lessons.</Copy>}
          {lessons.slice(0, 4).map((lesson) => (
            <RowLink
              key={lesson.id}
              title={lesson.title ?? "Untitled lesson"}
              subtitle={`${lesson.class.name} · ${getLevelDisplayName(lesson.class.level)}`}
              icon={<CalendarDate date={lesson.sundayDate} />}
              onPress={() =>
                router.push({
                  pathname: "/lesson/[id]",
                  params: { id: lesson.id },
                })
              }
            />
          ))}
        </Card>
        <Button
          label="View my classes"
          secondary
          onPress={() => router.navigate("/(tabs)/classes")}
        />
        <Copy kind="caption" style={{ textAlign: "center" }}>
          “Let all that you do be done with love.”{"\n"}1 Corinthians 16:14
        </Copy>
      </Screen>
    </>
  );
}
