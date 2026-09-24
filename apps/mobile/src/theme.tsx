import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { Appearance, useColorScheme } from "react-native";

// Mirrors app/globals.css: the website's neutral surfaces and Sunday School
// maroon scale are the source of truth for native color decisions.
const light = {
  background: "#FFFFFF",
  surface: "#FFFFFF",
  text: "#0A0A0A",
  muted: "#737373",
  border: "#E5E5E5",
  primary: "#6B001A",
  primarySoft: "#F5F2F2",
  action: "#800020",
  onAction: "#FFFFFF",
  success: "#16A34A",
  successSoft: "#F0FDF4",
  warning: "#A16207",
  warningSoft: "#FEFCE8",
  danger: "#DC2626",
  dangerSoft: "#FEF2F2",
  hero: "#5C1A1A",
  onHero: "#FFFFFF",
};
const dark: typeof light = {
  background: "#1C1C1E",
  surface: "#242426",
  text: "#F5F5F7",
  muted: "#98989D",
  border: "rgba(255, 255, 255, 0.08)",
  primary: "#F5F5F7",
  primarySoft: "rgba(255, 255, 255, 0.10)",
  action: "#800020",
  onAction: "#FFFFFF",
  success: "#4ADE80",
  successSoft: "rgba(20, 83, 45, 0.45)",
  warning: "#FACC15",
  warningSoft: "rgba(113, 63, 18, 0.45)",
  danger: "#FF6467",
  dangerSoft: "rgba(127, 29, 29, 0.45)",
  hero: "#5C1A1A",
  onHero: "#FFFFFF",
};

export type AppearancePreference = "system" | "light" | "dark";
const ThemeContext = createContext<{
  colors: typeof light;
  isDark: boolean;
  preference: AppearancePreference;
  setPreference: (value: AppearancePreference) => void;
} | null>(null);

export function AppThemeProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const [preference, setPreference] = useState<AppearancePreference>("system");
  const isDark = (preference === "system" ? system : preference) === "dark";
  useEffect(() => {
    if (typeof Appearance?.setColorScheme !== "function") return;
    Appearance.setColorScheme(
      preference === "system" ? "unspecified" : preference,
    );
    return () => Appearance?.setColorScheme?.("unspecified");
  }, [preference]);
  return (
    <ThemeContext.Provider
      value={{
        colors: isDark ? dark : light,
        isDark,
        preference,
        setPreference,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("AppThemeProvider is missing");
  return value;
}
