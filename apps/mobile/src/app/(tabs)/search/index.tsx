import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  TextInput,
  View,
} from "react-native";
import {
  router,
  Stack,
  type Href,
  useFocusEffect,
} from "expo-router";
import type {
  SundaySchoolDashboard,
  SundaySchoolSearchResponse,
} from "@stmark/contracts";
import {
  CalendarDate,
  CompactRow,
  Copy,
  Icon,
  ListSurface,
  Screen,
  SectionTitle,
} from "@/components/ui";
import { TopActions } from "@/components/top-actions";
import { endpoint, request, useResource } from "@/data/resources";
import { usePortal } from "@/data/portal-provider";
import {
  filterSearchTools,
  searchTools,
  type SearchTool,
} from "@/data/search-tools";
import { useAppTheme } from "@/theme";

const resultCache = new Map<string, SundaySchoolSearchResponse>();

export default function Search() {
  const { colors } = useAppTheme();
  const { classes } = usePortal();
  const dashboard = useResource<SundaySchoolDashboard>(endpoint("dashboard"));
  const input = useRef<TextInput>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SundaySchoolSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const trimmed = query.trim();
  const tools = filterSearchTools(
    searchTools(dashboard.data, classes),
    trimmed.length >= 2 ? trimmed : "",
  );

  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => input.current?.focus(), 120);
      return () => clearTimeout(timer);
    }, []),
  );

  useEffect(() => {
    if (trimmed.length < 2) {
      setLoading(false);
      setError(null);
      setResults(null);
      return;
    }
    const normalized = trimmed.toLowerCase();
    const cached = resultCache.get(normalized);
    if (cached) setResults(cached);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      void request<SundaySchoolSearchResponse>(
        `${endpoint("search")}?q=${encodeURIComponent(trimmed)}&limit=6`,
        "GET",
        undefined,
        { signal: controller.signal },
      )
        .then((next) => {
          if (controller.signal.aborted) return;
          resultCache.set(normalized, next);
          setResults(next);
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          setError(
            reason instanceof Error
              ? reason.message
              : "Search is unavailable. Please try again.",
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, retry]);

  const showResults = trimmed.length >= 2;
  const resultCount = results
    ? results.children.length + results.classes.length + results.lessons.length
    : 0;
  const noResults = showResults && !loading && !error && resultCount === 0 && tools.length === 0;

  return (
    <>
      <Stack.Screen
        options={{
          title: "Search",
          headerLargeTitle: false,
          headerRight: () => <TopActions />,
        }}
      />
      <Screen bottom={48}>
        <View
          style={{
            minHeight: 52,
            borderRadius: 18,
            paddingHorizontal: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            backgroundColor: colors.primarySoft,
          }}
        >
          <Icon
            ios="magnifyingglass"
            android="search"
            size={19}
            color={colors.muted}
          />
          <TextInput
            ref={input}
            accessibilityLabel="Search Sunday School"
            value={query}
            onChangeText={setQuery}
            placeholder="Children, classes, lessons, or tools"
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            autoCorrect={false}
            clearButtonMode="while-editing"
            style={{ flex: 1, color: colors.text, fontSize: 17, minHeight: 52 }}
          />
          {loading && <ActivityIndicator size="small" color={colors.primary} />}
          {!!query && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={10}
              onPress={() => setQuery("")}
            >
              <Icon
                ios="xmark.circle.fill"
                android="cancel"
                size={18}
                color={colors.muted}
              />
            </Pressable>
          )}
        </View>

        {!showResults ? (
          <SearchGroup title="Quick access" tools={tools.slice(0, 7)} />
        ) : (
          <>
            {error && (
              <ListSurface>
                <View style={{ paddingVertical: 16, gap: 8 }}>
                  <Copy color={colors.danger}>{error}</Copy>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setRetry((value) => value + 1)}
                  >
                    <Copy color={colors.primary} style={{ fontWeight: "600" }}>
                      Try again
                    </Copy>
                  </Pressable>
                </View>
              </ListSurface>
            )}
            {results?.children.length ? (
              <ResultGroup title="Children">
                {results.children.map((child, index) => (
                  <CompactRow
                    key={child.id}
                    divider={index < results.children.length - 1}
                    title={child.title}
                    subtitle={child.subtitle}
                    icon={<ResultIcon ios="person.fill" android="person" />}
                    onPress={() =>
                      router.push({
                        pathname: "/child/[id]",
                        params: { id: child.id },
                      })
                    }
                  />
                ))}
              </ResultGroup>
            ) : null}
            {results?.classes.length ? (
              <ResultGroup title="Classes">
                {results.classes.map((schoolClass, index) => (
                  <CompactRow
                    key={schoolClass.id}
                    divider={index < results.classes.length - 1}
                    title={schoolClass.title}
                    subtitle={schoolClass.subtitle}
                    icon={<ResultIcon ios="person.2.fill" android="groups" />}
                    onPress={() =>
                      router.push({
                        pathname: "/class/[id]",
                        params: { id: schoolClass.id },
                      })
                    }
                  />
                ))}
              </ResultGroup>
            ) : null}
            {results?.lessons.length ? (
              <ResultGroup title="Lessons">
                {results.lessons.map((lesson, index) => (
                  <CompactRow
                    key={lesson.id}
                    divider={index < results.lessons.length - 1}
                    title={lesson.title}
                    subtitle={lesson.subtitle}
                    icon={<CalendarDate date={lesson.sundayDate} />}
                    onPress={() =>
                      router.push({
                        pathname: "/lesson/[id]",
                        params: { id: lesson.id, classId: lesson.classId },
                      })
                    }
                  />
                ))}
              </ResultGroup>
            ) : null}
            {tools.length ? <SearchGroup title="Tools" tools={tools} /> : null}
            {noResults && (
              <View style={{ alignItems: "center", gap: 8, paddingVertical: 28 }}>
                <Icon
                  ios="magnifyingglass"
                  android="search"
                  size={28}
                  color={colors.muted}
                />
                <Copy kind="heading">No matches</Copy>
                <Copy kind="caption" style={{ textAlign: "center" }}>
                  Try a child’s name, class, lesson, or ministry tool.
                </Copy>
              </View>
            )}
          </>
        )}
      </Screen>
    </>
  );
}

function ResultIcon({
  ios,
  android,
}: {
  ios: "person.fill" | "person.2.fill";
  android: "person" | "groups";
}) {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        width: 38,
        height: 38,
        borderRadius: 13,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primarySoft,
      }}
    >
      <Icon ios={ios} android={android} size={18} />
    </View>
  );
}

function ResultGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: 10 }}>
      <SectionTitle title={title} />
      <ListSurface>{children}</ListSurface>
    </View>
  );
}

function SearchGroup({ title, tools }: { title: string; tools: SearchTool[] }) {
  if (!tools.length) return null;
  return (
    <ResultGroup title={title}>
      {tools.map((tool, index) => (
        <CompactRow
          key={tool.id}
          divider={index < tools.length - 1}
          title={tool.title}
          subtitle={tool.subtitle}
          icon={<ToolIcon id={tool.id} />}
          onPress={() => router.push(tool.href as Href)}
        />
      ))}
    </ResultGroup>
  );
}

function ToolIcon({ id }: { id: string }) {
  const { colors } = useAppTheme();
  const symbols =
    id === "attendance" || id === "servant-attendance"
      ? ({ ios: "checkmark.circle.fill", android: "check_circle" } as const)
      : id === "lessons"
        ? ({ ios: "book.fill", android: "menu_book" } as const)
        : id === "reports"
          ? ({ ios: "chart.bar.fill", android: "bar_chart" } as const)
          : id === "roster" || id === "people"
            ? ({ ios: "person.2.fill", android: "groups" } as const)
            : ({ ios: "square.grid.2x2.fill", android: "dashboard" } as const);
  return (
    <View
      style={{
        width: 38,
        height: 38,
        borderRadius: 13,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primarySoft,
      }}
    >
      <Icon {...symbols} size={18} />
    </View>
  );
}
