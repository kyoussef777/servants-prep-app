import { useState } from "react";
import { View } from "react-native";
import { router, Stack } from "expo-router";
import type { SundaySchoolWeeklyLessonsResponse } from "@stmark/contracts";
import {
  CalendarDate,
  Card,
  Copy,
  RowLink,
  Screen,
} from "@/components/ui";
import { Choice, ResourceState } from "@/components/forms";
import { endpoint, query, useResource } from "@/data/resources";
import { usePortal } from "@/data/portal-provider";
import { useAuth } from "@/data/auth-provider";
import { useAppTheme } from "@/theme";

const scheduleOptions = [
  { value: "upcoming", label: "Upcoming" },
  { value: "mine", label: "My lessons" },
  { value: "past", label: "Past lessons" },
  { value: "all", label: "Full academic year" },
];

export default function Lessons() {
  const { colors } = useAppTheme();
  const { classes } = usePortal();
  const { user } = useAuth();
  const [classId, setClassId] = useState("");
  const [view, setView] = useState("upcoming");
  const resource = useResource<SundaySchoolWeeklyLessonsResponse>(
    `${endpoint("lessons")}?${query({ scope: "year", classId })}`,
  );
  const today = new Date().toISOString().slice(0, 10);
  const lessons = (resource.data?.lessons ?? []).filter((lesson) => {
    if (view === "all") return true;
    if (view === "mine") return lesson.ownerId === user?.id;
    if (view === "past") return lesson.sundayDate.slice(0, 10) < today;
    return lesson.sundayDate.slice(0, 10) >= today;
  });
  if (view === "past") lessons.reverse();

  return (
    <>
      <Stack.Screen
        options={{ title: "Weekly lessons", headerLargeTitle: false }}
      />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            width: "100%",
            maxWidth: 720,
            alignSelf: "center",
            paddingHorizontal: 22,
            paddingTop: 16,
            gap: 12,
          }}
        >
          <Choice
            label="Schedule"
            value={view}
            onChange={setView}
            options={scheduleOptions}
          />
          <Choice
            label="Class"
            value={classId}
            onChange={setClassId}
            options={[
              { value: "", label: "All accessible classes" },
              ...classes.map((schoolClass) => ({
                value: schoolClass.id,
                label: schoolClass.name,
              })),
            ]}
          />
        </View>
        <Screen
          refreshing={resource.loading || resource.refreshing}
          onRefresh={() => void resource.refresh()}
        >
          <ResourceState
            loading={resource.loading}
            error={resource.error}
            retry={() => void resource.refresh()}
          />
          {resource.data && !lessons.length && (
            <Copy>No lessons in this selection.</Copy>
          )}
          {lessons.map((lesson) => (
            <Card key={lesson.id}>
              <RowLink
                title={lesson.title || "Weekly lesson"}
                subtitle={lesson.class.name}
                icon={<CalendarDate date={lesson.sundayDate} />}
                onPress={() =>
                  router.push({
                    pathname: "/lesson/[id]",
                    params: { id: lesson.id, classId: lesson.classId },
                  })
                }
              />
              <Copy kind="caption">
                {lesson.owner?.name ?? "Teacher not assigned"} ·{" "}
                {lesson.resources.length} resources ·{" "}
                {lesson.status.replaceAll("_", " ")}
              </Copy>
            </Card>
          ))}
        </Screen>
      </View>
    </>
  );
}
