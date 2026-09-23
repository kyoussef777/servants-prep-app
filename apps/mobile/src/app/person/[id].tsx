import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import type { RoleTag } from "@stmark/contracts";
import { Button, Card, Copy } from "@/components/ui";
import { Field, Page, Toggle, confirmAction, useAction } from "@/components/forms";
import { request, useResource } from "@/data/resources";
import { useAuth } from "@/data/auth-provider";
import { accessTagLabels, type Person } from "@/data/people";

export default function PersonScreen() {
  const { id, disabled } = useLocalSearchParams<{ id: string; disabled?: string }>();
  const { user } = useAuth();
  const resource = useResource<Person>(user?.role === "SUPER_ADMIN" && id !== "new" ? `/api/users/${encodeURIComponent(id)}` : null);
  return <Page title={id === "new" ? "New account" : "Manage account"} {...resource}>
    {user?.role !== "SUPER_ADMIN" ? <Copy>Super-admin access is required.</Copy> : (id === "new" || resource.data) && <PersonEditor key={`${id}:${resource.data?.name}`} person={resource.data} initiallyDisabled={disabled === "true"} refresh={resource.refresh} />}
  </Page>;
}
function PersonEditor({ person, initiallyDisabled, refresh }: { person?: Person; initiallyDisabled: boolean; refresh: () => Promise<void> }) {
  const { user } = useAuth();
  const [name, setName] = useState(person?.name ?? "");
  const [email, setEmail] = useState(person?.email ?? "");
  const [phone, setPhone] = useState(person?.phone ?? "");
  const [password, setPassword] = useState("");
  const [tags, setTags] = useState<RoleTag[]>(person?.roleAssignments.map(r => r.tag) ?? ["SUNDAY_SCHOOL_SERVANT"]);
  const [note, setNote] = useState("");
  const [isDisabled, setDisabled] = useState(initiallyDisabled);
  const action = useAction();
  return <><Card><Field label="Full name" value={name} onChange={setName} disabled={action.busy} /><Field label="Email" keyboardType="email-address" value={email} onChange={setEmail} disabled={action.busy || person?.id === user?.id} /><Field label="Phone" keyboardType="phone-pad" value={phone} onChange={setPhone} disabled={action.busy} />
    {!person && <Field label="Initial password (share privately)" value={password} onChange={setPassword} secureTextEntry disabled={action.busy} />}
    {person && <Button label="Save contact details" disabled={action.busy || !name.trim() || !email.trim()} onPress={() => void action.run(async () => { await request(`/api/users/${encodeURIComponent(person.id)}`, "PATCH", { name, email, phone }); await refresh(); }, "Account updated")} />}
  </Card><Card><Copy kind="heading">Access tags</Copy><Copy kind="caption">Tags control participation. Servants still need class or age-group assignments to access ministry records.</Copy>
    {(Object.entries(accessTagLabels) as [RoleTag, string][]).map(([tag, label]) => <Toggle key={tag} label={label} value={tags.includes(tag)} disabled={action.busy || (person?.id === user?.id && tag === "SUPER_ADMIN")} onChange={selected => setTags(ts => selected ? [...ts, tag] : ts.filter(t => t !== tag))} />)}
    {person && <Field label="Reason for access change" value={note} onChange={setNote} multiline disabled={action.busy} />}
    <Button label={person ? "Save access tags" : "Create account"} disabled={action.busy || (!person && (!name.trim() || !email.trim() || password.length < 8 || !tags.length))} onPress={() => confirmAction(person ? "Change account access?" : "Create account?", `Confirm access for ${email}: ${tags.map(t => accessTagLabels[t]).join(", ") || "No tags"}.`, () => void action.run(async () => {
      if (person) { await request(`/api/admin/users/${encodeURIComponent(person.id)}/roles`, "PUT", { roleTags: tags, note }); await refresh(); }
      else { const created = await request<Person>("/api/users", "POST", { name, email: email.trim().toLowerCase(), phone, password, role: "SERVANT", roleTags: tags }); setPassword(""); router.replace({ pathname: "/person/[id]", params: { id: created.id } }); }
    }, person ? "Access updated" : "Account created"))} />
  </Card>
  {person && <><Button secondary label="View ministry assignments" onPress={() => router.push({ pathname: "/organization", params: { personId: person.id } })} />
    {person.id !== user?.id && person.role !== "SUPER_ADMIN" && <Button secondary label={isDisabled ? "Enable account" : "Disable account"} disabled={action.busy} onPress={() => confirmAction(isDisabled ? "Enable this account?" : "Disable this account?", isDisabled ? "This restores the account’s ability to sign in." : "This prevents sign-in without deleting ministry history.", () => void action.run(async () => { await request("/api/users/bulk-disable", "POST", { userIds: [person.id], isDisabled: !isDisabled }); setDisabled(!isDisabled); }, "Account status updated"))} />}
  </>}
  </>;
}
