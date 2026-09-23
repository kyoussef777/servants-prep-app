import { useState } from "react";
import { Alert } from "react-native";
import { Button, Card, Copy } from "@/components/ui";
import { Choice, Field, Page, confirmAction, useAction } from "@/components/forms";
import { request, useResource } from "@/data/resources";
import { useAuth } from "@/data/auth-provider";

type Application = { id: string; fullName: string; email: string; phone: string | null; currentGrade: string | null; status: string; reviewNote: string | null };
export default function Applications() {
  const { user } = useAuth();
  const [status, setStatus] = useState("PENDING");
  const resource = useResource<Application[]>(user?.role === "SUPER_ADMIN" ? `/api/servant-applications?status=${status}` : null);
  return <Page title="Servant applications" {...resource}>
    {user?.role !== "SUPER_ADMIN" ? <Copy>Super-admin access is required.</Copy> : <>
      <Choice label="Status" value={status} onChange={setStatus} options={["PENDING", "APPROVED", "REJECTED"].map(value => ({ value, label: value }))} />
      {resource.data && !resource.data.length && <Copy>No applications in this view.</Copy>}
      {resource.data?.map(a => <ApplicationCard key={a.id} application={a} refresh={resource.refresh} />)}
    </>}
  </Page>;
}
function ApplicationCard({ application: a, refresh }: { application: Application; refresh: () => Promise<void> }) {
  const [note, setNote] = useState("");
  const action = useAction();
  const review = (decision: string) => confirmAction(`${decision === "approve" ? "Approve" : "Reject"} application?`, decision === "approve" ? "This creates a servant account. It must change its temporary password before use. Class access still requires an assignment." : "This rejects the application.", () => void action.run(async () => {
    const result = await request<{ tempPassword?: string }>(`/api/servant-applications/${encodeURIComponent(a.id)}/review`, "POST", { action: decision, note });
    await refresh(); Alert.alert("Application reviewed", result.tempPassword ? `Temporary password: ${result.tempPassword}\nShare privately with the applicant. They must change it before use.` : "Review saved.");
  }));
  return <Card><Copy kind="heading">{a.fullName}</Copy><Copy>{a.email}</Copy>{a.phone && <Copy>{a.phone}</Copy>}{a.currentGrade && <Copy>{a.currentGrade}</Copy>}{a.reviewNote && <Copy>{a.reviewNote}</Copy>}
    {a.status === "PENDING" && <><Field label="Review note" value={note} onChange={setNote} multiline disabled={action.busy} /><Button label="Approve application" disabled={action.busy} onPress={() => review("approve")} /><Button secondary label="Reject application" disabled={action.busy} onPress={() => review("reject")} /></>}
  </Card>;
}
