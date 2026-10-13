import { useState } from 'react';
import { ActionSheetIOS, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Sheet } from './Sheet';
import { plural } from '../core/format';
import { DEFAULT_CURRENCY } from '../core/types';
import type { Group, Item, ItemInput, Status } from '../core/types';
import { colors } from './theme';

const STATUSES: Status[] = ['Wanted', 'Planned', 'Ordered', 'Owned'];

export function ItemSheet({ item, defaults, containers, collections, categories, onSave, onClose }: {
  item?: Item;
  defaults?: Partial<ItemInput>;
  containers: Group[];
  collections: Group[];
  categories: string[];
  onSave: (input: ItemInput) => void;
  onClose: () => void;
}) {
  const start = { ...defaults, ...item };
  const [name, setName] = useState(start.name ?? '');
  const [status, setStatus] = useState<Status>(start.status ?? 'Wanted');
  const [category, setCategory] = useState(start.category ?? '');
  const [value, setValue] = useState(start.value ? String(start.value) : '');
  const [vendor, setVendor] = useState(start.vendor ?? '');
  const [containerId, setContainerId] = useState(start.containerId ?? '');
  const currency = start.currency ?? DEFAULT_CURRENCY;
  const [collectionIds, setCollectionIds] = useState<string[]>(start.collectionIds ?? []);

  const submit = () => {
    if (!name.trim()) return;
    const parsed = Number(value);
    onSave({
      name: name.trim(),
      category: category.trim() || 'Uncategorised',
      status,
      value: Number.isFinite(parsed) && parsed > 0 ? parsed : 0,
      currency,
      vendor: vendor.trim() || undefined,
      containerId: containerId || undefined,
      collectionIds,
    });
    onClose();
  };
  const toggle = (id: string) => setCollectionIds((ids) => (ids.includes(id) ? ids.filter((c) => c !== id) : [...ids, id]));
  const choices: Status[] = STATUSES.includes(status) ? STATUSES : [...STATUSES, status];
  const containerName = containers.find((c) => c.id === containerId)?.name ?? 'No container yet';

  const pickContainer = () => {
    const options = ['No container yet', ...containers.map((c) => c.name), 'Cancel'];
    ActionSheetIOS.showActionSheetWithOptions(
      { options, cancelButtonIndex: options.length - 1 },
      (index) => {
        if (index === 0) setContainerId('');
        else if (index !== undefined && index < options.length - 1) setContainerId(containers[index - 1]?.id ?? '');
      },
    );
  };

  return (
    <Sheet title={item ? 'Edit item' : 'Add to your space'} eyebrow={item ? undefined : 'A NEW THING'} onClose={onClose}>
      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>What is it called?</Text>
          <TextInput autoFocus value={name} onChangeText={setName} placeholder="e.g. A good reading lamp" style={styles.input} returnKeyType="done" />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Where does it sit in your journey?</Text>
          <View style={styles.chips}>
            {choices.map((s) => (
              <Pressable key={s} style={[styles.chip, status === s && styles.chosen]} onPress={() => setStatus(s)} accessibilityRole="button" accessibilityState={{ selected: status === s }}>
                <Text style={[styles.chipText, status === s && styles.chosenText]}>{status === s ? `✓ ${s}` : s}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.field, styles.half]}>
            <Text style={styles.label}>Category</Text>
            <TextInput value={category} onChangeText={setCategory} placeholder={categories[0] ?? 'Kitchen'} style={styles.input} autoCapitalize="none" />
          </View>
          <View style={[styles.field, styles.half]}>
            <Text style={styles.label}>Value ({currency})</Text>
            <TextInput value={value} onChangeText={setValue} placeholder="0" style={styles.input} keyboardType="decimal-pad" />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Vendor <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput value={vendor} onChangeText={setVendor} placeholder="Where it comes from" style={styles.input} />
        </View>

        {containers.length > 0 ? (
          <View style={styles.field}>
            <Text style={styles.label}>Container</Text>
            <Pressable style={styles.picker} onPress={pickContainer}>
              <Text style={styles.pickerText}>{containerName}</Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          </View>
        ) : null}

        {collections.length > 0 ? (
          <View style={styles.field}>
            <Text style={styles.label}>Collections</Text>
            <View style={styles.chips}>
              {collections.map((c) => (
                <Pressable
                  key={c.id}
                  style={[styles.chip, collectionIds.includes(c.id) && styles.chosen]}
                  onPress={() => toggle(c.id)}
                  accessibilityState={{ selected: collectionIds.includes(c.id) }}
                >
                  <Text style={[styles.chipText, collectionIds.includes(c.id) && styles.chosenText]}>
                    {collectionIds.includes(c.id) ? `✓ ${c.name}` : c.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.foot}>
          <Text style={styles.footNote}>{collectionIds.length > 0 ? plural(collectionIds.length, 'collection') : 'One item, for its whole lifecycle.'}</Text>
          <Pressable style={[styles.primary, !name.trim() && styles.disabled]} disabled={!name.trim()} onPress={submit}>
            <Text style={styles.primaryText}>{item ? 'Save changes' : 'Add item'}</Text>
          </Pressable>
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16, paddingBottom: 8 },
  field: { gap: 7 },
  half: { flex: 1 },
  row: { flexDirection: 'row', gap: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#4f524b' },
  optional: { fontWeight: '400', color: colors.faint },
  input: {
    minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderColor: '#dfe0d9',
    borderRadius: 10, backgroundColor: '#fff', fontSize: 16, color: colors.ink,
  },
  picker: {
    minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderColor: '#dfe0d9',
    borderRadius: 10, backgroundColor: '#fff', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  pickerText: { fontSize: 16, color: colors.ink },
  chevron: { fontSize: 18, color: colors.faint },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44, paddingHorizontal: 16, justifyContent: 'center',
    borderWidth: 1, borderColor: '#dfe0d9', borderRadius: 22, backgroundColor: '#fff',
  },
  chosen: { backgroundColor: colors.greenTint, borderColor: '#b9c8b0' },
  chipText: { fontSize: 14, fontWeight: '500', color: colors.ink },
  chosenText: { color: colors.green, fontWeight: '600' },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  footNote: { color: colors.muted, fontSize: 12, flex: 1 },
  primary: {
    flex: 1, maxWidth: 220, minHeight: 44, borderRadius: 10, backgroundColor: colors.green,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18,
  },
  disabled: { opacity: 0.5 },
  primaryText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
