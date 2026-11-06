import { useState } from 'react';
import { ActionSheetIOS, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Sheet } from './Sheet';
import { countIn } from '../core/groups';
import { plural } from '../core/format';
import type { Group, GroupKind, Item } from '../core/types';
import { impact } from '../platform/haptics';
import { Chevron, DotsButton, EmptyState, Field, PrimaryButton } from './controls';
import { radius, spacing, type, useColors } from './theme';

export function GroupGrid({ kind, groups, items, onOpen, onEdit, onDelete, onCreate }: {
  kind: GroupKind;
  groups: Group[];
  items: Item[];
  onOpen: (group: Group) => void;
  onEdit: (group: Group) => void;
  onDelete: (group: Group) => void;
  onCreate: () => void;
}) {
  const colors = useColors();
  if (groups.length === 0) {
    return (
      <EmptyState
        body={kind === 'container'
          ? 'Containers are the places your things live.'
          : 'Collections group things across places.'}
        actionLabel={`Create ${kind}`}
        onAction={onCreate}
      />
    );
  }
  return (
    <View style={styles.grid}>
      {groups.map((group, index) => (
        <GroupCard
          key={group.id}
          index={index}
          kind={kind}
          group={group}
          count={countIn(kind, group, items)}
          onOpen={() => onOpen(group)}
          onEdit={() => onEdit(group)}
          onDelete={() => onDelete(group)}
        />
      ))}
    </View>
  );
}

function GroupCard({ index, kind, group, count, onOpen, onEdit, onDelete }: {
  index: number;
  kind: GroupKind;
  group: Group;
  count: number;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  const openMenu = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      { title: group.name, options: ['Rename / edit', 'Delete…', 'Cancel'], cancelButtonIndex: 2, destructiveButtonIndex: 1 },
      (menuIndex) => {
        if (menuIndex === 0) onEdit();
        else if (menuIndex === 1) onDelete();
      },
    );
  };
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index * 40, 320)).duration(260)}
      layout={LinearTransition.springify().damping(20)}
      style={styles.half}
    >
      <Pressable
        onPress={() => {
          void impact('light');
          onOpen();
        }}
        accessibilityRole="button"
        accessibilityLabel={`${group.name}, ${plural(count, 'item')}`}
        style={[styles.card, { borderColor: colors.line, backgroundColor: colors.surface }]}
      >
        <View style={styles.cardTop}>
          <View style={[styles.icon, { backgroundColor: colors.greenTint }]}>
            <Text style={styles.iconText}>{group.icon}</Text>
          </View>
          <DotsButton label={`Actions for ${group.name}`} onPress={openMenu} />
        </View>
        <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>{group.name}</Text>
        {group.description ? <Text style={[styles.desc, { color: colors.muted }]} numberOfLines={2}>{group.description}</Text> : null}
        <View style={styles.foot}>
          <Text style={[styles.count, { color: colors.muted }]}>{plural(count, 'item')}</Text>
          <Chevron />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function GroupSheet({ kind, group, onSave, onClose }: {
  kind: GroupKind;
  group?: Group;
  onSave: (data: Pick<Group, 'name' | 'description'>) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [nameError, setNameError] = useState(false);
  const submit = () => {
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    onSave({ name: name.trim(), description: description.trim() });
    onClose();
  };
  return (
    <Sheet title={`${group ? 'Edit' : 'New'} ${kind}`} onClose={onClose}>
      <View style={styles.form}>
        <Field label="Name" required error={nameError ? 'Give it a name to continue.' : null}>
          <TextInput
            autoFocus
            value={name}
            onChangeText={(text) => { setName(text); setNameError(false); }}
            placeholder={kind === 'container' ? 'e.g. Hall closet' : 'e.g. Everyday carry'}
            placeholderTextColor={colors.faint}
            style={[styles.input, { borderColor: colors.line, backgroundColor: colors.surface, color: colors.ink }]}
            returnKeyType="done"
          />
        </Field>
        <Field label="Description">
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What lives here?"
            placeholderTextColor={colors.faint}
            style={[styles.input, { borderColor: colors.line, backgroundColor: colors.surface, color: colors.ink }]}
          />
        </Field>
        <PrimaryButton label={group ? 'Save changes' : `Create ${kind}`} onPress={submit} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  half: { flexBasis: '48%', flexGrow: 1, minWidth: 0 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, minHeight: 148 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  icon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 22 },
  name: { ...type.subhead },
  desc: { ...type.caption },
  foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: spacing.xs },
  count: { ...type.caption },
  form: { gap: spacing.lg, paddingBottom: spacing.sm },
  input: {
    minHeight: 52, paddingHorizontal: spacing.lg, borderWidth: 1,
    borderRadius: radius.md, fontSize: 16,
  },
});
