import { Pressable, StyleSheet, Text, View } from 'react-native';
import { countIn } from '../core/groups';
import { deriveStats } from '../core/derive';
import { money, plural, shortDate } from '../core/format';
import type { Group, Item } from '../core/types';
import { colors } from './theme';

type Stats = ReturnType<typeof deriveStats>;

export function StatCards({ stats }: { stats: Stats }) {
  // Items can be priced in different currencies; show the biggest total and mention the rest.
  const totals = Object.entries(stats.worth).sort((a, b) => b[1] - a[1]);
  const [mainCurrency, mainTotal] = totals[0] ?? ['GBP', 0];
  const others = totals.slice(1).filter(([, total]) => total > 0).map(([currency, total]) => money(total, currency)).join(' + ');
  const cards = [
    { label: 'IN YOUR POSSESSION', value: `${stats.owned}`, unit: 'items', foot: stats.ownedAddedThisMonth ? `${stats.ownedAddedThisMonth} added this month` : 'Nothing added this month' },
    { label: 'ON YOUR MIND', value: `${stats.shopping}`, unit: 'items', foot: stats.shopping ? `Across ${plural(stats.shoppingCategories, 'category', 'categories')}` : 'Nothing on the list' },
    { label: 'ESTIMATED VALUE', value: money(mainTotal, mainCurrency), unit: '', foot: others ? `Plus ${others}` : `Across ${plural(stats.owned, 'owned item')}` },
    { label: 'ORDERS IN FLIGHT', value: `${stats.ordered.length}`, unit: stats.ordered.length === 1 ? 'order' : 'orders', foot: stats.ordered[0] ? `Latest: ${stats.ordered[0].name}` : 'Nothing on its way' },
  ];
  return (
    <View style={styles.stats}>
      {cards.map((c) => (
        <View style={styles.card} key={c.label}>
          <Text style={styles.cardLabel}>{c.label}</Text>
          <Text style={styles.cardValue}>{c.value}{c.unit ? <Text style={styles.cardUnit}> {c.unit}</Text> : null}</Text>
          <Text style={styles.cardFoot}>{c.foot}</Text>
        </View>
      ))}
    </View>
  );
}

export function Nudge({ count, onReview, onDismiss }: { count: number; onReview: () => void; onDismiss: () => void }) {
  return (
    <View style={styles.nudge}>
      <Text style={styles.nudgeIcon}>📦</Text>
      <View style={styles.nudgeCopy}>
        <Text style={styles.eyebrow}>A SMALL NUDGE</Text>
        <Text style={styles.nudgeTitle}>Make room for something new?</Text>
        <Text style={styles.nudgeText}>{plural(count, 'item')} without a home yet. Put {count === 1 ? 'it' : 'them'} in a container.</Text>
        <Pressable onPress={onReview} style={styles.linkHit}>
          <Text style={styles.link}>Review items →</Text>
        </Pressable>
      </View>
      <Pressable onPress={onDismiss} accessibilityLabel="Dismiss" hitSlop={10} style={styles.dismiss}>
        <Text style={styles.dismissText}>✕</Text>
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
  const top = [...containers].sort((a, b) => countIn('container', b, items) - countIn('container', a, items)).slice(0, 3);
  return (
    <View style={styles.panels}>
      <View style={styles.panel}>
        <View style={styles.panelTitle}>
          <Text style={styles.panelHeading}>Spaces & places</Text>
          {containers.length > 0 ? (
            <Pressable onPress={onSeeAll}><Text style={styles.link}>See all →</Text></Pressable>
          ) : null}
        </View>
        {top.length === 0 ? (
          <Text style={styles.muted}>
            No containers yet.{' '}
            <Text style={styles.link} onPress={onCreate}>Create one</Text>
            {' '}to give your things a home.
          </Text>
        ) : top.map((c) => (
          <View style={styles.panelRow} key={c.id}>
            <View style={styles.emoji}><Text style={styles.emojiText}>{c.icon}</Text></View>
            <View style={styles.panelMain}>
              <Text style={styles.panelName}>{c.name}</Text>
              {c.description ? <Text style={styles.panelSub}>{c.description}</Text> : null}
            </View>
            <Text style={styles.count}>{plural(countIn('container', c, items), 'item')}</Text>
          </View>
        ))}
      </View>
      <View style={styles.panel}>
        <View style={styles.panelTitle}>
          <Text style={styles.panelHeading}>Coming up</Text>
          {ordered.length > 0 ? (
            <Pressable onPress={onOrders}><Text style={styles.link}>View orders →</Text></Pressable>
          ) : null}
        </View>
        {ordered.length === 0 ? <Text style={styles.muted}>Nothing is on its way right now.</Text> : ordered.slice(0, 3).map((o) => (
          <View style={styles.panelRow} key={o.id}>
            <View style={styles.emoji}><Text style={styles.emojiText}>{o.icon}</Text></View>
            <View style={styles.panelMain}>
              <Text style={styles.panelName}>{o.name}</Text>
              <Text style={styles.panelSub}>{o.vendor ? `From ${o.vendor} · ` : ''}Ordered {shortDate(o.date)}</Text>
            </View>
            <Text style={styles.pill}>ORDERED</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  card: { flexBasis: '48%', flexGrow: 1, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: 12, padding: 14, minWidth: 0 },
  cardLabel: { color: colors.faint, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  cardValue: { marginTop: 8, fontSize: 24, fontWeight: '700', letterSpacing: -0.6, color: '#343932' },
  cardUnit: { fontSize: 12, fontWeight: '500', letterSpacing: 0, color: '#9b9d96' },
  cardFoot: { marginTop: 6, color: colors.muted, fontSize: 12, lineHeight: 16 },
  nudge: {
    flexDirection: 'row', gap: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e4e7dd',
    backgroundColor: '#f1f3ed', borderRadius: 12, padding: 14, marginBottom: 22,
  },
  nudgeIcon: { fontSize: 24 },
  nudgeCopy: { flex: 1, gap: 3 },
  eyebrow: { color: colors.faint, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  nudgeTitle: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  nudgeText: { fontSize: 13, color: colors.muted },
  link: { color: colors.link, fontWeight: '600', fontSize: 13 },
  linkHit: { alignSelf: 'flex-start', paddingVertical: 4 },
  dismiss: { alignSelf: 'flex-start', margin: -8, padding: 8 },
  dismissText: { fontSize: 14, color: '#6b6e67' },
  panels: { gap: 12, marginBottom: 16 },
  panel: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: 12, padding: 14 },
  panelTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, minHeight: 28 },
  panelHeading: { fontSize: 15, fontWeight: '700', color: colors.ink },
  panelRow: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.lineSoft },
  panelMain: { flex: 1, minWidth: 0 },
  panelName: { fontSize: 14, fontWeight: '600', color: colors.ink },
  panelSub: { color: colors.muted, fontSize: 12, marginTop: 1 },
  emoji: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f2f3ee', alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 20 },
  count: { color: colors.muted, fontSize: 12 },
  pill: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: '#6f8795', backgroundColor: '#eaf0f4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  muted: { color: colors.muted, fontSize: 14 },
});
