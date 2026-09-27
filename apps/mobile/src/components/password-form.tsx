import { useState } from "react";
import { Button, Card, Copy } from "./ui";
import { Field, useAction } from "./forms";
import { request } from "@/data/resources";
import { useAuth } from "@/data/auth-provider";

export function PasswordForm() {
  const { signOut } = useAuth();
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const action = useAction();
  return <Card><Copy kind="heading">Change password</Copy>
    <Field label="Current password" value={currentPassword} onChange={setCurrent} secureTextEntry disabled={action.busy} />
    <Field label="New password (at least 8 characters)" value={newPassword} onChange={setNew} secureTextEntry disabled={action.busy} />
    <Field label="Confirm new password" value={confirmation} onChange={setConfirmation} secureTextEntry disabled={action.busy} />
    <Button label={action.busy ? "Updating…" : "Change password & sign out"} disabled={action.busy || !currentPassword || newPassword.length < 8 || !confirmation} onPress={() => void action.run(async () => {
      if (newPassword !== confirmation) throw new Error("The new passwords do not match.");
      await request("/api/auth/change-password", "POST", { currentPassword, newPassword });
      setCurrent(""); setNew(""); setConfirmation(""); await signOut();
    }, "Password changed. Sign in with your new password.")} />
  </Card>;
}
