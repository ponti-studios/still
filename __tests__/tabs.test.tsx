import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

let tabProps: any;
jest.mock('react-native-bottom-tabs', () => ({
  __esModule: true,
  default: (props: any) => {
    tabProps = props;
    return null;
  },
  useBottomTabBarHeight: () => 80,
}));

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

let mockState: any;
jest.mock('../src/core/store', () => ({ useStore: () => mockState }));

jest.mock('../src/platform/NativeStill', () => ({
  NativeStill: () => ({ isNudgeDismissed: () => Promise.resolve(false), dismissNudge: () => undefined }),
  settingsUrl: () => null,
  apiBaseURL: () => null,
  stillAvailable: false,
  stillEvents: null,
}));

import { Main } from '../App';
import type { Item } from '../src/core/types';
import { colors } from '../src/ui/theme';

const item = (o: Partial<Item>): Item => ({ id: 'x', name: 'X', category: 'home', status: 'Owned', value: 10, currency: 'GBP', date: '2025-09-01', dated: true, icon: '💻', color: 'blue', collectionIds: [], ...o });
const state = (items: Item[]) => ({
  phase: 'ready', items, containers: [], collections: [],
  notice: null, dismissNotice: () => undefined, reload: () => undefined,
  addItem: () => Promise.resolve(), updateItem: () => Promise.resolve(), deleteItem: () => Promise.resolve(),
  advance: () => Promise.resolve(), addGroup: () => Promise.resolve(), updateGroup: () => Promise.resolve(),
  deleteGroup: () => Promise.resolve(),
});

type JsonNode = string | { children?: JsonNode[] | JsonNode | null } | null;
function leaves(node: JsonNode, into: string[] = []): string[] {
  if (typeof node === 'string') into.push(node);
  else if (node && typeof node === 'object' && node.children) {
    (Array.isArray(node.children) ? node.children : [node.children]).forEach((c) => leaves(c, into));
  }
  return into;
}
async function render(): Promise<ReactTestRenderer.ReactTestRenderer | undefined> {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  // Async act: Main reads a preference on mount, and its promise must settle
  // inside act or the re-render lands after teardown.
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<Main email="cj@ponti.io" onSignOut={() => undefined} />);
  });
  return renderer;
}
async function sceneText(route: { key: string; title: string }) {
  const el = tabProps.renderScene({ route, jumpTo: () => undefined }) as React.ReactElement;
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(el);
  });
  return leaves(renderer?.toJSON() as JsonNode).join(' ');
}

describe('native tabs', () => {
  beforeEach(() => {
    mockState = state([item({ id: '1', name: 'Lamp' }), item({ id: '2', name: 'Chair', status: 'Ordered' })]);
    tabProps = undefined;
  });

  it('registers five tabs with glass behavior', async () => {
    await render();
    expect(tabProps.navigationState.routes).toEqual([
      { key: 'overview', title: 'Overview' },
      { key: 'possessions', title: 'Possessions' },
      { key: 'shopping', title: 'Shopping' },
      { key: 'orders', title: 'Orders' },
      { key: 'more', title: 'More' },
    ]);
    expect(tabProps.minimizeBehavior).toBe('onScrollDown');
    expect(tabProps.tabBarActiveTintColor).toBe(colors.green);
    expect(tabProps.hapticFeedbackEnabled).toBe(true);
  });

  it('uses SF Symbols that fill when focused', async () => {
    await render();
    const icon = (key: string, focused: boolean) => tabProps.getIcon({ route: { key }, focused });
    expect(icon('overview', false)).toEqual({ sfSymbol: 'house' });
    expect(icon('overview', true)).toEqual({ sfSymbol: 'house.fill' });
    expect(icon('possessions', true)).toEqual({ sfSymbol: 'shippingbox.fill' });
    expect(icon('shopping', true)).toEqual({ sfSymbol: 'cart.fill' });
    expect(icon('orders', true)).toEqual({ sfSymbol: 'box.truck.fill' });
    expect(icon('more', false)).toEqual({ sfSymbol: 'ellipsis' });
  });

  it('badges the orders tab with the in-flight count', async () => {
    await render();
    expect(tabProps.getBadge({ route: { key: 'orders' } })).toBe('1');
    expect(tabProps.getBadge({ route: { key: 'overview' } })).toBeUndefined();
    mockState = state([item({ id: '1' })]);
    await render();
    expect(tabProps.getBadge({ route: { key: 'orders' } })).toBeUndefined();
  });

  it('renders each tab scene', async () => {
    await render();
    expect(await sceneText({ key: 'overview', title: 'Overview' })).toContain('Recently added');
    expect(await sceneText({ key: 'possessions', title: 'Possessions' })).toContain('Everything you own');
    expect(await sceneText({ key: 'shopping', title: 'Shopping' })).toContain('Things you’re considering');
    expect(await sceneText({ key: 'orders', title: 'Orders' })).toContain('On their way');
    const more = await sceneText({ key: 'more', title: 'More' });
    expect(more).toContain('Containers');
    expect(more).toContain('cj@ponti.io');
  });

  it('switches tabs on index change', async () => {
    await render();
    expect(tabProps.navigationState.index).toBe(0);
    ReactTestRenderer.act(() => {
      tabProps.onIndexChange(2);
    });
    expect(tabProps.navigationState.index).toBe(2);
  });
});
