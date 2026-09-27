// @ts-check
import { readFileSync } from 'node:fs';
import cloudflare from '@astrojs/cloudflare';
import { defineConfig } from 'astro/config';

/** Same pattern Astro uses to read a page's `export const prerender`. */
const PRERENDER_EXPORT = /^\s*export\s+const\s+prerender\s*=\s*(true|false);?/m;

/**
 * Prerenders every page that does not export `prerender` itself.
 *
 * `output: 'server'` makes Astro always build the Worker, which the Hono app in
 * `src/fetch.ts` needs even when every page is static. In that mode Astro defaults
 * pages to on-demand rendering, so this integration restores prerendering as the
 * default. A page opts out with `export const prerender = false`.
 * @returns {import('astro').AstroIntegration}
 */
function prerenderByDefault() {
	/** @type {URL} */
	let root;
	return {
		name: 'prerender-by-default',
		hooks: {
			'astro:config:setup': ({ config }) => {
				root = config.root;
			},
			'astro:route:setup': ({ route }) => {
				const source = readFileSync(new URL(route.component, root), 'utf8');
				if (!PRERENDER_EXPORT.test(source)) {
					route.prerender = true;
				}
			},
		},
	};
}

// https://astro.build/config
export default defineConfig({
	output: 'server',
	adapter: cloudflare({
		// The default `cloudflare-binding` uses Cloudflare Images, which can incur charges.
		imageService: 'compile',
	}),
	integrations: [prerenderByDefault()],
	// Sessions are not used; this also keeps the adapter from provisioning a KV namespace.
	session: false,
});
