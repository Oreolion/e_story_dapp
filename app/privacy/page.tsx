import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "eStories privacy policy. Learn how we collect, use, and protect your personal data and stories.",
  robots: { index: true, follow: true },
};

export default function PrivacyPolicyPage() {
  return (
    <article className="prose prose-gray dark:prose-invert max-w-3xl mx-auto py-8">
      <h1>Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">
        Last updated: May 11, 2026
      </p>

      <section>
        <h2>1. Introduction</h2>
        <p>
          eStories (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates the eStories
          platform at{" "}
          <a href="https://estories.app">estories.app</a>. This Privacy Policy
          explains how we collect, use, disclose, and safeguard your information
          when you use our platform.
        </p>
        <p>
          We are committed to protecting your privacy. eStories is designed with
          privacy-by-default principles including client-side encryption and
          minimal on-chain data exposure.
        </p>
      </section>

      <section>
        <h2>2. Information We Collect</h2>

        <h3>2.1 Information You Provide</h3>
        <ul>
          <li>
            <strong>Account Information:</strong> Wallet address (for Web3
            login), email address and name (for Google OAuth login), username,
            and profile avatar.
          </li>
          <li>
            <strong>Story Content:</strong> Text, audio recordings, titles,
            dates, and metadata you create on the platform.
          </li>
          <li>
            <strong>Waitlist:</strong> Email address if you join our waitlist.
          </li>
        </ul>

        <h3>2.2 Automatically Collected Information</h3>
        <ul>
          <li>
            <strong>Usage Data:</strong> Pages visited, features used, and
            interaction patterns (via Vercel Analytics).
          </li>
          <li>
            <strong>Device Information:</strong> Browser type, operating system,
            and device identifiers.
          </li>
          <li>
            <strong>Advertising Data:</strong> We use the Meta Pixel (Facebook
            Pixel) to collect data about your browsing behaviour for advertising
            and retargeting purposes. This includes page views, actions taken on
            the site (e.g. signing up, subscribing, recording stories), and
            device information shared with Meta&apos;s advertising platform.
          </li>
        </ul>

        <h3>2.3 Blockchain Data</h3>
        <p>
          When you mint stories as NFTs, tip creators, or interact with smart
          contracts, transaction data is recorded on the Base blockchain. This
          data is public and immutable by nature of blockchain technology.
        </p>
      </section>

      <section>
        <h2>3. How We Use Your Information</h2>
        <ul>
          <li>Provide, maintain, and improve the eStories platform</li>
          <li>Process your story recordings and provide AI-powered analysis</li>
          <li>Send transactional emails (welcome, waitlist confirmation)</li>
          <li>Authenticate your identity and secure your account</li>
          <li>Generate aggregated, anonymized usage statistics</li>
          <li>Respond to your requests and provide support</li>
          <li>Deliver, measure, and optimise advertising campaigns via Meta Pixel</li>
          <li>Build retargeting audiences for Facebook and Instagram ads</li>
        </ul>
      </section>

      <section>
        <h2>4. Client-Side Encryption (Local Vault)</h2>
        <p>
          eStories offers an optional Local Vault feature that encrypts your
          stories on your device before they are stored:
        </p>
        <ul>
          <li>
            Encryption uses <strong>AES-256-GCM</strong> with keys derived from
            your PIN via <strong>PBKDF2</strong> (100,000 iterations).
          </li>
          <li>
            Your Data Encryption Key (DEK) is held in memory only while the
            vault is unlocked and is wiped on sign-out.
          </li>
          <li>
            We cannot access vault-encrypted content. If you lose your PIN, the
            encrypted data cannot be recovered.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. AI Processing</h2>
        <p>
          Story content you submit for analysis is processed by third-party AI
          services (Google Gemini, ElevenLabs) to provide transcription,
          enhancement, and narrative insights. AI-generated analysis may also be
          processed through Chainlink&apos;s Compute Runtime Environment (CRE)
          for verifiable, privacy-preserving attestation.
        </p>
        <p>
          We do not use your story content to train AI models. Content is
          processed on-demand and not retained by AI providers beyond the
          duration of the request.
        </p>
      </section>

      <section>
        <h2>6. Data Sharing</h2>
        <p>We do not sell your personal information. We share data only with:</p>
        <ul>
          <li>
            <strong>Service Providers:</strong> Supabase (database and auth),
            Vercel (hosting), Pinata (IPFS storage), Resend (email), ElevenLabs
            (transcription), Google (AI analysis).
          </li>
          <li>
            <strong>Blockchain Networks:</strong> On-chain transactions and
            minted NFTs are publicly visible on the Base network.
          </li>
          <li>
            <strong>Legal Requirements:</strong> When required by law,
            regulation, or valid legal process.
          </li>
        </ul>
      </section>

      <section>
        <h2>7. Data Retention</h2>
        <ul>
          <li>
            <strong>Account data:</strong> Retained while your account is
            active. You can request deletion at any time from your profile
            settings.
          </li>
          <li>
            <strong>Stories:</strong> Retained until you delete them. Private
            stories are only accessible to you.
          </li>
          <li>
            <strong>On-chain data:</strong> Blockchain transactions and minted
            NFTs are permanent and cannot be deleted.
          </li>
          <li>
            <strong>Vault data:</strong> Encrypted data in your browser&apos;s
            IndexedDB persists until you clear it or delete your account.
          </li>
        </ul>
      </section>

      <section>
        <h2>8. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access your personal data</li>
          <li>Correct inaccurate data</li>
          <li>Delete your account and associated data</li>
          <li>Export your stories</li>
          <li>Opt out of non-essential communications</li>
        </ul>
        <p>
          To exercise these rights, use the settings in your profile or contact
          us at{" "}
          <a href="mailto:privacy@estories.app">privacy@estories.app</a>.
        </p>
      </section>

      <section>
        <h2>9. Cookies &amp; Tracking Technologies</h2>
        <p>
          We use cookies and similar tracking technologies to enhance your
          experience and for marketing purposes:
        </p>
        <ul>
          <li>
            <strong>Essential cookies:</strong> Required for the platform to
            function (authentication, security, preferences). These cannot be
            disabled.
          </li>
          <li>
            <strong>Analytics cookies:</strong> Help us understand how visitors
            interact with the site (Vercel Analytics).
          </li>
          <li>
            <strong>Marketing cookies (Meta Pixel):</strong> Used to track
            conversions, build audiences, and run retargeting campaigns on
            Facebook and Instagram. This Pixel is only activated if you consent
            to marketing cookies via our cookie banner.
          </li>
        </ul>
        <p>
          You can manage your cookie preferences at any time by clearing your
          browser cache or contacting us. For EU/UK visitors, marketing trackers
          are blocked until explicit consent is given.
        </p>
        <h3>Opting Out of Meta Pixel Tracking</h3>
        <p>
          If you have consented to marketing cookies and wish to opt out:
        </p>
        <ul>
          <li>
            Use our cookie banner to select &quot;Essential Only&quot; — this
            immediately stops the Meta Pixel from firing.
          </li>
          <li>
            Visit Meta&apos;s{" "}
            <a
              href="https://www.facebook.com/settings/?tab=ads"
              target="_blank"
              rel="noopener noreferrer"
            >
              Ad Preferences
            </a>{" "}
            to manage how Meta uses your data for ads.
          </li>
          <li>
            Install the{" "}
            <a
              href="https://www.facebook.com/help/1762961890779520"
              target="_blank"
              rel="noopener noreferrer"
            >
              Meta Pixel Opt-Out add-on
            </a>{" "}
            for your browser.
          </li>
        </ul>
      </section>

      <section>
        <h2>10. Security</h2>
        <p>
          We implement industry-standard security measures including encrypted
          connections (TLS), rate limiting, authentication tokens, input
          validation, and Content Security Policy headers. API routes are
          protected with Bearer token authentication and ownership verification.
        </p>
      </section>

      <section>
        <h2>11. Children&apos;s Privacy</h2>
        <p>
          eStories is not intended for children under 13. We do not knowingly
          collect personal information from children under 13. If we learn we
          have collected such information, we will delete it promptly.
        </p>
      </section>

      <section>
        <h2>12. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify
          you of material changes by posting the new policy on this page and
          updating the &quot;Last updated&quot; date.
        </p>
      </section>

      <section>
        <h2>13. Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy, contact us at{" "}
          <a href="mailto:privacy@estories.app">privacy@estories.app</a>.
        </p>
      </section>
    </article>
  );
}
