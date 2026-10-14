import React from 'react';
import { Image } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));
import { deriveStats } from '../src/core/derive';
import type { Group, Item } from '../src/core/types';
import type { AccountController } from '../src/core/useAccount';
import { GroupGrid, GroupSheet } from '../src/ui/Groups';
import { ItemList } from '../src/ui/ItemList';
import { ItemSheet } from '../src/ui/ItemSheet';
import { Nudge, Panels, StatCards } from '../src/ui/Overview';
import { Sheet } from '../src/ui/Sheet';
import { SignIn } from '../src/ui/SignIn';

const item = (o: Partial<Item>): Item => ({ id: 'x', name: 'X', category: 'home', status: 'Owned', value: 10, currency: 'GBP', date: '2025-09-01', dated: true, icon: '💻', color: 'blue', collectionIds: [], ...o });
const group = (o: Partial<Group>): Group => ({ id: 'g', name: 'G', icon: '📦', description: '', ...o });
const account = (o: Partial<AccountController>): AccountController => ({
  ready: true, email: null, step: 'idle', pendingEmail: null, busy: false, problem: null, problemCalm: false,
  requestCode: () => Promise.resolve({} as never),
  verify: () => Promise.resolve({} as never),
  cancelSignIn: () => Promise.resolve({} as never),
  clearProblem: () => Promise.resolve({} as never),
  signOut: () => Promise.resolve({} as never),
  ...o,
});
const actions = { onEdit: () => undefined, onAdvance: () => undefined, onArchive: () => undefined, onDelete: () => undefined };

type JsonNode = string | { children?: JsonNode[] | JsonNode | null } | null;

function leaves(node: JsonNode, into: string[] = []): string[] {
  if (typeof node === 'string') into.push(node);
  else if (node && typeof node === 'object' && node.children) {
    (Array.isArray(node.children) ? node.children : [node.children]).forEach((c) => leaves(c, into));
  }
  return into;
}

/** The visible copy of a screen: every text leaf joined, like a person reading it. */
function textOf(node: React.ReactElement) {
  return leaves(render(node)?.toJSON() as JsonNode).join(' ');
}

function render(node: React.ReactElement) {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(node);
  });
  return renderer!;
}

describe('screens', () => {
  it('renders the item list rows and the empty state', () => {
    const items = [item({ id: '1', name: 'Lamp' }), item({ id: '2', name: 'Chair', status: 'Wanted', value: 0 })];
    const out = textOf(<ItemList title="Everything you own" items={items} containers={[]} query="" empty={<></>} actions={actions} />);
    expect(out).toContain('Lamp');
    expect(out).toContain('Chair');
    expect(out).toContain('Wanted');
    const empty = textOf(<ItemList title="T" items={[]} containers={[]} query="zzz" empty={<></>} actions={actions} />);
    expect(empty).toContain('T');
  });

  it('shows item photos in the list when present', () => {
    const items = [
      item({ id: '1', name: 'Lamp', imageUrl: 'file:///stored/x.jpg' }),
      item({ id: '2', name: 'Chair' }),
    ];
    const renderer = render(
      <ItemList title="Everything you own" items={items} containers={[]} query="" empty={<></>} actions={actions} />,
    );
    const images = renderer.root.findAllByType(Image);
    expect(images).toHaveLength(1);
    expect(images[0]?.props.source).toEqual({ uri: 'file:///stored/x.jpg' });
  });

  it('offers a photo in the item sheet', () => {
    const fresh = textOf(
      <ItemSheet containers={[]} collections={[]} categories={[]} onSave={() => undefined} onClose={() => undefined} />,
    );
    expect(fresh).toContain('Add a photo');
    const renderer = render(
      <ItemSheet
        item={item({ name: 'Lamp', imageUrl: 'file:///stored/x.jpg' })}
        containers={[]}
        collections={[]}
        categories={[]}
        onSave={() => undefined}
        onClose={() => undefined}
      />,
    );
    const images = renderer.root.findAllByType(Image);
    expect(images).toHaveLength(1);
    expect(images[0]?.props.source).toEqual({ uri: 'file:///stored/x.jpg' });
  });

  it('renders overview cards, nudge and panels', () => {
    const items = [item({ id: '1' }), item({ id: '2', status: 'Wanted' }), item({ id: '3', status: 'Ordered', vendor: 'Ikea' })];
    const stats = deriveStats(items, new Date('2025-09-29T12:00:00Z'));
    expect(textOf(<StatCards stats={stats} />)).toContain('ESTIMATED VALUE');
    expect(textOf(<Nudge count={2} onReview={() => undefined} onDismiss={() => undefined} />)).toContain('2 items');
    const panels = textOf(
      <Panels containers={[group({ id: 'c', name: 'Closet' })]} items={items} ordered={stats.ordered}
        onSeeAll={() => undefined} onOrders={() => undefined} onCreate={() => undefined} />,
    );
    expect(panels).toContain('Spaces & places');
    expect(panels).toContain('ORDERED');
  });

  it('renders groups, the group sheet and the item sheet', () => {
    const grid = textOf(
      <GroupGrid kind="container" groups={[group({ id: 'c', name: 'Closet' })]} items={[item({ containerId: 'c' })]}
        onOpen={() => undefined} onEdit={() => undefined} onDelete={() => undefined} onCreate={() => undefined} />,
    );
    expect(grid).toContain('Closet');
    expect(grid).toContain('1 item');
    const emptyGrid = textOf(
      <GroupGrid kind="collection" groups={[]} items={[]} onOpen={() => undefined} onEdit={() => undefined} onDelete={() => undefined} onCreate={() => undefined} />,
    );
    expect(emptyGrid).toContain('Create collection');
    expect(textOf(<GroupSheet kind="container" onSave={() => undefined} onClose={() => undefined} />)).toContain('New container');
    const sheet = textOf(
      <ItemSheet containers={[]} collections={[]} categories={['home']} onSave={() => undefined} onClose={() => undefined} />,
    );
    expect(sheet).toContain('Add to your space');
    expect(sheet).toContain('Wanted');
    const edit = textOf(
      <ItemSheet item={item({ name: 'Lamp' })} containers={[]} collections={[]} categories={[]} onSave={() => undefined} onClose={() => undefined} />,
    );
    expect(edit).toContain('Edit item');
  });

  it('renders the sheet and both sign-in steps', () => {
    expect(textOf(<Sheet title="More" onClose={() => undefined}><></></Sheet>)).toContain('More');
    expect(textOf(<SignIn account={account({})} />)).toContain('Send a code');
    const code = textOf(<SignIn account={account({ step: 'codeSent', pendingEmail: 'cj@ponti.io', problem: 'That code didn’t work.', problemCalm: false })} />);
    expect(code).toContain('cj@ponti.io');
    expect(code).toContain('That code');
  });
});
