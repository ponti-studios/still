import { Pressable, StyleSheet, Text, View } from 'react-native';
import { countIn } from '../core/groups';
import { deriveStats } from '../core/derive';
import { money, plural, shortDate } from '../core/format';
import type { Group, Item } from '../core/types';
import { select } from '../platform/haptics';
import { Chevron } from './controls';
import { SFSymbol } from './SFSymbol';
import { radius, spacing, type, useBadgeColors, useColors } from './theme';

type Stats = ReturnType<typeof deriveStats>;

export function StatCards({ stats }: { stats: Stats }) {
  const colors = useColors();
  // Items can be priced in different currencies; show the biggest total and mention the rest.
  const totals = Object.entries(stats.worth).sort((a, b) => b[1] - a[1]);
  const [mainCurrency, mainTotal] = totals[0] ?? ['GBP', 0];
  const others = totals.slice(1).filter(([, total]) => total > 0).map(([currency, total]) => money(total, currency)).join(' + ');
  const cards = [
    { label: 'In your possession', value: `${stats.owned}`, unit: 'items', foot: stats.ownedAddedThisMonth ? `+${stats.ownedAddedThisMonth} this month` : 'None yet' },
    { label: 'On your mind', value: `${stats.shopping}`, unit: 'items', foot: stats.shopping ? plural(stats.shoppingCategories, 'category', 'categories') : 'None yet' },
    { label: 'Estimated value', value: money(mainTotal, mainCurrency), unit: '', foot: others ? `+ ${others}` : `${plural(stats.owned, 'owned item')}` },
    { label: 'Orders in flight', value: `${stats.ordered.length}`, unit: stats.ordered.length === 1 ? 'order' : 'orders', foot: stats.ordered[0] ? stats.ordered[0].name : 'None yet' },
  ];
  return (
    <View style={styles.stats}>
      {cards.map((c) => (
        <View key={c.label} style={[styles.card, { borderColor: colors.line, backgroundColor: colors.surface }]}>
          <Text style={[styles.cardLabel, { color: colors.faint }]}>{c.label.toUpperCase()}</Text>
          <Text style={[styles.cardValue, { color: colors.ink }]}>
            {c.value}{c.unit ? <Text style={[styles.cardUnit, { color: colors.muted }]}> {c.unit}</Text> : null}
          </Text>
          <Text style={[styles.cardFoot, { color: colors.muted }]} numberOfLines={1}>{c.foot}</Text>
        </View>
      ))}
    </View>
  );
}

export function Nudge({ count, onReview, onDismiss }: { count: number; onReview: () => void; onDismiss: () => void }) {
  const colors = useColors();
  return (
    <View style={[styles.nudge, { borderColor: colors.line, backgroundColor: colors.greenTint }]}>
      <View style={[styles.nudgeIcon, { backgroundColor: colors.surface }]}>
        <SFSymbol name="shippingbox" size={20} color={colors.green} />
      </View>
      <View style={styles.nudgeCopy}>
        <Text style={[styles.nudgeTitle, { color: colors.ink }]}>Make room for something new?</Text>
        <Text style={[styles.nudgeText, { color: colors.muted }]} numberOfLines={2}>
          {plural(count, 'item')} without a home yet.
        </Text>
        <Pressable onPress={onReview} style={styles.linkHit} accessibilityRole="button" accessibilityLabel="Review unhomed items">
          <Text style={[styles.link, { color: colors.link }]}>Review items</Text>
          <Chevron color={colors.link} />
        </Pressable>
      </View>
      <Pressable onPress={onDismiss} accessibilityLabel="Dismiss" hitSlop={10} style={styles.dismiss}>
        <SFSymbol name="xmark" size={13} weight="semibold" color={colors.muted} />
      </Pressable>
    </View>
  );
}

export function Panels({ containers, items, ordered, onSeeAll, onOrders, onCreate }: {
  containers: Group[];
  items: Item[];
  ordered: Item[];
  onSeeAll: () => void;
  onOrders: () => void;
  onCreate: () => void;
}) {
  const colors = useColors();
  const badges = useBadgeColors();
  const top = [...containers].sort((a, b) => countIn('container', b, items) - countIn('container', a, items)).slice(0, 3);
  return (
    <View style={styles.panels}>
      <View style={[styles.panel, { borderColor: colors.line, backgroundColor: colors.surface }]}>
        <View style={styles.panelTitle}>
          <Text style={[styles.panelHeading, { color: colors.ink }]}>Spaces & places</Text>
          {containers.length > 0 ? (
            <Pressable onPress={onSeeAll} style={styles.linkHit} accessibilityLabel="See all containers">
              <Text style={[styles.link, { color: colors.link }]}>See all</Text>
              <Chevron color={colors.link} />
            </Pressable>
          ) : null}
        </View>
        {top.length === 0 ? (
          <Text style={[styles.muted, { color: colors.muted }]}>
            No containers yet.{' '}
            <Text style={[styles.link, { color: colors.link }]} onPress={onCreate}>Create one</Text>
            {' '}to give your things a home.
          </Text>
        ) : top.map((c) => (
          <View style={[styles.panelRow, { borderTopColor: colors.lineSoft }]} key={c.id}>
            <View style={[styles.emoji, { backgroundColor: colors.greenTint }]}>
              <Text style={styles.emojiText}>{c.icon}</Text>
            </View>
            <View style={styles.panelMain}>
              <Text style={[styles.panelName, { color: colors.ink }]} numberOfLines={1}>{c.name}</Text>
              {c.description ? <Text style={[styles.panelSub, { color: colors.muted }]} numberOfLines={1}>{c.description}</Text> : null}
            </View>
            <Text style={[styles.count, { color: colors.muted }]}>{plural(countIn('container', c, items), 'item')}</Text>
          </View>
        ))}
      </View>
      <View style={[styles.panel, { borderColor: colors.line, backgroundColor: colors.surface }]}>
        <View style={styles.panelTitle}>
          <Text style={[styles.panelHeading, { color: colors.ink }]}>Coming up</Text>
          {ordered.length > 0 ? (
            <Pressable onPress={onOrders} style={styles.linkHit} accessibilityLabel="View orders">
              <Text style={[styles.link, { color: colors.link }]}>View orders</Text>
              <Chevron color={colors.link} />
            </Pressable>
          ) : null}
        </View>
        {ordered.length === 0 ? <Text style={[styles.muted, { color: colors.muted }]}>Nothing on its way.</Text> : ordered.slice(0, 3).map((o) => (
          <View style={[styles.panelRow, { borderTopColor: colors.lineSoft }]} key={o.id}>
            <View style={[styles.emoji, { backgroundColor: colors.greenTint }]}>
              <Text style={styles.emojiText}>{o.icon}</Text>
            </View>
            <View style={styles.panelMain}>
              <Text style={[styles.panelName, { color: colors.ink }]} numberOfLines={1}>{o.name}</Text>
              <Text style={[styles.panelSub, { color: colors.muted }]} numberOfLines={1}>
                {o.vendor ? `From ${o.vendor} · ` : ''}Ordered {shortDate(o.date)}
              </Text>
            </View>
            <Text style={[styles.pill, { color: badges.Ordered.fg, backgroundColor: badges.Ordered.bg }]}>ORDERED</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function SegmentedTabs<T extends string>({ options, value, onChange, labels }: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Partial<Record<T, string>>;
}) {
  const colors = useColors();
  return (
    <View style={[styles.segments, { backgroundColor: colors.lineSoft }]} accessibilityRole="radiogroup">
      {options.map((o) => {
        const active = o === value;
        return (
          <Pressable
            key={o}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={labels?.[o] ?? o}
            onPress={() => {
              void select();
              onChange(o);
            }}
            style={[styles.segment, active && { backgroundColor: colors.surface, ...styles.segmentShadow }]}
          >
            <Text style={[styles.segmentText, { color: active ? colors.ink : colors.muted }]}>
              {labels?.[o] ?? o}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  card: {
    flexBasis: '48%', flexGrow: 1, borderWidth: 1, borderRadius: radius.lg,
    padding: spacing.md, minWidth: 0,
  },
  cardLabel: { ...type.micro },
  cardValue: { ...type.h1, marginTop: spacing.sm },
  cardUnit: { ...type.caption, fontWeight: '500', letterSpacing: 0 },
  cardFoot: { ...type.caption, marginTop: spacing.xs },
  nudge: {
    flexDirection: 'row', gap: spacing.md, alignItems: 'center',
    borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.xl,
  },
  nudgeIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  nudgeCopy: { flex: 1, gap: 2, minWidth: 0 },
  nudgeTitle: { ...type.subhead },
  nudgeText: { ...type.footnote },
  link: { ...type.footnote, fontWeight: '600' },
  linkHit: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', paddingVertical: spacing.xs },
  dismiss: { alignSelf: 'flex-start', padding: spacing.sm, margin: -spacing.sm },
  panels: { gap: spacing.md, marginBottom: spacing.lg },
  panel: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  panelTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm, minHeight: 28 },
  panelHeading: { ...type.headline },
  panelRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', paddingVertical: spacing.sm, borderTopWidth: 1 },
  panelMain: { flex: 1, minWidth: 0 },
  panelName: { ...type.subhead },
  panelSub: { ...type.caption, marginTop: 1 },
  emoji: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 22 },
  count: { ...type.caption },
  pill: { ...type.micro, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full, overflow: 'hidden' },
  muted: { ...type.body },
  segments: { flexDirection: 'row', borderRadius: radius.full, padding: 3, gap: 2 },
  segment: { flex: 1, borderRadius: radius.full, paddingVertical: spacing.sm, alignItems: 'center' },
  segmentShadow: {
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  segmentText: { fontSize: 13, fontWeight: '600' },
});
