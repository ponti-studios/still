import { useEffect, useState } from 'react';

export const PAGES = ['Overview', 'Possessions', 'Shopping', 'Orders', 'Containers', 'Collections', 'Archive'] as const;
export type Page = (typeof PAGES)[number];
export type Route = { page: Page; id?: string };

function parse(): Route {
  const [page, id] = window.location.hash.replace(/^#\/?/, '').split('/');
  return { page: (PAGES as readonly string[]).includes(page ?? '') ? (page as Page) : 'Overview', id: id || undefined };
}

// Hash routing keeps the browser/Android back button working without a router dependency.
export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onChange = () => setRoute(parse());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const go = (page: Page, id?: string) => {
    window.location.hash = id ? `/${page}/${id}` : `/${page}`;
    window.scrollTo({ top: 0 });
  };
  return [route, go] as const;
}
