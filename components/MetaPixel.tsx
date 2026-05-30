"use client";

import Script from "next/script";

/**
 * Meta Pixel Base Code — loads unconditionally so Meta can verify the domain.
 * The Pixel ID is configured via NEXT_PUBLIC_META_PIXEL_ID.
 *
 * Note: The base PageView fires on every load so Meta Events Manager can
 * verify the pixel. Custom events (Lead, Purchase, etc.) are gated behind
 * cookie consent in lib/meta-pixel.ts.
 */
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "";

export function MetaPixel() {
  // Don't render if no pixel ID is configured
  if (!PIXEL_ID) return null;

  return (
    <>
      {/* Meta Pixel base script */}
      <Script
        id="meta-pixel-base"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${PIXEL_ID}');
            fbq('track', 'PageView');
          `,
        }}
      />
      {/* noscript fallback for users with JavaScript disabled */}
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
