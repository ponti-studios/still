import { memo, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { ActionSheetIOS, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import type { SortKey } from '../core/derive';
import { money, plural, shortDate } from '../core/format';
import { filterItems } from '../core/list';
import { prettyCategory } from '../core/mapping';
import type { Group, Item } from '../core/types';
import { impact } from '../platform/haptics';
import { Chevron, DotsButton } from './controls';
import { SFSymbol } from './SFSymbol';
import { radius, spacing, thumbColors, type, useBadgeColors, useColors } from './theme';

export type ItemActions = {
  onEdit: (item: Item) => void;
  onAdvance: (item: Item) => void;
  onArchive: (item: Item) => void;
  onDelete: (item: Item) => void;
};

const SORTS: SortKey[] = ['newest', 'name', 'value', 'status'];
const SORT_LABELS: Record<SortKey, string> = { newest: 'Newest', name: 'Name', value: 'Value', status: 'Status' };

export function ItemList({ title, count, items, containers, query, limit, empty, actions, showControls = true, header, footer }: {
  title?: string;
  count?: number;
  items: Item[];
  containers: Group[];
  query: string;
  limit?: number;
  empty: ReactNode;
  actions: ItemActions;
  showControls?: boolean;
  header?: ReactElement;
  footer?: ReactElement;
}) {
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');

  const categories = useMemo(() => [...new Set(items.map((i) => i.category))].sort(), [items]);
  const rows = useMemo(
    () => filterItems(items, containers, { query, category, sort, limit }),
    [items, containers, query, category, sort, limit],
  );
  const colors = useColors();

  const pickCategory = () => {
    const options = ['All categories', ...categories.map(prettyCategory), 'Cancel'];
    ActionSheetIOS.showActionSheetWithOptions(
      { options, cancelButtonIndex: options.length - 1 },
      (index) => {
        if (index === 0) setCategory('');
        else if (index !== undefined && index < options.length - 1) setCategory(categories[index - 1] ?? '');
      },
    );
  };
  const pickSort = () => {
    const options = [...SORTS.map((s) => SORT_LABELS[s]), 'Cancel'];
    ActionSheetIOS.showActionSheetWithOptions(
      { options, cancelButtonIndex: options.length - 1 },
      (index) => {
        if (index !== undefined && index < SORTS.length) setSort(SORTS[index] ?? 'newest');
      },
    );
  };

  return (
    <FlatList
      data={rows}
      keyExtractor={(i) => i.id}
      renderItem={({ item, index }) => (
        <Row item={item} index={index} containers={containers} actions={actions} onOpen={() => actions.onEdit(item)} />
      )}
      ListHeaderComponent={
        <>
          {header}
          <View style={styles.head}>
            <View>
              {title ? <Text style={[styles.title, { color: colors.ink }]}>{title}</Text> : null}
              {(count ?? rows.length) > 0 || query ? (
                <Text style={[styles.muted, { color: colors.muted }]}>
                  {plural(count ?? rows.length, 'item')}
                </Text>
              ) : null}
            </View>
          </View>
          {showControls ? (
            <View style={styles.controls}>
              <Pressable
                style={[styles.picker, { borderColor: colors.line, backgroundColor: colors.surface }]}
                onPress={pickCategory}
                accessibilityLabel={`Filter by category, ${category ? prettyCategory(category) : 'all categories'}`}
              >
                <Text style={[styles.pickerText, { color: colors.ink }]} numberOfLines={1}>
                  {category ? prettyCategory(category) : 'All categories'}
                </Text>
                <Chevron />
              </Pressable>
              <Pressable
                style={[styles.picker, { borderColor: colors.line, backgroundColor: colors.surface }]}
                onPress={pickSort}
                accessibilityLabel={`Sort by ${SORT_LABELS[sort]}`}
              >
                <Text style={[styles.pickerText, { color: colors.ink }]}>{SORT_LABELS[sort]}</Text>
                <Chevron />
              </Pressable>
            </View>
          ) : null}
        </>
      }
      ListEmptyComponent={<View style={styles.empty}>{empty}</View>}
      ListFooterComponent={footer ? <View style={styles.footer}>{footer}</View> : undefined}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
    />
  );
}

/** The item's photo, or its icon tile when there is none — or the file went missing. */
function Thumb({ item }: { item: Item }) {
  const [gone, setGone] = useState(false);
  if (!item.imageUrl || gone) {
    return (
      <View style={[styles.thumb, { backgroundColor: thumbColors[item.color] ?? '#f4ecdc' }]}>
        <Text style={styles.thumbText}>{item.icon}</Text>
      </View>
    );
  }
  return <Image source={{ uri: item.imageUrl }} style={styles.thumbImg} resizeMode="cover" onError={() => setGone(true)} />;
}

const Row = memo(function Row({ item, index, containers, actions, onOpen }: {
  item: Item;
  index: number;
  containers: Group[];
  actions: ItemActions;
  onOpen: () => void;
}) {
  const where = containers.find((c) => c.id === item.containerId)?.name ?? item.vendor;
  const archived = item.status === 'Archived';
  const badge = useBadgeColors()[item.status];
  const colors = useColors();

  const openMenu = () => {
    const labels = ['Edit', archived ? 'Restore' : 'Archive', 'Delete…', 'Cancel'];
    ActionSheetIOS.showActionSheetWithOptions(
      { title: item.name, options: labels, cancelButtonIndex: 3, destructiveButtonIndex: 2 },
      (menuIndex) => {
        if (menuIndex === 0) actions.onEdit(item);
        else if (menuIndex === 1) actions.onArchive(item);
        else if (menuIndex === 2) actions.onDelete(item);
      },
    );
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index * 30, 300)).duration(250)}
      layout={LinearTransition.springify().damping(20)}
    >
      <Pressable
        onPress={() => {
          void impact('light');
          onOpen();
        }}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${item.status}`}
        style={[styles.row, { borderColor: colors.line, backgroundColor: colors.surface }]}
      >
        <Thumb item={item} />
        <View style={styles.main}>
          <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>{item.name}</Text>
          <Text style={[styles.meta, { color: colors.muted }]} numberOfLines={1}>
            {[prettyCategory(item.category), where].filter(Boolean).join(' · ')}
          </Text>
          <View style={styles.bottom}>
            {archived ? (
              <Text style={[styles.archived, { color: colors.muted }]}>{item.status}</Text>
            ) : (
              <Pressable
                style={[styles.badge, { backgroundColor: badge.bg }]}
                accessibilityLabel={`Move ${item.name} to the next stage`}
                onPress={() => actions.onAdvance(item)}
              >
                <View style={[styles.dot, { backgroundColor: badge.dot }]} />
                <Text style={[styles.badgeText, { color: badge.fg }]}>{item.status}</Text>
              </Pressable>
            )}
            <Text style={[styles.value, { color: colors.ink }]}>
              {item.value ? money(item.value, item.currency) : item.dated ? shortDate(item.date) : '—'}
            </Text>
          </View>
        </View>
        <DotsButton label={`Actions for ${item.name}`} onPress={openMenu} />
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  list: { paddingBottom: spacing.xxxl },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: spacing.md },
  title: { ...type.headline },
  muted: { ...type.footnote, marginTop: 2 },
  controls: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  picker: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 44, paddingHorizontal: spacing.md, borderWidth: 1, borderRadius: radius.md, gap: spacing.sm,
  },
  pickerText: { ...type.body, flex: 1 },
  empty: { paddingVertical: spacing.sm },
  footer: { marginTop: spacing.lg },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm,
  },
  main: { flex: 1, minWidth: 0, gap: 2 },
  thumb: { width: 56, height: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  thumbText: { fontSize: 26 },
  thumbImg: { width: 56, height: 56, borderRadius: radius.md },
  name: { ...type.subhead },
  meta: { ...type.caption },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, paddingHorizontal: spacing.md, borderRadius: radius.full },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  archived: { ...type.caption },
  value: { ...type.subhead },
});

export function SearchGlyph() {
  const colors = useColors();
  return <SFSymbol name="magnifyingglass" size={19} weight="semibold" color={colors.muted} />;
}
