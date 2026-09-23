import { useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, Switch, TextInput, View } from "react-native";
import { Stack } from "expo-router";
import { Button, Card, Copy, Screen } from "./ui";
import { useAppTheme } from "@/theme";

export function Field({ label, value, onChange, multiline = false, disabled = false, secureTextEntry = false, ...rest }: {
  label: string; value: string; onChange: (value: string) => void; multiline?: boolean; disabled?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad" | "numeric"; placeholder?: string; secureTextEntry?: boolean;
}) {
  const { colors } = useAppTheme();
  const [passwordVisible, setPasswordVisible] = useState(false);
  return <View style={{ gap: 7 }}><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
    <Copy kind="caption">{label}</Copy>
    {secureTextEntry && <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${passwordVisible ? "Hide" : "Show"} ${label.toLowerCase()}`}
      disabled={disabled}
      hitSlop={10}
      onPress={() => setPasswordVisible(visible => !visible)}
    ><Copy kind="caption" color={disabled ? colors.muted : colors.primary}>{passwordVisible ? "Hide" : "Show"}</Copy></Pressable>}
  </View><TextInput
    accessibilityLabel={label} value={value} onChangeText={onChange} editable={!disabled}
    multiline={multiline} autoCapitalize={rest.keyboardType === "email-address" || secureTextEntry ? "none" : "sentences"}
    autoCorrect={!secureTextEntry} secureTextEntry={secureTextEntry && !passwordVisible} placeholderTextColor={colors.muted}
    style={{ backgroundColor: colors.surface, color: colors.text, borderColor: colors.border, borderWidth: 1,
      borderRadius: 12, padding: 14, minHeight: multiline ? 100 : 50, textAlignVertical: "top", opacity: disabled ? 0.5 : 1 }} {...rest} /></View>;
}
export type Option = { value: string; label: string };
export function Toggle({ label, value, onChange, disabled = false }: { label: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <View style={{ flexDirection: "row", gap: 14, alignItems: "center", justifyContent: "space-between" }}><Copy style={{ flex: 1 }}>{label}</Copy><Switch accessibilityLabel={label} value={value} onValueChange={onChange} disabled={disabled} /></View>;
}
export function Choice({ label, value, options, onChange, disabled = false }: {
  label: string; value: string; options: Option[]; onChange: (value: string) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { colors } = useAppTheme();
  return <View style={{ gap: 7 }}><Copy kind="caption">{label}</Copy>
    <Button secondary glass disabled={disabled} label={options.find(o => o.value === value)?.label ?? "Choose…"} onPress={() => { setSearch(""); setOpen(true); }} />
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><Screen>
        <Copy kind="heading">{label}</Copy><Button secondary label="Cancel" onPress={() => setOpen(false)} />
        {options.length > 8 && <Field label="Search options" value={search} onChange={setSearch} />}
        {options.filter(o => o.label.toLowerCase().includes(search.toLowerCase())).map(o => <Pressable
          key={o.value} accessibilityRole="radio" accessibilityState={{ checked: o.value === value }}
          onPress={() => { onChange(o.value); setOpen(false); }} style={{ padding: 15, borderRadius: 12, backgroundColor: colors.surface }}>
          <Copy>{o.value === value ? "✓ " : ""}{o.label}</Copy></Pressable>)}
      </Screen></SafeAreaView>
    </Modal></View>;
}
export function ResourceState({ loading, error, retry, empty }: { loading: boolean; error?: string; retry: () => void; empty?: boolean }) {
  if (loading) return <ActivityIndicator accessibilityLabel="Loading" />;
  if (error) return <Card><Copy>{error}</Copy><Button label="Try again" onPress={retry} /></Card>;
  return empty ? <Card><Copy>No records found.</Copy></Card> : null;
}
export function Page({ title, children, loading = false, error, refresh }: {
  title: string; children: ReactNode; loading?: boolean; error?: string; refresh?: () => void;
}) {
  return <><Stack.Screen options={{ title }} /><Screen refreshing={loading} onRefresh={refresh}>
    <ResourceState loading={loading} error={error} retry={() => refresh?.()} />{children}
  </Screen></>;
}
export function useAction() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<void>, success?: string) => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await action(); if (success) Alert.alert(success); }
    catch (error) { Alert.alert("Unable to complete", error instanceof Error ? error.message : "Please try again."); }
    finally { lock.current = false; setBusy(false); }
  };
  return { busy, run };
}
export function confirmAction(title: string, message: string, action: () => void, destructive = false) {
  Alert.alert(title, message, [{ text: "Cancel", style: "cancel" }, { text: "Confirm", style: destructive ? "destructive" : "default", onPress: action }]);
}
