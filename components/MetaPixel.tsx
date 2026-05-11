"use client";

import { useState, useEffect } from "react";
import Script from "next/script";
import { getConsent } from "./CookieConsent";

/**
 * Meta Pixel Base Code — loads via next/script with afterInteractive strategy.
 * Only loads if user has given "all" cookie consent (GDPR compliant).
 *
 * Pixel ID: 749978950873721
 */
const PIXEL_ID = "749978950873721";

export function MetaPixel() {
  const [canLoad, setCanLoad] = useState(false);

  useEffect(() => {
    const check = () => setCanLoad(getConsent() === "all");
    check();
    window.addEventListener("consentUpdated", check);
    return () => window.removeEventListener("consentUpdated", check);
  }, []);

  if (!canLoad) return null;

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
