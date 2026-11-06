import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';
import TabView, { useBottomTabBarHeight } from 'react-native-bottom-tabs';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { deriveStats } from './src/core/derive';
import { longToday } from './src/core/format';
import { dismissNudge, isNudgeDismissed } from './src/core/preferences';
import { useAccount } from './src/core/useAccount';
import { useStore, type Store } from './src/core/store';
import { SHOPPING, type Group, type GroupKind, type Item, type ItemInput } from './src/core/types';
import { settingsUrl } from './src/platform/NativeStill';
import { GroupGrid, GroupSheet } from './src/ui/Groups';
import { ItemList, SearchGlyph, type ItemActions } from './src/ui/ItemList';
import { ItemSheet } from './src/ui/ItemSheet';
import { Nudge, Panels, StatCards } from './src/ui/Overview';
import { SignIn } from './src/ui/SignIn';
import { SFSymbol } from './src/ui/SFSymbol';
import { impact } from './src/platform/haptics';
import { Chevron, EmptyState } from './src/ui/controls';
import { radius, spacing, type, useColors } from './src/ui/theme';

const HELP_URL = 'mailto:cj@ponti.io?subject=Still%20feedback';

type Page = 'Overview' | 'Possessions' | 'Shopping' | 'Orders' | 'Containers' | 'Collections' | 'Archive';
type TabKey = 'overview' | 'possessions' | 'shopping' | 'orders' | 'more';
type TabRoute = { key: TabKey; title: string };
type MorePage = 'Containers' | 'Collections' | 'Archive';

const TABS: TabRoute[] = [
  { key: 'overview', title: 'Overview' },
  { key: 'possessions', title: 'Possessions' },
  { key: 'shopping', title: 'Shopping' },
  { key: 'orders', title: 'Orders' },
  { key: 'more', title: 'More' },
];
const TAB_PAGE: Record<Exclude<TabKey, 'more'>, Page> = {
  overview: 'Overview',
  possessions: 'Possessions',
  shopping: 'Shopping',
  orders: 'Orders',
};
const TAB_ICONS = {
  overview: { base: 'house', fill: 'house.fill' },
  possessions: { base: 'shippingbox', fill: 'shippingbox.fill' },
  shopping: { base: 'cart', fill: 'cart.fill' },
  orders: { base: 'box.truck', fill: 'box.truck.fill' },
  more: { base: 'ellipsis', fill: 'ellipsis' },
} as const;
const MORE_PAGES: { page: MorePage; icon: string }[] = [
  { page: 'Containers', icon: 'archivebox' },
  { page: 'Collections', icon: 'tag.fill' },
  { page: 'Archive', icon: 'archivebox.fill' },
];
const LIST_TITLES: Partial<Record<Page, string>> = {
  Overview: 'Recently added',
};

export default function App() {
  return (
    <SafeAreaProvider>
      <Gated />
    </SafeAreaProvider>
  );
}

function Gated() {
  const account = useAccount();
  const colors = useColors();

  if (!account.ready) {
    return (
      <SafeAreaView style={[styles.fill, { backgroundColor: colors.bg }]}>
        <SplashText text="Loading…" />
      </SafeAreaView>
    );
  }

  if (!account.email) {
    return (
      <SafeAreaView style={[styles.fill, { backgroundColor: colors.bg }]}>
        <SignIn account={account} />
      </SafeAreaView>
    );
  }

  return <Main email={account.email} onSignOut={() => void account.signOut()} />;
}

function openLink(url: string | null) {
  if (!url) return;
  Linking.openURL(url).catch(() => undefined);
}

export function Main({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const store = useStore();
  const colors = useColors();
  const { items } = store;
  const [tabIndex, setTabIndex] = useState(0);
  const [morePage, setMorePage] = useState<MorePage | null>(null);
  const [groupId, setGroupId] = useState<string | undefined>(undefined);
  const [nudge, setNudge] = useState<boolean | null>(null);
  const [itemSheet, setItemSheet] = useState<{ item?: Item; defaults?: Partial<ItemInput> } | null>(null);
  const [groupSheet, setGroupSheet] = useState<{ kind: GroupKind; group?: Group } | null>(null);

  useEffect(() => {
    isNudgeDismissed().then(setNudge).catch(() => setNudge(true));
  }, []);

  const go = (next: Page, id?: string) => {
    const tab = (Object.keys(TAB_PAGE) as TabKey[]).find((k) => TAB_PAGE[k as Exclude<TabKey, 'more'>] === next);
    if (tab) {
      setTabIndex(TABS.findIndex((t) => t.key === tab));
      setMorePage(null);
    } else {
      setTabIndex(TABS.findIndex((t) => t.key === 'more'));
      setMorePage(next as MorePage);
    }
    setGroupId(id);
  };
  const onIndexChange = (next: number) => {
    // Tab switches keep the section but drop the detail: predictable everywhere.
    setTabIndex(next);
    setGroupId(undefined);
  };

  const stats = useMemo(() => deriveStats(items), [items]);
  const categories = useMemo(() => [...new Set(items.map((i) => i.category))].sort(), [items]);

  const confirmDeleteItem = (item: Item) => {
    Alert.alert(`Delete “${item.name}”?`, 'This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void store.deleteItem(item.id) },
    ]);
  };
  const actions: ItemActions = {
    onEdit: (item) => setItemSheet({ item }),
    onAdvance: (item) => void store.advance(item.id),
    onArchive: (item) => store.updateItem(item.id, { status: item.status === 'Archived' ? 'Owned' : 'Archived' }),
    onDelete: confirmDeleteItem,
  };
  const deleteGroup = (g: Group, k: GroupKind) => {
    Alert.alert(`Delete “${g.name}”?`, 'Its items stay in Still.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          void store.deleteGroup(k, g.id);
          if (groupId === g.id) setGroupId(undefined);
        },
      },
    ]);
  };
  const dismissNudgeNow = () => {
    setNudge(true);
    dismissNudge();
  };

  const navigationState = useMemo(() => ({ index: tabIndex, routes: TABS }), [tabIndex]);
  const scene = { store, stats, groupId, nudge, actions, deleteGroup, dismissNudgeNow, go, setGroupId, setItemSheet, setGroupSheet };

  if (store.phase !== 'ready') {
    return (
      <SafeAreaView style={[styles.fill, { backgroundColor: colors.bg }]}>
        <View style={styles.splash}>
          {store.phase === 'loading' ? (
            <SplashText text="Loading your things…" />
          ) : (
            <>
              <SplashText text="Couldn’t load your things. Check your connection." />
              <Pressable style={[styles.primary, { backgroundColor: colors.green }]} onPress={() => void store.reload()}>
                <Text style={styles.primaryText}>Try again</Text>
              </Pressable>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // The sync line only speaks when there is something to say.
  const pending = store.pending;
  const syncLabel = store.connected
    ? pending > 0
      ? `${pending} ${pending === 1 ? 'change' : 'changes'} syncing…`
      : null
    : pending > 0
      ? `${pending} waiting — offline`
      : 'Offline — showing saved data';

  return (
    <SafeAreaView style={styles.fill} edges={['top']}>
      <View style={styles.app}>
        {store.notice ? (
          <Animated.View entering={FadeInDown.duration(300)} exiting={FadeOut.duration(250)}>
            <View style={[styles.notice, { borderColor: colors.line, backgroundColor: colors.surface }]}>
              <Text style={[styles.noticeText, { color: colors.ink }]} numberOfLines={2}>{store.notice}</Text>
              <Pressable onPress={store.dismissNotice} accessibilityLabel="Dismiss" hitSlop={10}>
                <SFSymbol name="xmark" size={14} weight="semibold" color={colors.muted} />
              </Pressable>
            </View>
          </Animated.View>
        ) : null}

        <TabView
          navigationState={navigationState}
          renderScene={({ route }: { route: TabRoute; jumpTo: (key: string) => void }) =>
            route.key === 'more'
              ? <MoreScreen email={email} onSignOut={onSignOut} morePage={morePage} setMorePage={setMorePage} scene={scene} />
              : <PageScreen key={route.key} page={TAB_PAGE[route.key]} scene={scene} />
          }
          onIndexChange={onIndexChange}
          getIcon={({ route, focused }: { route: TabRoute; focused: boolean }) => {
            const icon = TAB_ICONS[route.key];
            return { sfSymbol: focused ? icon.fill : icon.base };
          }}
          getBadge={({ route }: { route: TabRoute }) =>
            route.key === 'orders' && stats.ordered.length > 0 ? `${stats.ordered.length}` : undefined
          }
          tabBarActiveTintColor={colors.green}
          minimizeBehavior="onScrollDown"
          hapticFeedbackEnabled
        />

        {syncLabel ? (
          <View style={styles.status}>
            <Text style={[styles.statusText, { color: colors.muted }]}>{syncLabel}</Text>
          </View>
        ) : null}

        {itemSheet ? (
          <ItemSheet item={itemSheet.item} defaults={itemSheet.defaults} containers={store.containers} collections={store.collections} categories={categories}
            onSave={(input) => (itemSheet.item ? store.updateItem(itemSheet.item.id, input) : store.addItem(input))} onClose={() => setItemSheet(null)} />
        ) : null}
        {groupSheet ? (
          <GroupSheet kind={groupSheet.kind} group={groupSheet.group} onClose={() => setGroupSheet(null)}
            onSave={(data) => void (groupSheet.group ? store.updateGroup(groupSheet.kind, groupSheet.group.id, data) : store.addGroup(groupSheet.kind, data))} />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

type Scene = {
  store: Store;
  stats: ReturnType<typeof deriveStats>;
  groupId: string | undefined;
  nudge: boolean | null;
  actions: ItemActions;
  deleteGroup: (g: Group, k: GroupKind) => void;
  dismissNudgeNow: () => void;
  go: (page: Page, id?: string) => void;
  setGroupId: (id: string | undefined) => void;
  setItemSheet: (s: { item?: Item; defaults?: Partial<ItemInput> } | null) => void;
  setGroupSheet: (s: { kind: GroupKind; group?: Group } | null) => void;
};

function PageScreen({ page, scene, onBack }: { page: Page; scene: Scene; onBack?: () => void }) {
  const colors = useColors();
  const { store, stats, groupId, nudge } = scene;
  const { items, containers, collections } = store;
  const tabBarHeight = useBottomTabBarHeight();
  // Search lives with the page, not the app: switching tabs starts clean.
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<TextInputInstance>(null);
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const kind: GroupKind | null = page === 'Containers' ? 'container' : page === 'Collections' ? 'collection' : null;
  const groups = kind === 'container' ? containers : collections;
  const openGroup = kind && groupId ? groups.find((g) => g.id === groupId) : undefined;

  const pageItems = useMemo(() => {
    const live = items.filter((i) => i.status !== 'Archived');
    if (openGroup && kind) return live.filter((i) => (kind === 'container' ? i.containerId === openGroup.id : i.collectionIds.includes(openGroup.id)));
    switch (page) {
      case 'Possessions': return items.filter((i) => i.status === 'Owned');
      case 'Shopping': return items.filter((i) => SHOPPING.includes(i.status));
      case 'Orders': return items.filter((i) => i.status === 'Ordered');
      case 'Archive': return items.filter((i) => i.status === 'Archived');
      case 'Overview': return live;
      default: return [];
    }
  }, [items, page, openGroup, kind]);

  const openGroupMenu = () => {
    if (!openGroup || !kind) return;
    const group = openGroup;
    ActionSheetIOS.showActionSheetWithOptions(
      { title: group.name, options: ['Rename / edit', 'Delete…', 'Cancel'], cancelButtonIndex: 2, destructiveButtonIndex: 1 },
      (index) => {
        if (index === 0) scene.setGroupSheet({ kind, group });
        else if (index === 1) scene.deleteGroup(group, kind);
      },
    );
  };

  const heading = openGroup ? openGroup.name : page === 'Overview' ? 'Your things, thoughtfully kept.' : page;
  const primary = kind && !openGroup
    ? { label: `New ${kind}`, run: () => scene.setGroupSheet({ kind }) }
    : { label: 'Add item', run: () => scene.setItemSheet({ defaults: openGroup && kind ? (kind === 'container' ? { containerId: openGroup.id } : { collectionIds: [openGroup.id] }) : undefined }) };

  const header = (
    <View>
      <View style={styles.headingRow}>
        <View style={styles.headingMain}>
          {page === 'Overview' ? <Text style={[styles.eyebrow, { color: colors.faint }]}>{longToday().toUpperCase()}</Text> : null}
          <Text style={[styles.h1, { color: colors.ink }]}>{heading}</Text>
          {openGroup?.description ? <Text style={[styles.subtitle, { color: colors.muted }]}>{openGroup.description}</Text> : null}
        </View>
        {openGroup && kind ? (
          <Pressable onPress={openGroupMenu} accessibilityLabel={`Actions for ${openGroup.name}`} hitSlop={12} style={styles.dots}>
            <SFSymbol name="ellipsis" size={17} weight="semibold" color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      {page === 'Overview' ? (
        <>
          <StatCards stats={stats} />
          {stats.unhomed > 0 && nudge === false ? (
            <Nudge count={stats.unhomed} onReview={() => scene.go('Possessions')} onDismiss={scene.dismissNudgeNow} />
          ) : null}
        </>
      ) : null}
    </View>
  );

  const footer = page === 'Overview' ? (
    <Panels containers={containers} items={items} ordered={stats.ordered}
      onSeeAll={() => scene.go('Containers')} onOrders={() => scene.go('Orders')} onCreate={() => scene.setGroupSheet({ kind: 'container' })} />
  ) : null;

  return (
    <View style={[styles.page, { backgroundColor: colors.bg }]}>
      <View style={[styles.topbar, { borderBottomColor: colors.line }]}>
        {searchOpen ? (
          <View style={styles.searchOpen}>
            <TextInput
              ref={searchRef}
              style={[styles.searchInput, { color: colors.ink }]}
              value={query}
              onChangeText={setQuery}
              placeholder="Search anything…"
              placeholderTextColor={colors.faint}
              returnKeyType="search"
            />
            <Pressable onPress={() => { setQuery(''); setSearchOpen(false); }} accessibilityLabel="Close search" hitSlop={10}>
              <SFSymbol name="xmark" size={15} weight="semibold" color={colors.muted} />
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.topbarLeft}>
              {openGroup ? (
                <Pressable onPress={() => scene.setGroupId(undefined)} style={styles.backRow} accessibilityLabel={`Back to ${page}`}>
                  <SFSymbol name="chevron.left" size={16} weight="semibold" color={colors.green} />
                  <Text style={[styles.back, { color: colors.green }]}>{page}</Text>
                </Pressable>
              ) : onBack ? (
                <Pressable onPress={onBack} style={styles.backRow} accessibilityLabel="Back to More">
                  <SFSymbol name="chevron.left" size={16} weight="semibold" color={colors.green} />
                  <Text style={[styles.back, { color: colors.green }]}>More</Text>
                </Pressable>
              ) : null}
            </View>
            <Pressable onPress={() => setSearchOpen(true)} accessibilityLabel="Search" hitSlop={10} style={styles.searchToggle}>
              <SearchGlyph />
            </Pressable>
          </>
        )}
      </View>

      {kind && !openGroup ? (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentPad} keyboardShouldPersistTaps="handled">
          {header}
          {groupId !== undefined ? (
            <EmptyState body={`That ${kind} no longer exists.`} actionLabel={`Back to ${page}`} onAction={() => scene.setGroupId(undefined)} />
          ) : (
            <GroupGrid kind={kind} groups={groups} items={items}
              onOpen={(g) => scene.go(page, g.id)} onEdit={(g) => scene.setGroupSheet({ kind, group: g })}
              onDelete={(g) => scene.deleteGroup(g, kind)} onCreate={() => scene.setGroupSheet({ kind })} />
          )}
        </ScrollView>
      ) : (
        <View style={styles.listWrap}>
          <ItemList
            title={LIST_TITLES[page]}
            items={pageItems}
            containers={containers}
            query={query}
            limit={page === 'Overview' ? 5 : undefined}
            showControls={page !== 'Overview'}
            header={header}
            footer={footer ?? undefined}
            empty={page === 'Archive'
              ? <Text style={[styles.emptyText, { color: colors.muted }]}>No archived items.</Text>
              : query
                ? <Text style={[styles.emptyText, { color: colors.muted }]}>Nothing matches your search.</Text>
                : <EmptyState body="Nothing here yet." actionLabel={primary.label} onAction={primary.run} />}
            actions={scene.actions}
          />
        </View>
      )}

      {page !== 'Archive' ? (
        <Pressable style={[styles.fab, { bottom: tabBarHeight + 14, backgroundColor: colors.green }]} onPress={() => {
          void impact('light');
          primary.run();
        }} accessibilityLabel={primary.label}>
          <SFSymbol name="plus" size={18} weight="bold" color="#fff" />
          <Text style={styles.primaryText}>{primary.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function MoreScreen({ email, onSignOut, morePage, setMorePage, scene }: {
  email: string; onSignOut: () => void; morePage: MorePage | null; setMorePage: (p: MorePage | null) => void; scene: Scene;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const initials = email.slice(0, 2).toUpperCase();
  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You’ll need an email code to sign back in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: onSignOut },
    ]);
  };

  if (morePage) {
    return <PageScreen key={morePage} page={morePage} scene={scene} onBack={() => { scene.setGroupId(undefined); setMorePage(null); }} />;
  }

  return (
    <ScrollView style={[styles.page, { backgroundColor: colors.bg }]} contentContainerStyle={[styles.contentPad, { paddingBottom: 24 + insets.bottom }]}>
      <View style={styles.moreList}>
        {MORE_PAGES.map(({ page: label, icon }) => (
          <Pressable key={label} onPress={() => setMorePage(label)} style={styles.navItem} accessibilityRole="button" accessibilityLabel={label}>
            <SFSymbol name={icon} size={19} color={colors.muted} />
            <Text style={[styles.navText, { color: colors.ink }]}>{label}</Text>
            <View style={styles.navChevron}><Chevron /></View>
          </Pressable>
        ))}
        <Pressable onPress={() => openLink(settingsUrl())} style={styles.navItem} accessibilityRole="button" accessibilityLabel="Settings">
          <SFSymbol name="gearshape" size={19} color={colors.muted} />
          <Text style={[styles.navText, { color: colors.ink }]}>Settings</Text>
          <View style={styles.navChevron}><Chevron /></View>
        </Pressable>
        <Pressable onPress={() => openLink(HELP_URL)} style={styles.navItem} accessibilityRole="button" accessibilityLabel="Help and feedback">
          <SFSymbol name="questionmark.circle" size={19} color={colors.muted} />
          <Text style={[styles.navText, { color: colors.ink }]}>Help & feedback</Text>
          <View style={styles.navChevron}><Chevron /></View>
        </Pressable>
        <Pressable onPress={confirmSignOut} style={[styles.profile, { borderTopColor: colors.line }]} accessibilityRole="button" accessibilityLabel={`Sign out of ${email}`}>
          <View style={[styles.avatar, { backgroundColor: colors.greenTint }]}>
            <Text style={[styles.avatarText, { color: colors.green }]}>{initials}</Text>
          </View>
          <View style={styles.profileMain}>
            <Text style={[styles.profileEmail, { color: colors.ink }]} numberOfLines={1}>{email}</Text>
            <Text style={[styles.profileSub, { color: colors.muted }]}>Sign out</Text>
          </View>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function SplashText({ text }: { text: string }) {
  const colors = useColors();
  return <Text style={[styles.splashText, { color: colors.muted }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  app: { flex: 1 },
  page: { flex: 1 },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  splashText: { fontSize: 15, textAlign: 'center' },
  primary: {
    minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18,
  },
  primaryText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  notice: {
    margin: 12, marginBottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, padding: 6, paddingLeft: 14, borderRadius: 14, borderWidth: 1,
  },
  noticeText: { fontSize: 14, flex: 1 },
  status: { paddingHorizontal: 16, paddingTop: 6, alignItems: 'center' },
  statusText: { fontSize: 12 },
  topbar: {
    minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', borderBottomWidth: 1,
  },
  topbarLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingRight: 12 },
  back: { fontWeight: '600', fontSize: 16 },
  searchToggle: { padding: 4 },
  searchOpen: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, fontSize: 16, minHeight: 40 },
  content: { flex: 1 },
  contentPad: { padding: 20, paddingBottom: 120 },
  listWrap: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20 },
  headingMain: { flex: 1, gap: 6 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  h1: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { fontSize: 14 },
  dots: { padding: 4 },
  fab: {
    position: 'absolute', right: 16, minHeight: 52, paddingHorizontal: 20, borderRadius: 26,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    shadowColor: '#273e34', shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 6 },
  },
  emptyText: { fontSize: 14, textAlign: 'center' },
  moreList: { gap: 2, paddingBottom: 8 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 12, borderRadius: 10 },
  navText: { fontSize: 15, fontWeight: '500', flex: 1 },
  navChevron: { opacity: 1 },
  profile: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52,
    paddingHorizontal: 12, paddingTop: 6, marginTop: 8,
    borderTopWidth: 1,
  },
  avatar: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 12, fontWeight: '700' },
  profileMain: { flex: 1, minWidth: 0 },
  profileEmail: { fontSize: 14, fontWeight: '600' },
  profileSub: { fontSize: 12 },
});
