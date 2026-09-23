import { useState } from "react";
import type { SundaySchoolFeedbackIdea, SundaySchoolFeedbackResponse } from "@stmark/contracts";
import { Button, Card, Copy } from "@/components/ui";
import { Choice, Field, Page, confirmAction, useAction } from "@/components/forms";
import { endpoint, query, request, useResource } from "@/data/resources";

const statuses = ["OPEN", "PLANNED", "IN_PROGRESS", "COMPLETED", "DECLINED"] as const;
const option = (value: string) => ({ value, label: value.replaceAll("_", " ") });
export default function Feedback() {
  const [status, setStatus] = useState("ALL");
  const [sort, setSort] = useState("TOP");
  const [editor, setEditor] = useState<SundaySchoolFeedbackIdea | "new" | null>(null);
  const resource = useResource<SundaySchoolFeedbackResponse>(`${endpoint("feedback")}?${query({ status, sort })}`);
  const action = useAction();
  return <Page title="Feedback" {...resource}>
    <Choice label="Status" value={status} onChange={setStatus} options={["ALL", "ACTIVE", ...statuses].map(option)} />
    <Choice label="Sort" value={sort} onChange={setSort} options={[{ value: "TOP", label: "Most upvotes" }, { value: "NEWEST", label: "Newest" }]} />
    {resource.data?.viewer.canSubmit && <Button label="Share an idea" onPress={() => setEditor("new")} />}
    {editor && <FeedbackEditor key={editor === "new" ? "new" : editor.id} idea={editor === "new" ? undefined : editor} done={async () => { setEditor(null); await resource.refresh(); }} cancel={() => setEditor(null)} />}
    {resource.data && !resource.data.ideas.length && <Copy>No ideas in this view.</Copy>}
    {resource.data?.ideas.map(idea => <Card key={idea.id}><Copy kind="heading">{idea.title}</Copy><Copy kind="caption">{idea.submitter?.name ?? "Former member"} · {idea.status.replaceAll("_", " ")}</Copy>
      {idea.description && <Copy>{idea.description}</Copy>}<Copy>{idea.upvotes} upvotes · {idea.downvotes} downvotes</Copy>
      {idea.canVote && <Choice label="Your vote" value={idea.viewerVote ?? ""} disabled={action.busy} options={[{ value: "", label: "No vote" }, { value: "UP", label: "Upvote" }, { value: "DOWN", label: "Downvote" }]} onChange={vote => void action.run(async () => { await request(`${endpoint("feedback", idea.id)}/vote`, "PUT", { vote: vote || null }); await resource.refresh(); })} />}
      {idea.canEdit && <Button secondary label="Edit idea" onPress={() => setEditor(idea)} />}
      {resource.data?.viewer.canModerate && <Choice label="Moderation status" value={idea.status} disabled={action.busy} options={statuses.map(option)} onChange={value => confirmAction("Change idea status?", `Set this idea to ${value.replaceAll("_", " ")}?`, () => void action.run(async () => { await request(endpoint("feedback", idea.id), "PATCH", { status: value }); await resource.refresh(); }))} />}
      {idea.canDelete && <Button secondary label="Delete idea" disabled={action.busy} onPress={() => confirmAction("Delete idea permanently?", "The idea and all its votes will be removed. This cannot be undone.", () => void action.run(async () => { await request(endpoint("feedback", idea.id), "DELETE"); await resource.refresh(); }), true)} />}
    </Card>)}
  </Page>;
}
function FeedbackEditor({ idea, done, cancel }: { idea?: SundaySchoolFeedbackIdea; done: () => Promise<void>; cancel: () => void }) {
  const [title, setTitle] = useState(idea?.title ?? "");
  const [description, setDescription] = useState(idea?.description ?? "");
  const action = useAction();
  return <Card><Field label="Idea title" value={title} onChange={setTitle} disabled={action.busy} /><Field label="Description" value={description} onChange={setDescription} multiline disabled={action.busy} />
    <Button label={action.busy ? "Saving…" : "Save idea"} disabled={action.busy || !title.trim()} onPress={() => void action.run(async () => { await request(endpoint("feedback", idea?.id), idea ? "PATCH" : "POST", { title, description }); await done(); })} /><Button secondary label="Cancel" disabled={action.busy} onPress={cancel} /></Card>;
}
