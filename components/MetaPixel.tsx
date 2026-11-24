"use client";
import { useEffect, useState } from "react";
import Script from "next/script";
import { getConsent } from "@/lib/privacy/consent";
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "";
export function MetaPixel() {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    const update = () => {
      const granted = getConsent() === "all";
      if (window.fbq) window.fbq("consent", granted ? "grant" : "revoke");
      setAllowed(granted);
    };
    update();
    window.addEventListener("consentUpdated", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("consentUpdated", update);
      window.removeEventListener("storage", update);
    };
  }, []);
  if (!allowed || !/^\d+$/.test(PIXEL_ID)) return null;
  return (
    <Script
      id="meta-pixel-base"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
    if (window.localStorage.getItem('estories_cookie_consent') === 'all') {
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      fbq('consent','grant');fbq('init','${PIXEL_ID}');fbq('track','PageView');
    }`,
      }}
    />
  );
}
