import type { PropsWithChildren } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SymbolView, type SFSymbol, type AndroidSymbol } from "expo-symbols";
import { useAppTheme } from "@/theme";
import { dataLabel } from "@/data/auth-provider";
import { GlassChrome } from "./chrome";

export function Icon({
  ios,
  android,
  size = 22,
  color,
}: {
  ios: SFSymbol;
  android: AndroidSymbol;
  size?: number;
  color?: string;
}) {
  const { colors } = useAppTheme();
  return (
    <SymbolView
      name={{ ios, android }}
      size={size}
      tintColor={color ?? colors.primary}
    />
  );
}

export function Screen({
  children,
  bottom = 32,
  refreshing = false,
  onRefresh,
}: PropsWithChildren<{
  bottom?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
}>) {
  const { colors } = useAppTheme();
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      style={{ flex: 1, backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        ) : undefined
      }
      contentContainerStyle={[styles.screen, { paddingBottom: bottom }]}
    >
      {children}
    </ScrollView>
  );
}

export function Copy({
  children,
  kind = "body",
  color,
  style,
}: PropsWithChildren<{
  kind?: "title" | "heading" | "body" | "caption" | "eyebrow";
  color?: string;
  style?: StyleProp<import("react-native").TextStyle>;
}>) {
  const { colors } = useAppTheme();
  return (
    <Text
      style={[
        styles[kind],
        {
          color:
            color ??
            (kind === "caption" || kind === "eyebrow"
              ? colors.muted
              : colors.text),
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
  testID,
  glass = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  testID?: string;
  glass?: boolean;
}) {
  const { colors } = useAppTheme();
  const button = (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: glass ? "transparent" : secondary ? colors.primarySoft : colors.primary,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.buttonLabel,
          { color: glass || secondary ? colors.primary : colors.onHero },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
  return glass ? <GlassChrome interactive={!disabled} style={{ borderRadius: 26 }}>{button}</GlassChrome> : button;
}

export function ConnectionBadge() {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        styles.pill,
        { alignSelf: "flex-start", backgroundColor: colors.warningSoft },
      ]}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.warning,
        }}
      />
      <Copy kind="caption" color={colors.warning}>
        {dataLabel}
      </Copy>
    </View>
  );
}

export function Brand() {
  return (
    <View style={styles.row}>
      <Image
        source={require("../../../../public/sunday-school-favicon.png")}
        style={{ width: 44, height: 44 }}
        resizeMode="contain"
        accessibilityLabel="St. Mark church logo"
      />
      <View>
        <Copy kind="heading">St. Mark</Copy>
        <Copy kind="caption">MINISTRY PORTAL</Copy>
      </View>
    </View>
  );
}

export function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={{ gap: 5 }}>
      <Copy kind="heading">{title}</Copy>
      {subtitle && <Copy kind="caption">{subtitle}</Copy>}
    </View>
  );
}

export function RowLink({
  title,
  subtitle,
  onPress,
  icon,
  trailing,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.rowLink, { opacity: pressed ? 0.65 : 1 }]}
    >
      {icon}
      <View style={{ flex: 1, gap: 4 }}>
        <Copy style={{ fontWeight: "600" }}>{title}</Copy>
        {subtitle && <Copy kind="caption">{subtitle}</Copy>}
      </View>
      {trailing}
      <Icon
        ios="chevron.right"
        android="chevron_right"
        size={16}
        color={colors.muted}
      />
    </Pressable>
  );
}

export function CalendarDate({ date }: { date: string }) {
  const { colors } = useAppTheme();
  const value = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  return (
    <View style={[styles.calendar, { backgroundColor: colors.primarySoft }]}>
      <Copy kind="caption" color={colors.primary}>
        {value
          .toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })
          .toUpperCase()}
      </Copy>
      <Copy kind="heading" color={colors.primary}>
        {value.getUTCDate()}
      </Copy>
    </View>
  );
}

export function readableDate(date: string) {
  return new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString(
    "en-US",
    { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" },
  );
}

export const styles = StyleSheet.create({
  screen: {
    padding: 22,
    gap: 24,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -1.1,
    lineHeight: 40,
  },
  heading: { fontSize: 21, fontWeight: "600", letterSpacing: -0.4 },
  body: { fontSize: 16, lineHeight: 23 },
  caption: { fontSize: 13, lineHeight: 19 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.7,
    textTransform: "uppercase",
  },
  card: { borderWidth: 1, borderRadius: 24, padding: 20, gap: 16 },
  button: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonLabel: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 60,
    paddingVertical: 6,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  calendar: {
    width: 56,
    minHeight: 64,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    gap: 2,
  },
});
