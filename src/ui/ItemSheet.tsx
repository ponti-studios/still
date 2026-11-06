import { useState } from 'react';
import { ActionSheetIOS, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { Sheet } from './Sheet';
import { plural } from '../core/format';
import { deleteStoredPhoto, removePhotoBackground, savePhoto } from '../core/photos';
import { DEFAULT_CURRENCY } from '../core/types';
import type { Group, Item, ItemInput, Status } from '../core/types';
import { notify, select } from '../platform/haptics';
import { Chevron, Field, PrimaryButton } from './controls';
import { GlassView } from './GlassView';
import { SFSymbol } from './SFSymbol';
import { radius, spacing, type, useColors } from './theme';

const STATUSES: Status[] = ['Wanted', 'Planned', 'Owned'];

export function ItemSheet({ item, defaults, containers, collections, categories, onSave, onClose }: {
  item?: Item;
  defaults?: Partial<ItemInput>;
  containers: Group[];
  collections: Group[];
  categories: string[];
  onSave: (input: ItemInput) => void | Promise<void>;
  onClose: () => void;
}) {
  const colors = useColors();
  const start = { ...defaults, ...item };
  const [name, setName] = useState(start.name ?? '');
  const [status, setStatus] = useState<Status>(start.status ?? 'Wanted');
  const [category, setCategory] = useState(start.category ?? '');
  const [value, setValue] = useState(start.value ? String(start.value) : '');
  const [vendor, setVendor] = useState(start.vendor ?? '');
  const [containerId, setContainerId] = useState(start.containerId ?? '');
  const currency = start.currency ?? DEFAULT_CURRENCY;
  const [collectionIds, setCollectionIds] = useState<string[]>(start.collectionIds ?? []);
  const [photo, setPhoto] = useState<string | null>(() => start.imageUrl ?? null);
  const [photoGone, setPhotoGone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoProblem, setPhotoProblem] = useState<string | null>(null);
  const [nameError, setNameError] = useState(false);

  const submit = async () => {
    if (saving) return;
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    const parsed = Number(value);
    const input: ItemInput = {
      name: name.trim(),
      category: category.trim() || 'Uncategorised',
      status,
      value: Number.isFinite(parsed) && parsed > 0 ? parsed : 0,
      currency,
      vendor: vendor.trim() || undefined,
      containerId: containerId || undefined,
      collectionIds,
    };
    if (photo) {
      input.imageUrl = photo;
    } else if (item?.imageUrl) {
      // Present-but-undefined removes the photo; absent leaves it alone.
      input.imageUrl = undefined;
    }
    await onSave(input);
    void notify('success');
    const old = item?.imageUrl;
    if (old && old !== photo) await deleteStoredPhoto(old);
    onClose();
  };

  const takePhoto = async (fromCamera: boolean) => {
    const base = { mediaType: 'photo' as const, quality: 0.8 as const, maxWidth: 1600, maxHeight: 1600 };
    const res = fromCamera
      ? await launchCamera({ ...base, saveToPhotos: false })
      : await launchImageLibrary(base);
    if (res.didCancel) return;
    if (res.errorCode || !res.assets?.[0]?.uri) {
      setPhotoProblem(res.errorMessage ?? 'That photo could not be used. Try another.');
      return;
    }
    const asset = res.assets[0];
    const uri = asset?.uri;
    if (!uri) return;
    setSaving(true);
    setPhotoProblem(null);
    try {
      setPhoto(await savePhoto(uri, asset?.type ?? 'image/jpeg'));
      setPhotoGone(false);
    } catch (e) {
      setPhotoProblem(e instanceof Error ? e.message : 'The photo could not be kept. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const cutBackground = async () => {
    if (!photo || saving) return;
    setSaving(true);
    setPhotoProblem(null);
    try {
      // The cutout replaces the original on device; a failure keeps it.
      setPhoto(await removePhotoBackground(photo));
      void notify('success');
    } catch (e) {
      setPhotoProblem(e instanceof Error ? e.message : 'No clear subject found. Try a plainer backdrop.');
    } finally {
      setSaving(false);
    }
  };

  const photoMenu = () => {
    const options = photo
      ? ['Take a photo', 'Choose from the library', 'Remove background', 'Remove the photo', 'Cancel']
      : ['Take a photo', 'Choose from the library', 'Cancel'];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
        destructiveButtonIndex: photo ? 3 : undefined,
      },
      (index) => {
        if (index === 0) void takePhoto(true);
        else if (index === 1) void takePhoto(false);
        else if (photo && index === 2) void cutBackground();
        else if (photo && index === 3) {
          setPhoto(null);
          setPhotoGone(false);
        }
      },
    );
  };
  const toggle = (id: string) => setCollectionIds((ids) => {
    void select();
    return ids.includes(id) ? ids.filter((c) => c !== id) : [...ids, id];
  });
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
        <Field label="What is it called?" required error={nameError ? 'Give it a name to continue.' : null}>
          <TextInput
            autoFocus
            value={name}
            onChangeText={(text) => { setName(text); setNameError(false); }}
            placeholder="e.g. A good reading lamp"
            placeholderTextColor={colors.faint}
            style={[styles.input, { borderColor: nameError ? colors.danger : colors.line, backgroundColor: colors.surface, color: colors.ink }]}
            returnKeyType="done"
          />
        </Field>

        <Field label="Photo">
          <Pressable
            style={[styles.photoBox, { borderColor: colors.line, backgroundColor: colors.surface }]}
            onPress={photoMenu}
            disabled={saving}
            accessibilityLabel={photo ? 'Change the photo' : 'Add a photo'}
          >
            {photo && !photoGone ? (
              <View>
                <Image
                  source={{ uri: photo }}
                  style={styles.photo}
                  resizeMode="cover"
                  onError={() => setPhotoGone(true)}
                />
                <GlassView cornerRadius={radius.full} style={styles.photoTools}>
                  <View style={styles.photoToolsRow}>
                    <Pressable
                      onPress={cutBackground}
                      accessibilityLabel="Remove background"
                      style={styles.toolPill}
                    >
                      <SFSymbol name="wand.and.stars" size={13} color={colors.ink} />
                      <Text style={[styles.toolText, { color: colors.ink }]}>Cutout</Text>
                    </Pressable>
                    <Pressable
                      onPress={photoMenu}
                      accessibilityLabel="Retake photo"
                      style={styles.toolPill}
                    >
                      <SFSymbol name="arrow.triangle.2.circlepath.camera" size={13} color={colors.ink} />
                      <Text style={[styles.toolText, { color: colors.ink }]}>Retake</Text>
                    </Pressable>
                  </View>
                </GlassView>
              </View>
            ) : (
              <View style={styles.photoEmpty}>
                <SFSymbol name="camera.fill" size={22} color={colors.faint} />
                <Text style={[styles.photoPlaceholder, { color: colors.green }]}>
                  {saving ? 'Saving…' : photoGone ? 'That photo is gone — add another' : 'Add a photo'}
                </Text>
              </View>
            )}
          </Pressable>
          <Animated.View layout={LinearTransition.springify().damping(24)}>
            {photoProblem ? (
              <Animated.Text
                entering={FadeInDown.duration(300)}
                exiting={FadeOut.duration(250)}
                style={[styles.photoError, { color: colors.danger }]}
              >
                {photoProblem}
              </Animated.Text>
            ) : null}
          </Animated.View>
        </Field>

        <Field label="Where does it sit in your journey?">
          <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Status">
            {choices.map((s) => {
              const active = status === s;
              return (
                <Pressable
                  key={s}
                  style={[styles.chip, { borderColor: active ? colors.green : colors.line, backgroundColor: active ? colors.greenTint : colors.surface }]}
                  onPress={() => {
                    void select();
                    setStatus(s);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={s}
                >
                  <Text style={[styles.chipText, { color: active ? colors.green : colors.ink }]}>{s}</Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <View style={styles.row}>
          <View style={[styles.field, styles.half]}>
            <Field label="Category">
              <TextInput
                value={category}
                onChangeText={setCategory}
                placeholder={categories[0] ?? 'Kitchen'}
                placeholderTextColor={colors.faint}
                style={[styles.input, { borderColor: colors.line, backgroundColor: colors.surface, color: colors.ink }]}
                autoCapitalize="none"
              />
            </Field>
          </View>
          <View style={[styles.field, styles.half]}>
            <Field label={`Value (${currency})`}>
              <TextInput
                value={value}
                onChangeText={setValue}
                placeholder="0"
                placeholderTextColor={colors.faint}
                style={[styles.input, { borderColor: colors.line, backgroundColor: colors.surface, color: colors.ink }]}
                keyboardType="decimal-pad"
              />
            </Field>
          </View>
        </View>

        <Field label="Vendor">
          <TextInput
            value={vendor}
            onChangeText={setVendor}
            placeholder="Where it comes from"
            placeholderTextColor={colors.faint}
            style={[styles.input, { borderColor: colors.line, backgroundColor: colors.surface, color: colors.ink }]}
          />
        </Field>

        {containers.length > 0 ? (
          <Field label="Container">
            <Pressable
              style={[styles.picker, { borderColor: colors.line, backgroundColor: colors.surface }]}
              onPress={pickContainer}
              accessibilityLabel={`Container, ${containerName}`}
            >
              <Text style={[styles.pickerText, { color: colors.ink }]}>{containerName}</Text>
              <Chevron />
            </Pressable>
          </Field>
        ) : null}

        {collections.length > 0 ? (
          <Field label="Collections">
            <View style={styles.chips} accessibilityRole="group" accessibilityLabel="Collections">
              {collections.map((c) => {
                const active = collectionIds.includes(c.id);
                return (
                  <Pressable
                    key={c.id}
                    style={[styles.chip, { borderColor: active ? colors.green : colors.line, backgroundColor: active ? colors.greenTint : colors.surface }]}
                    onPress={() => toggle(c.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={c.name}
                  >
                    <Text style={[styles.chipText, { color: active ? colors.green : colors.ink }]}>{c.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>
        ) : null}

        <View style={styles.foot}>
          <Text style={[styles.footNote, { color: colors.muted }]}>
            {collectionIds.length > 0 ? plural(collectionIds.length, 'collection') : 'One item, for its whole lifecycle.'}
          </Text>
          <PrimaryButton
            label={item ? 'Save changes' : 'Add item'}
            disabled={saving}
            style={styles.save}
            onPress={() => void submit()}
          />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  form: { gap: 18, paddingBottom: 8 },
  field: { gap: 7 },
  half: { flex: 1 },
  row: { flexDirection: 'row', gap: 12 },
  input: {
    minHeight: 52, paddingHorizontal: 14, borderWidth: 1,
    borderRadius: 12, fontSize: 16,
  },
  picker: {
    minHeight: 52, paddingHorizontal: 14, borderWidth: 1,
    borderRadius: 12, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 8,
  },
  pickerText: { fontSize: 16, flex: 1 },
  photoBox: {
    minHeight: 200, borderWidth: 1, borderRadius: 16, overflow: 'hidden',
    alignItems: 'stretch', justifyContent: 'center',
  },
  photo: { width: '100%', height: 220 },
  photoTools: {
    position: 'absolute', left: 12, right: 12, bottom: 12, borderRadius: 999,
  },
  photoToolsRow: { flexDirection: 'row', gap: 8, padding: 6, justifyContent: 'center' },
  toolPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 999, paddingHorizontal: 14, minHeight: 36,
  },
  toolText: { fontSize: 13, fontWeight: '600' },
  photoEmpty: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 36 },
  photoPlaceholder: { fontSize: 15, fontWeight: '600' },
  photoError: { fontSize: 12, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44, paddingHorizontal: 16, justifyContent: 'center',
    borderWidth: 1, borderRadius: 999,
  },
  chipText: { fontSize: 14, fontWeight: '500' },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 4 },
  footNote: { fontSize: 12, flex: 1 },
  save: { maxWidth: 220, flex: 1 },
});
