import { useCallback, useState } from "react";
import { View } from "react-native";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { AppThemeProvider, useAppTheme } from "@/theme";
import { AuthProvider, useAuth } from "@/data/auth-provider";
import { PortalProvider } from "@/data/portal-provider";
import SignIn from "@/components/sign-in";
import LaunchScreen from "@/components/launch-screen";

export { ErrorBoundary } from "expo-router";
export const unstable_settings = { initialRouteName: "(tabs)" };

SplashScreen.setOptions({ duration: 500, fade: true });

function Navigation() {
  const { colors, isDark } = useAppTheme();
  const base = isDark ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider
      value={{
        ...base,
        colors: {
          ...base.colors,
          primary: colors.primary,
          background: colors.background,
          card: colors.surface,
          text: colors.text,
          border: colors.border,
        },
      }}
    >
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerTintColor: colors.primary,
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "" }} />
        <Stack.Screen
          name="attendance/[classId]"
          options={{ title: "Take attendance" }}
        />
        <Stack.Screen name="lesson/[id]" options={{ title: "Weekly lesson" }} />
        <Stack.Screen
          name="notifications"
          options={{ title: "Notifications", presentation: "modal" }}
        />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </AppThemeProvider>
  );
}

function AuthenticatedApp() {
  const { user, loading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const finishSplash = useCallback(() => setShowSplash(false), []);

  return (
    <View style={{ flex: 1, backgroundColor: "#5C1A1A" }}>
      {!loading &&
        (!user || user.mustChangePassword ? (
          <SignIn />
        ) : (
          <PortalProvider key={user.id}>
            <Navigation />
          </PortalProvider>
        ))}
      {showSplash && (
        <LaunchScreen ready={!loading} onFinished={finishSplash} />
      )}
    </View>
  );
}
