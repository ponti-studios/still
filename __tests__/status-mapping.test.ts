import type { ApiPossession } from '../src/core/apiTypes';
import { FROM_DB, fromPossession, toPossessionPayload } from '../src/core/mapping';

const possession = (o: Partial<ApiPossession>): ApiPossession => ({
  id: 'p1', name: 'Lamp', category: 'home', status: 'owned', isArchived: false,
  acquiredDate: null, priceCents: 1200, currencyCode: 'GBP',
  containerId: null, metadata: {}, createdAt: '2025-01-10T00:00:00Z', ...o,
});

// The convergence table (docs/status-category-mapping.md): every status Hominem
// can store maps onto exactly one Still status.
describe('possession status mapping', () => {
  it('leaves no storable status unmapped', () => {
    expect(FROM_DB).toEqual({
      wishlist: 'Wanted', planned: 'Planned', ordered: 'Ordered', delivered: 'Delivered',
      owned: 'Owned', in_use: 'Owned', retired: 'Archived', disposed: 'Archived',
      donated: 'Archived', sold: 'Archived',
    });
  });

  it.each([
    ['wishlist', 'Wanted'], ['planned', 'Planned'], ['ordered', 'Ordered'],
    ['delivered', 'Delivered'], ['owned', 'Owned'], ['in_use', 'Owned'],
    ['retired', 'Archived'], ['disposed', 'Archived'], ['donated', 'Archived'], ['sold', 'Archived'],
  ])('renders %s as %s', (status, expected) => {
    expect(fromPossession(possession({ status })).status).toBe(expected);
  });

  it('shows a row archived by its flag as Archived whatever the status', () => {
    expect(fromPossession(possession({ status: 'owned', isArchived: true })).status).toBe('Archived');
  });

  it('never hides a row whose status it does not recognise', () => {
    expect(fromPossession(possession({ status: 'invented-by-owner' })).status).toBe('Owned');
    expect(fromPossession(possession({ status: null })).status).toBe('Owned');
  });

  it('sends Archived as the flag and every other status as itself', () => {
    expect(toPossessionPayload({ status: 'Archived' })).toEqual({ isArchived: true });
    expect(toPossessionPayload({ status: 'Owned' })).toEqual({ isArchived: false, status: 'owned' });
  });
});
