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
        Last updated: March 23, 2026
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
        <h2>9. Security</h2>
        <p>
          We implement industry-standard security measures including encrypted
          connections (TLS), rate limiting, authentication tokens, input
          validation, and Content Security Policy headers. API routes are
          protected with Bearer token authentication and ownership verification.
        </p>
      </section>

      <section>
        <h2>10. Children&apos;s Privacy</h2>
        <p>
          eStories is not intended for children under 13. We do not knowingly
          collect personal information from children under 13. If we learn we
          have collected such information, we will delete it promptly.
        </p>
      </section>

      <section>
        <h2>11. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify
          you of material changes by posting the new policy on this page and
          updating the &quot;Last updated&quot; date.
        </p>
      </section>

      <section>
        <h2>12. Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy, contact us at{" "}
          <a href="mailto:privacy@estories.app">privacy@estories.app</a>.
        </p>
      </section>
    </article>
  );
}
