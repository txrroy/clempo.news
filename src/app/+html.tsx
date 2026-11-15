import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const DM_SANS_STYLESHEET =
  'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400..700;1,9..40,400..700&display=swap';
const WORK_SANS_STYLESHEET =
  'https://fonts.googleapis.com/css2?family=Work+Sans:ital,wght@0,400..700;1,400..700&display=swap';
const CABINET_GROTESK_STYLESHEET =
  'https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@400,500,600,700&display=swap';
const BRICOLAGE_STYLESHEET =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&display=swap';
const PLUS_JAKARTA_STYLESHEET =
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400..700;1,400..700&display=swap';

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
        <link id="dm-sans-font" rel="stylesheet" href={DM_SANS_STYLESHEET} />
        <link id="work-sans-font" rel="stylesheet" href={WORK_SANS_STYLESHEET} />
        <link id="cabinet-grotesk-font" rel="stylesheet" href={CABINET_GROTESK_STYLESHEET} />
        <link id="bricolage-grotesque-font" rel="stylesheet" href={BRICOLAGE_STYLESHEET} />
        <link id="plus-jakarta-sans-font" rel="stylesheet" href={PLUS_JAKARTA_STYLESHEET} />
        <ScrollViewStyleReset />
        <style>{`html, body { background-color: #141821; }`}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
