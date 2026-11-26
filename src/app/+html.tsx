import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const NEWSREADER_STYLESHEET =
  'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..700&display=swap';
const WORK_SANS_STYLESHEET =
  'https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700&display=swap';
const IBM_PLEX_MONO_STYLESHEET =
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap';
const BRICOLAGE_STYLESHEET =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..700&display=swap';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#141821" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link id="newsreader-font" rel="stylesheet" href={NEWSREADER_STYLESHEET} />
        <link id="work-sans-font" rel="stylesheet" href={WORK_SANS_STYLESHEET} />
        <link id="ibm-plex-mono-font" rel="stylesheet" href={IBM_PLEX_MONO_STYLESHEET} />
        <link id="bricolage-grotesque-font" rel="stylesheet" href={BRICOLAGE_STYLESHEET} />
        <ScrollViewStyleReset />
        <style>{`html, body { background-color: #141821; }`}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
