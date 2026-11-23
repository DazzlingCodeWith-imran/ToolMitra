import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import {
  ALL_PRERENDER_ROUTES,
  INDEXABLE_ROUTES,
  getPrerenderMetaForPath,
} from './data/seoRoutes';
import { AppRoutes } from './routes/AppRoutes';

export { ALL_PRERENDER_ROUTES, INDEXABLE_ROUTES };

export interface PrerenderResult {
  html: string;
  title: string;
  description: string;
  path: string;
  noindex: boolean;
  schemas: Array<Record<string, unknown>>;
}

export function render(url: string, origin: string): PrerenderResult {
  const meta = getPrerenderMetaForPath(url);
  const html = renderToString(
    <ThemeProvider>
      <StaticRouter location={url}>
        <AppRoutes />
      </StaticRouter>
    </ThemeProvider>,
  );

  return {
    html,
    title: meta.title,
    description: meta.description,
    path: meta.path,
    noindex: Boolean(meta.noindex),
    schemas: meta.structuredData ? meta.structuredData(origin) : [],
  };
}
