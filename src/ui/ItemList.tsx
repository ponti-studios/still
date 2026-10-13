import { memo, useMemo, useState, type ReactNode } from 'react';
import { ActionSheetIOS, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SortKey } from '../core/derive';
import { money, plural, shortDate } from '../core/format';
import { filterItems } from '../core/list';
import { prettyCategory } from '../core/mapping';
import type { Group, Item } from '../core/types';
import { badgeColors, colors, thumbColors } from './theme';

export type ItemActions = {
  onEdit: (item: Item) => void;
  onAdvance: (item: Item) => void;
  onArchive: (item: Item) => void;
  onDelete: (item: Item) => void;
};

const SORTS: SortKey[] = ['newest', 'name', 'value', 'status'];
const SORT_LABELS: Record<SortKey, string> = { newest: 'Newest', name: 'Name', value: 'Value', status: 'Status' };

export function ItemList({ title, items, containers, query, limit, empty, actions, showControls = true }: {
  title: string;
  items: Item[];
  containers: Group[];
  query: string;
  limit?: number;
  empty: ReactNode;
  actions: ItemActions;
  showControls?: boolean;
}) {
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');

  const categories = useMemo(() => [...new Set(items.map((i) => i.category))].sort(), [items]);
  const rows = useMemo(
    () => filterItems(items, containers, { query, category, sort, limit }),
    [items, containers, query, category, sort, limit],
  );

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
    <View style={styles.section}>
      <View style={styles.head}>
        <View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.muted}>{plural(rows.length, 'item')}</Text>
        </View>
      </View>
      {showControls ? (
        <View style={styles.controls}>
          <Pressable style={styles.picker} onPress={pickCategory}>
            <Text style={styles.pickerText}>{category ? prettyCategory(category) : 'All categories'}</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <Pressable style={styles.picker} onPress={pickSort}>
            <Text style={styles.pickerText}>{SORT_LABELS[sort]}</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>
      ) : null}
      {rows.length === 0 ? (
        <View style={styles.empty}>{empty}</View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(i) => i.id}
          scrollEnabled={false}
          renderItem={({ item }) => <Row item={item} containers={containers} actions={actions} />}
        />
      )}
    </View>
  );
}

const Row = memo(function Row({ item, containers, actions }: { item: Item; containers: Group[]; actions: ItemActions }) {
  const where = containers.find((c) => c.id === item.containerId)?.name ?? item.vendor;
  const archived = item.status === 'Archived';
  const badge = badgeColors[item.status];

  const openMenu = () => {
    const labels = ['Edit', archived ? 'Restore' : 'Archive', 'Delete…', 'Cancel'];
    ActionSheetIOS.showActionSheetWithOptions(
      { title: item.name, options: labels, cancelButtonIndex: 3, destructiveButtonIndex: 2 },
      (index) => {
        if (index === 0) actions.onEdit(item);
        else if (index === 1) actions.onArchive(item);
        else if (index === 2) actions.onDelete(item);
      },
    );
  };

  return (
    <View style={styles.row}>
      <View style={styles.top}>
        <View style={styles.main}>
          <View style={[styles.thumb, { backgroundColor: thumbColors[item.color] ?? '#f4ecdc' }]}>
            <Text style={styles.thumbText}>{item.icon}</Text>
          </View>
          <View style={styles.names}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.meta} numberOfLines={1}>
              {[prettyCategory(item.category), where].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>
        <Pressable onPress={openMenu} accessibilityLabel={`Actions for ${item.name}`} hitSlop={10} style={styles.dots}>
          <Text style={styles.dotsText}>•••</Text>
        </Pressable>
      </View>
      <View style={styles.bottom}>
        <Pressable
          style={[styles.badge, { backgroundColor: badge.bg }]}
          disabled={archived}
          accessibilityLabel={archived ? item.status : `Move ${item.name} to the next stage`}
          onPress={() => actions.onAdvance(item)}
        >
          <View style={[styles.dot, { backgroundColor: badge.dot }]} />
          <Text style={[styles.badgeText, { color: badge.fg }]}>{item.status}</Text>
        </Pressable>
        <Text style={styles.value}>{item.value ? money(item.value, item.currency) : item.dated ? shortDate(item.date) : '—'}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  section: { marginBottom: 22 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '700', color: colors.ink },
  muted: { color: colors.muted, fontSize: 13, marginTop: 2 },
  controls: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  picker: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e3e4de',
    borderRadius: 10, backgroundColor: colors.surface,
  },
  pickerText: { fontSize: 16, color: '#5d6059' },
  chevron: { fontSize: 18, color: colors.faint },
  empty: {
    alignItems: 'center', gap: 14, padding: 36, borderWidth: 1, borderStyle: 'dashed',
    borderColor: '#dcddd6', borderRadius: 12, backgroundColor: '#fbfbf9',
  },
  row: {
    borderWidth: 1, borderColor: colors.line, borderRadius: 12,
    backgroundColor: colors.surface, padding: 12, marginBottom: 8, gap: 8,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  main: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  thumb: { width: 44, height: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  thumbText: { fontSize: 22 },
  names: { flex: 1, gap: 2, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '600', color: colors.ink },
  meta: { fontSize: 12, color: colors.muted },
  dots: { padding: 4 },
  dotsText: { fontSize: 14, color: '#6b6e67', letterSpacing: 1 },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, paddingHorizontal: 12, borderRadius: 20 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  value: { fontSize: 15, fontWeight: '700', color: colors.ink },
});
