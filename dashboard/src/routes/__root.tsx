import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import css from '../styles.css?url';
export const Route = createRootRoute({
  head: () => ({ meta: [{ charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { title: 'CRWC · Room to move' }, { name: 'description', content: 'Latest reported occupancy and recent observations for the Iowa CRWC.' }],
    links: [{ rel: 'stylesheet', href: css }] }),
  component: () => <html lang="en"><head><HeadContent /></head><body><Outlet /><Scripts /></body></html>,
  notFoundComponent: () => <main className="shell"><h1>Page not found</h1><a href="/">Back to occupancy</a></main>,
});
