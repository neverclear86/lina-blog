import { actions, i18n, middleware, pages } from "astro/hono";
import { Hono } from "hono";
import api from "./api";

const app = new Hono();

// Worker routes go before the Astro handlers; `pages()` answers 404 for anything it does not match.
app.route("/", api);

app.use(actions());
app.use(middleware());
app.use(pages());
app.use(i18n());

export default app;
