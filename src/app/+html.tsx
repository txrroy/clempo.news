import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const NEWSREADER_STYLESHEET =
  'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..700&display=swap';
const INTER_STYLESHEET =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';

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
        <link id="inter-font" rel="stylesheet" href={INTER_STYLESHEET} />
        <ScrollViewStyleReset />
        <style>{`html, body { background-color: #141821; }`}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
