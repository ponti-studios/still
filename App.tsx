import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { deriveStats } from './src/core/derive';
import { longToday } from './src/core/format';
import { dismissNudge, isNudgeDismissed } from './src/core/preferences';
import { useAccount } from './src/core/useAccount';
import { useStore } from './src/core/store';
import { SHOPPING, type Group, type GroupKind, type Item, type ItemInput } from './src/core/types';
import { settingsUrl } from './src/platform/NativeStill';
import { GroupGrid, GroupSheet } from './src/ui/Groups';
import { ItemList, type ItemActions } from './src/ui/ItemList';
import { ItemSheet } from './src/ui/ItemSheet';
import { Nudge, Panels, StatCards } from './src/ui/Overview';
import { Sheet } from './src/ui/Sheet';
import { SignIn } from './src/ui/SignIn';
import { colors } from './src/ui/theme';

const HELP_URL = 'mailto:cj@ponti.io?subject=Still%20feedback';

type Page = 'Overview' | 'Possessions' | 'Shopping' | 'Orders' | 'Containers' | 'Collections' | 'Archive';
const TABS: { page: Page; icon: string }[] = [
  { page: 'Overview', icon: '🏠' },
  { page: 'Possessions', icon: '📦' },
  { page: 'Shopping', icon: '🛒' },
  { page: 'Orders', icon: '📬' },
];
const MORE_PAGES: { page: Page; icon: string }[] = [
  { page: 'Containers', icon: '🧳' },
  { page: 'Collections', icon: '🏷️' },
  { page: 'Archive', icon: '🗄️' },
];
const TITLES: Record<Page, string> = {
  Overview: 'Your things, thoughtfully kept.', Possessions: 'Possessions', Shopping: 'Shopping list', Orders: 'Orders',
  Containers: 'Containers', Collections: 'Collections', Archive: 'Archive',
};
const LIST_TITLES: Record<Page, string> = {
  Overview: 'Recently added', Possessions: 'Everything you own', Shopping: 'Things you’re considering', Orders: 'On their way',
  Containers: 'Items', Collections: 'Items', Archive: 'Past possessions',
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

  if (!account.ready) {
    return (
      <SafeAreaView style={styles.fill}>
        <View style={styles.splash}>
          <Text style={styles.splashText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!account.email) {
    return (
      <SafeAreaView style={styles.fill}>
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

function Main({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const store = useStore();
  const { items, containers, collections } = store;
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState<Page>('Overview');
  const [groupId, setGroupId] = useState<string | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [nudge, setNudge] = useState<boolean | null>(null);
  const [itemSheet, setItemSheet] = useState<{ item?: Item; defaults?: Partial<ItemInput> } | null>(null);
  const [groupSheet, setGroupSheet] = useState<{ kind: GroupKind; group?: Group } | null>(null);
  const searchRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    isNudgeDismissed().then(setNudge).catch(() => setNudge(true));
  }, []);
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const go = (next: Page, id?: string) => {
    setPage(next);
    setGroupId(id);
    setMoreOpen(false);
  };

  const stats = useMemo(() => deriveStats(items), [items]);
  const categories = useMemo(() => [...new Set(items.map((i) => i.category))].sort(), [items]);
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

  const confirmDeleteItem = (item: Item) => {
    Alert.alert(`Delete “${item.name}”?`, 'This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void store.deleteItem(item.id) },
    ]);
  };
  const actions: ItemActions = {
    onEdit: (item) => setItemSheet({ item }),
    onAdvance: (item) => void store.advance(item.id),
    onArchive: (item) => void store.updateItem(item.id, { status: item.status === 'Archived' ? 'Owned' : 'Archived' }),
    onDelete: confirmDeleteItem,
  };
  const deleteGroup = (g: Group, k: GroupKind) => {
    Alert.alert(`Delete “${g.name}”?`, 'Its items stay in Still.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          void store.deleteGroup(k, g.id);
          if (groupId === g.id) go(page);
        },
      },
    ]);
  };
  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You’ll need an email code to sign back in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: onSignOut },
    ]);
  };
  const openGroupMenu = () => {
    if (!openGroup || !kind) return;
    const group = openGroup;
    ActionSheetIOS.showActionSheetWithOptions(
      { title: group.name, options: ['Rename / edit', 'Delete…', 'Cancel'], cancelButtonIndex: 2, destructiveButtonIndex: 1 },
      (index) => {
        if (index === 0) setGroupSheet({ kind, group });
        else if (index === 1) deleteGroup(group, kind);
      },
    );
  };

  const heading = openGroup ? openGroup.name : TITLES[page];
  const primary = kind && !openGroup
    ? { label: `New ${kind}`, run: () => setGroupSheet({ kind }) }
    : { label: 'Add item', run: () => setItemSheet({ defaults: openGroup && kind ? (kind === 'container' ? { containerId: openGroup.id } : { collectionIds: [openGroup.id] }) : undefined }) };
  const dismissNudgeNow = () => {
    setNudge(true);
    dismissNudge();
  };
  const initials = email.slice(0, 2).toUpperCase();

  if (store.phase !== 'ready') {
    return (
      <SafeAreaView style={styles.fill}>
        <View style={styles.splash}>
          {store.phase === 'loading' ? (
            <Text style={styles.splashText}>Loading your things…</Text>
          ) : (
            <>
              <Text style={styles.splashText}>Couldn’t load your things: {store.error}</Text>
              <Pressable style={styles.primary} onPress={() => void store.reload()}>
                <Text style={styles.primaryText}>Try again</Text>
              </Pressable>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.fill} edges={['top']}>
      <View style={styles.app}>
        {store.notice ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{store.notice}</Text>
            <Pressable onPress={store.dismissNotice} accessibilityLabel="Dismiss" hitSlop={10}>
              <Text style={styles.noticeDismiss}>✕</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.topbar}>
          {searchOpen ? (
            <View style={styles.searchOpen}>
              <TextInput
                ref={searchRef}
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search anything…"
                returnKeyType="search"
              />
              <Pressable onPress={() => { setQuery(''); setSearchOpen(false); }} accessibilityLabel="Close search" hitSlop={10}>
                <Text style={styles.searchClose}>✕</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.crumb}>
                {openGroup ? (
                  <Pressable onPress={() => go(page)}><Text style={styles.back}>← {page}</Text></Pressable>
                ) : (
                  <Text style={styles.crumbText}>{page}</Text>
                )}
              </View>
              <Pressable onPress={() => setSearchOpen(true)} accessibilityLabel="Search" hitSlop={10} style={styles.searchToggle}>
                <Text style={styles.searchIcon}>🔍</Text>
              </Pressable>
            </>
          )}
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentPad} keyboardShouldPersistTaps="handled">
          <View style={styles.headingRow}>
            <View style={styles.headingMain}>
              {page === 'Overview' ? <Text style={styles.eyebrow}>{longToday().toUpperCase()}</Text> : null}
              <Text style={styles.h1}>{heading}</Text>
              {page === 'Overview' ? <Text style={styles.subtitle}>A clear view of what you own, want, and everything in between.</Text> : null}
              {openGroup?.description ? <Text style={styles.subtitle}>{openGroup.description}</Text> : null}
            </View>
            {openGroup && kind ? (
              <Pressable onPress={openGroupMenu} accessibilityLabel={`Actions for ${openGroup.name}`} hitSlop={10} style={styles.dots}>
                <Text style={styles.dotsText}>•••</Text>
              </Pressable>
            ) : null}
          </View>

          {page === 'Overview' ? (
            <>
              <StatCards stats={stats} />
              {stats.unhomed > 0 && nudge === false ? (
                <Nudge count={stats.unhomed} onReview={() => go('Possessions')} onDismiss={dismissNudgeNow} />
              ) : null}
            </>
          ) : null}

          {kind && !openGroup && groupId === undefined ? (
            <GroupGrid kind={kind} groups={groups} items={items}
              onOpen={(g) => go(page, g.id)} onEdit={(g) => setGroupSheet({ kind, group: g })}
              onDelete={(g) => deleteGroup(g, kind)} onCreate={() => setGroupSheet({ kind })} />
          ) : null}
          {kind && !openGroup && groupId !== undefined ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>That {kind} no longer exists.</Text>
              <Pressable style={styles.primary} onPress={() => go(page)}>
                <Text style={styles.primaryText}>Back to {page}</Text>
              </Pressable>
            </View>
          ) : null}

          {(!kind || openGroup) ? (
            <ItemList title={LIST_TITLES[page]} items={pageItems} containers={containers} query={query}
              limit={page === 'Overview' ? 5 : undefined} showControls={page !== 'Overview'}
              empty={page === 'Archive'
                ? <Text style={styles.emptyText}>Archived items will show up here.</Text>
                : query
                  ? <Text style={styles.emptyText}>Nothing matches your search.</Text>
                  : <>
                    <Text style={styles.emptyText}>Nothing here yet.</Text>
                    <Pressable style={styles.primary} onPress={() => setItemSheet({})}><Text style={styles.primaryText}>+ Add item</Text></Pressable>
                  </>}
              actions={actions} />
          ) : null}

          {page === 'Overview' ? (
            <Panels containers={containers} items={items} ordered={stats.ordered}
              onSeeAll={() => go('Containers')} onOrders={() => go('Orders')} onCreate={() => setGroupSheet({ kind: 'container' })} />
          ) : null}
        </ScrollView>

        {page !== 'Archive' ? (
          <Pressable style={[styles.fab, { bottom: 62 + insets.bottom + 14 }]} onPress={primary.run}>
            <Text style={styles.primaryText}>{`+ ${primary.label}`}</Text>
          </Pressable>
        ) : null}

        <View style={[styles.tabbar, { paddingBottom: insets.bottom }]}>
          {TABS.map(({ page: label, icon }) => (
            <Pressable key={label} onPress={() => go(label)} accessibilityRole="button" accessibilityState={{ selected: page === label }} style={styles.tab}>
              <Text style={styles.tabIcon}>{icon}</Text>
              <Text style={[styles.tabLabel, page === label && styles.tabSelected]}>{label}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setMoreOpen(true)} style={styles.tab} accessibilityState={{ selected: kind !== null || page === 'Archive' }}>
            <Text style={styles.tabIcon}>•••</Text>
            <Text style={[styles.tabLabel, (kind !== null || page === 'Archive') && styles.tabSelected]}>More</Text>
          </Pressable>
        </View>

        {moreOpen ? (
          <Sheet title="More" onClose={() => setMoreOpen(false)}>
            <View style={styles.moreList}>
              {MORE_PAGES.map(({ page: label, icon }) => (
                <Pressable key={label} onPress={() => go(label)} style={[styles.navItem, page === label && styles.navSelected]}>
                  <Text style={styles.navIcon}>{icon}</Text>
                  <Text style={[styles.navText, page === label && styles.navTextSelected]}>{label}</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => openLink(settingsUrl())} style={styles.navItem}>
                <Text style={styles.navIcon}>⚙️</Text>
                <Text style={styles.navText}>Settings</Text>
              </Pressable>
              <Pressable onPress={() => openLink(HELP_URL)} style={styles.navItem}>
                <Text style={styles.navIcon}>💬</Text>
                <Text style={styles.navText}>Help & feedback</Text>
              </Pressable>
              <Pressable onPress={confirmSignOut} style={styles.profile}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
                <View style={styles.profileMain}>
                  <Text style={styles.profileEmail} numberOfLines={1}>{email}</Text>
                  <Text style={styles.profileSub}>Sign out</Text>
                </View>
              </Pressable>
            </View>
          </Sheet>
        ) : null}

        {itemSheet ? (
          <ItemSheet item={itemSheet.item} defaults={itemSheet.defaults} containers={containers} collections={collections} categories={categories}
            onSave={(input) => void (itemSheet.item ? store.updateItem(itemSheet.item.id, input) : store.addItem(input))} onClose={() => setItemSheet(null)} />
        ) : null}
        {groupSheet ? (
          <GroupSheet kind={groupSheet.kind} group={groupSheet.group} onClose={() => setGroupSheet(null)}
            onSave={(data) => void (groupSheet.group ? store.updateGroup(groupSheet.kind, groupSheet.group.id, data) : store.addGroup(groupSheet.kind, data))} />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  app: { flex: 1, backgroundColor: colors.bg },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  splashText: { color: colors.muted, fontSize: 15, textAlign: 'center' },
  primary: {
    minHeight: 44, borderRadius: 10, backgroundColor: colors.green,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18,
  },
  primaryText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  notice: {
    margin: 8, marginBottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, padding: 6, paddingLeft: 14, borderRadius: 12, backgroundColor: '#3b2420',
  },
  noticeText: { color: '#fff', fontSize: 14, flex: 1 },
  noticeDismiss: { color: '#fff', fontSize: 14, padding: 10 },
  topbar: {
    minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  crumb: { flex: 1 },
  crumbText: { fontSize: 17, fontWeight: '700', color: colors.ink },
  back: { fontWeight: '600', fontSize: 16, color: colors.green, paddingVertical: 8 },
  searchToggle: { padding: 4 },
  searchIcon: { fontSize: 20 },
  searchOpen: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, fontSize: 16, color: colors.ink, minHeight: 40 },
  searchClose: { fontSize: 16, color: '#6b6e67', padding: 4 },
  content: { flex: 1 },
  contentPad: { padding: 20, paddingBottom: 120 },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20 },
  headingMain: { flex: 1, gap: 6 },
  eyebrow: { color: colors.faint, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  h1: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6, color: colors.ink },
  subtitle: { color: colors.muted, fontSize: 14 },
  dots: { padding: 4 },
  dotsText: { fontSize: 16, color: '#6b6e67', letterSpacing: 1 },
  fab: {
    position: 'absolute', right: 16, minHeight: 52, paddingHorizontal: 20, borderRadius: 26,
    backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#273e34', shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 6 },
  },
  tabbar: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 62, paddingTop: 8 },
  tabIcon: { fontSize: 20 },
  tabLabel: { fontSize: 11, fontWeight: '600', color: '#8c8f88' },
  tabSelected: { color: colors.green },
  empty: { alignItems: 'center', gap: 14, padding: 36, borderWidth: 1, borderStyle: 'dashed', borderColor: '#dcddd6', borderRadius: 12, backgroundColor: '#fbfbf9' },
  emptyText: { color: colors.muted, fontSize: 14, textAlign: 'center' },
  moreList: { gap: 2, paddingBottom: 8 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingHorizontal: 12, borderRadius: 10 },
  navSelected: { backgroundColor: colors.greenTint },
  navIcon: { fontSize: 20, width: 26, textAlign: 'center' },
  navText: { fontSize: 15, fontWeight: '500', color: '#62655e' },
  navTextSelected: { color: colors.green, fontWeight: '600' },
  profile: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52,
    paddingHorizontal: 12, paddingTop: 6, marginTop: 8,
    borderTopWidth: 1, borderTopColor: colors.lineSoft,
  },
  avatar: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#e5eadf', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#52664e', fontSize: 12, fontWeight: '700' },
  profileMain: { flex: 1, minWidth: 0 },
  profileEmail: { fontSize: 14, fontWeight: '600', color: colors.ink },
  profileSub: { fontSize: 12, color: colors.muted },
});
