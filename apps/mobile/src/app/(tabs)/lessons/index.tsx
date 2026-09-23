import { useState } from "react";
import { router } from "expo-router";
import type { SundaySchoolWeeklyLessonsResponse } from "@stmark/contracts";
import { CalendarDate, Card, Copy, RowLink } from "@/components/ui";
import { Choice, Page } from "@/components/forms";
import { endpoint, query, useResource } from "@/data/resources";
import { usePortal } from "@/data/portal-provider";
import { useAuth } from "@/data/auth-provider";

export default function Lessons() {
  const { classes } = usePortal();
  const { user } = useAuth();
  const [classId, setClassId] = useState("");
  const [view, setView] = useState("upcoming");
  const resource = useResource<SundaySchoolWeeklyLessonsResponse>(`${endpoint("lessons")}?${query({ scope: "year", classId })}`);
  const today = new Date().toISOString().slice(0, 10);
  const lessons = (resource.data?.lessons ?? []).filter(l => view === "all" || (view === "mine" ? l.ownerId === user?.id : view === "past" ? l.sundayDate.slice(0, 10) < today : l.sundayDate.slice(0, 10) >= today));
  if (view === "past") lessons.reverse();
  return <Page title="Weekly lessons" {...resource}>
    <Choice label="Schedule" value={view} onChange={setView} options={[{ value: "upcoming", label: "Upcoming" }, { value: "mine", label: "My lessons" }, { value: "past", label: "Past lessons" }, { value: "all", label: "Full academic year" }]} />
    <Choice label="Class" value={classId} onChange={setClassId} options={[{ value: "", label: "All accessible classes" }, ...classes.map(c => ({ value: c.id, label: c.name }))]} />
    {resource.data && !lessons.length && <Copy>No lessons in this selection.</Copy>}
    {lessons.map(l => <Card key={l.id}><RowLink title={l.title || "Weekly lesson"} subtitle={l.class.name} icon={<CalendarDate date={l.sundayDate} />} onPress={() => router.push({ pathname: "/lesson/[id]", params: { id: l.id, classId: l.classId } })} /><Copy kind="caption">{l.owner?.name ?? "Teacher not assigned"} · {l.resources.length} resources · {l.status.replaceAll("_", " ")}</Copy></Card>)}
  </Page>;
}
