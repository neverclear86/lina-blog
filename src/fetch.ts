import { actions, i18n, middleware, pages } from 'astro/hono';
import { Hono } from 'hono';

const app = new Hono();

app.get('/api/health', (c) => c.json({ ok: true }));

app.use(actions());
app.use(middleware());
app.use(pages());
app.use(i18n());

export default app;
