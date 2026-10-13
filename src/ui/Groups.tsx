import { useState } from 'react';
import { ActionSheetIOS, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Sheet } from './Sheet';
import { countIn } from '../core/groups';
import { plural } from '../core/format';
import type { Group, GroupKind, Item } from '../core/types';
import { colors } from './theme';

export function GroupGrid({ kind, groups, items, onOpen, onEdit, onDelete, onCreate }: {
  kind: GroupKind;
  groups: Group[];
  items: Item[];
  onOpen: (group: Group) => void;
  onEdit: (group: Group) => void;
  onDelete: (group: Group) => void;
  onCreate: () => void;
}) {
  if (groups.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          {kind === 'container'
            ? 'Containers are the places your things live: a closet, a shelf, a bag.'
            : 'Collections group things across places: everyday carry, favourites.'}
        </Text>
        <Pressable style={styles.primary} onPress={onCreate}>
          <Text style={styles.primaryText}>{`+ Create ${kind}`}</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <FlatList
      data={groups}
      keyExtractor={(g) => g.id}
      scrollEnabled={false}
      renderItem={({ item: group }) => {
        const openMenu = () => {
          ActionSheetIOS.showActionSheetWithOptions(
            { title: group.name, options: ['Rename / edit', 'Delete…', 'Cancel'], cancelButtonIndex: 2, destructiveButtonIndex: 1 },
            (index) => {
              if (index === 0) onEdit(group);
              else if (index === 1) onDelete(group);
            },
          );
        };
        return (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.icon}>
                <Text style={styles.iconText}>{group.icon}</Text>
              </View>
              <Pressable onPress={openMenu} accessibilityLabel={`Actions for ${group.name}`} hitSlop={10} style={styles.dots}>
                <Text style={styles.dotsText}>•••</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => onOpen(group)} style={styles.open}>
              <Text style={styles.name}>{group.name}</Text>
              {group.description ? <Text style={styles.desc}>{group.description}</Text> : null}
              <View style={styles.foot}>
                <Text style={styles.count}>{plural(countIn(kind, group, items), 'item')}</Text>
                <Text style={styles.openLink}>Open →</Text>
              </View>
            </Pressable>
          </View>
        );
      }}
    />
  );
}

export function GroupSheet({ kind, group, onSave, onClose }: {
  kind: GroupKind;
  group?: Group;
  onSave: (data: Pick<Group, 'name' | 'description'>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const submit = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), description: description.trim() });
    onClose();
  };
  return (
    <Sheet title={`${group ? 'Edit' : 'New'} ${kind}`} onClose={onClose}>
      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Name</Text>
          <TextInput autoFocus value={name} onChangeText={setName} placeholder={kind === 'container' ? 'e.g. Hall closet' : 'e.g. Everyday carry'} style={styles.input} returnKeyType="done" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Description <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput value={description} onChangeText={setDescription} placeholder="What lives here?" style={styles.input} />
        </View>
        <View style={styles.footRow}>
          <View style={{ flex: 1 }} />
          <Pressable style={[styles.primary, !name.trim() && styles.disabled]} disabled={!name.trim()} onPress={submit}>
            <Text style={styles.primaryText}>{group ? 'Save changes' : `Create ${kind}`}</Text>
          </Pressable>
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center', gap: 14, padding: 36, borderWidth: 1, borderStyle: 'dashed',
    borderColor: '#dcddd6', borderRadius: 12, backgroundColor: '#fbfbf9', marginBottom: 24,
  },
  emptyText: { color: colors.muted, fontSize: 14, textAlign: 'center' },
  primary: {
    minHeight: 44, borderRadius: 10, backgroundColor: colors.green,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18,
  },
  disabled: { opacity: 0.5 },
  primaryText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  card: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  icon: { width: 44, height: 44, borderRadius: 11, backgroundColor: colors.greenTint, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 22 },
  dots: { padding: 4 },
  dotsText: { fontSize: 14, color: '#6b6e67', letterSpacing: 1 },
  open: { paddingTop: 6 },
  name: { fontSize: 16, fontWeight: '700', color: colors.ink, marginBottom: 3 },
  desc: { color: colors.muted, fontSize: 13 },
  foot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.lineSoft },
  count: { color: colors.muted, fontSize: 13 },
  openLink: { color: colors.link, fontWeight: '600', fontSize: 13 },
  form: { gap: 16, paddingBottom: 8 },
  field: { gap: 7 },
  label: { fontSize: 13, fontWeight: '600', color: '#4f524b' },
  optional: { fontWeight: '400', color: colors.faint },
  input: {
    minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderColor: '#dfe0d9',
    borderRadius: 10, backgroundColor: '#fff', fontSize: 16, color: colors.ink,
  },
  footRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
