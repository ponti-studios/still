import { useState, type FormEvent } from 'react';
import { TextField } from '@ponti-studios/ui/forms';
import { Button } from '@ponti-studios/ui/primitives';
import { Sheet } from './Sheet';
import type { Group, GroupKind } from '../types';

export function GroupSheet({ kind, group, onSave, onClose }: {
  kind: GroupKind;
  group?: Group;
  onSave: (data: Pick<Group, 'name' | 'description'>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), description: description.trim() });
    onClose();
  };
  return (
    <Sheet title={`${group ? 'Edit' : 'New'} ${kind}`} onClose={onClose}>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <TextField label="Name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'container' ? 'e.g. Hall closet' : 'e.g. Everyday carry'} />
        <TextField label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What lives here?" />
        <Button type="submit" disabled={!name.trim()}>{group ? 'Save changes' : `Create ${kind}`}</Button>
      </form>
    </Sheet>
  );
}
