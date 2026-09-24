import { Alert, Pressable, View } from "react-native";
import { router, Stack } from "expo-router";
import {
  Card,
  Copy,
  Icon,
  ConnectionBadge,
  RowLink,
  Screen,
} from "@/components/ui";
import { usePortal } from "@/data/portal-provider";
import { DataStatus } from "@/components/data-status";
import { useAppTheme } from "@/theme";

export default function Notifications() {
  const { colors } = useAppTheme();
  const { notifications, markRead, loading, error, refresh } = usePortal();
  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close notifications"
              onPress={() => router.back()}
              style={{
                minWidth: 44,
                minHeight: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon ios="xmark" android="close" />
            </Pressable>
          ),
        }}
      />
      <Screen refreshing={loading} onRefresh={() => void refresh()}>
        <ConnectionBadge />
        <DataStatus />
        {!loading && !error && !notifications.length && (
          <Card>
            <Copy>No notifications.</Copy>
          </Card>
        )}
        {notifications.map((item) => (
          <Card key={item.id}>
            <RowLink
              title={item.title}
              subtitle={item.message}
              icon={<Icon ios="bell" android="notifications" />}
              trailing={
                !item.isRead ? (
                  <View
                    accessibilityLabel="Unread"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: colors.action,
                    }}
                  />
                ) : undefined
              }
              onPress={() => {
                void markRead(item.id).catch((error) =>
                  Alert.alert(
                    "Unable to update notification",
                    error instanceof Error ? error.message : "Try again.",
                  ),
                );
              }}
            />
            <Copy kind="caption">
              {item.isRead ? "Read" : "Tap to mark as read"}
            </Copy>
          </Card>
        ))}
      </Screen>
    </>
  );
}
