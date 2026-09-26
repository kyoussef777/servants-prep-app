import { Pressable, View } from "react-native";
import { router, Stack } from "expo-router";
import {
  Brand,
  Button,
  Card,
  Copy,
  CopyableValue,
  Icon,
  ConnectionBadge,
  RowLink,
  Screen,
  SectionTitle,
  styles,
} from "@/components/ui";
import { apiOrigin, dataLabel, useAuth } from "@/data/auth-provider";
import { usePortal } from "@/data/portal-provider";
import { useAppTheme, type AppearancePreference } from "@/theme";

export default function Account() {
  const { colors, preference, setPreference } = useAppTheme();
  const { user, signOut } = useAuth();
  const { refresh, loading } = usePortal();
  return (
    <>
      <Stack.Screen options={{ title: "Account" }} />
      <Screen>
        <Brand />
        <ConnectionBadge />
        <Card>
          <View style={styles.row}>
            <Icon
              ios="person.crop.circle.fill"
              android="account_circle"
              size={48}
            />
            <View style={{ flex: 1 }}>
              <Copy kind="heading">{user?.name ?? "Ministry account"}</Copy>
              {user?.email && <CopyableValue label="Email" value={user.email} kind="caption" />}
            </View>
          </View>
        </Card>
        <SectionTitle title="Appearance" />
        <Button secondary label="Edit profile & security" onPress={() => router.push("/profile")} />
        <Card>
          <View
            accessibilityRole="radiogroup"
            style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
          >
            {(["system", "light", "dark"] as AppearancePreference[]).map(
              (value) => (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: preference === value }}
                  onPress={() => setPreference(value)}
                  style={[
                    styles.pill,
                    {
                      flex: 1,
                      minHeight: 48,
                      justifyContent: "center",
                      backgroundColor:
                        preference === value
                          ? colors.primarySoft
                          : colors.background,
                    },
                  ]}
                >
                  <Copy
                    color={preference === value ? colors.primary : colors.muted}
                  >
                    {value[0].toUpperCase() + value.slice(1)}
                  </Copy>
                </Pressable>
              ),
            )}
          </View>
        </Card>
        <Card>
          <RowLink
            title="Notifications"
            subtitle="View notification history"
            icon={<Icon ios="bell" android="notifications" />}
            onPress={() => router.push("/notifications")}
          />
        </Card>
        {user?.role === "SUPER_ADMIN" && <>
          <SectionTitle title="Connected portal" />
          <Card>
            <Copy>{dataLabel}</Copy>
            <Copy kind="caption">{apiOrigin}</Copy>
            <Copy kind="caption">
              Classes, lessons, and attendance come from this portal. Saved
              attendance persists in its database.
            </Copy>
          </Card>
        </>}
        <Button
          label={loading ? "Refreshing…" : "Refresh ministry data"}
          secondary
          disabled={loading}
          onPress={() => void refresh()}
        />
        <Button label="Sign out" onPress={() => void signOut()} />
        <Copy kind="caption" style={{ textAlign: "center" }}>
          St. Mark Ministry Portal · 0.1.0
        </Copy>
      </Screen>
    </>
  );
}
