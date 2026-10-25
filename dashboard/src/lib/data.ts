import { createServerFn } from '@tanstack/react-start';
export const getDashboard = createServerFn({ method: 'GET' }).handler(async () => {
  const [{ env }, { readDashboard }, { setResponseHeader }] = await Promise.all([
    import('cloudflare:workers'), import('../../../src/dashboard.ts'), import('@tanstack/react-start/server'),
  ]);
  setResponseHeader('Cache-Control', 'no-store');
  return readDashboard(env.DB);
});
