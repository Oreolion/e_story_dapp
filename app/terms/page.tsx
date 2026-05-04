import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "eStories terms of service. Understand your rights and responsibilities when using the eStories platform.",
  robots: { index: true, follow: true },
};

export default function TermsOfServicePage() {
  return (
    <article className="prose prose-gray dark:prose-invert max-w-3xl mx-auto py-8">
      <h1>Terms of Service</h1>
      <p className="text-sm text-muted-foreground">
        Last updated: March 23, 2026
      </p>

      <section>
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using the eStories platform at{" "}
          <a href="https://estories.app">estories.app</a> (&quot;the
          Service&quot;), you agree to be bound by these Terms of Service
          (&quot;Terms&quot;). If you do not agree, do not use the Service.
        </p>
      </section>

      <section>
        <h2>2. Description of Service</h2>
        <p>
          eStories is a Web3 AI-powered storytelling platform that enables users
          to record, write, and preserve stories with AI-powered analysis,
          client-side encryption, and optional blockchain permanence on the Base
          network. The platform supports personal journals, historical
          narratives, geopolitical analysis, cultural tales, and creative
          non-fiction.
        </p>
      </section>

      <section>
        <h2>3. Eligibility</h2>
        <p>
          You must be at least 13 years old to use eStories. By using the
          Service, you represent that you meet this age requirement.
        </p>
      </section>

      <section>
        <h2>4. Accounts</h2>
        <ul>
          <li>
            You may sign in using a Web3 wallet (e.g., MetaMask) or Google
            OAuth.
          </li>
          <li>
            You are responsible for maintaining the security of your wallet
            private keys and account credentials.
          </li>
          <li>
            You are responsible for all activity under your account.
          </li>
          <li>
            You must not create multiple accounts to circumvent rate limits or
            platform rules.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. User Content</h2>
        <h3>5.1 Ownership</h3>
        <p>
          You retain ownership of all content you create on eStories, including
          stories, recordings, and associated metadata. By posting content
          publicly, you grant eStories a non-exclusive, worldwide license to
          display and distribute that content on the platform.
        </p>

        <h3>5.2 Prohibited Content</h3>
        <p>You must not post content that:</p>
        <ul>
          <li>Infringes on intellectual property rights of others</li>
          <li>Contains illegal material or promotes illegal activities</li>
          <li>Constitutes harassment, hate speech, or threats</li>
          <li>Contains malware, spam, or deceptive content</li>
          <li>Violates the privacy of others without consent</li>
        </ul>

        <h3>5.3 Content Removal</h3>
        <p>
          We reserve the right to remove content that violates these Terms.
          Content that has been minted as an NFT on the blockchain cannot be
          removed from the blockchain itself, though it may be delisted from the
          platform.
        </p>
      </section>

      <section>
        <h2>6. Blockchain & Digital Assets</h2>
        <ul>
          <li>
            The Service currently operates on the{" "}
            <strong>Base Sepolia testnet</strong>. Testnet tokens have no
            monetary value.
          </li>
          <li>
            Blockchain transactions are irreversible. We cannot reverse, cancel,
            or refund transactions once confirmed on-chain.
          </li>
          <li>
            You are solely responsible for your wallet security. We do not
            custody your private keys.
          </li>
          <li>
            NFT minting, tipping, and paywall features involve smart contract
            interactions. You should understand the implications before
            transacting.
          </li>
        </ul>
      </section>

      <section>
        <h2>7. AI Services</h2>
        <p>
          eStories uses third-party AI services for transcription (ElevenLabs),
          text enhancement, and narrative analysis (Google Gemini). AI-generated
          content is provided as-is and may contain inaccuracies. You should
          review all AI output before publishing.
        </p>
        <p>
          Verifiable AI metrics are processed through Chainlink CRE and attested
          on-chain. These attestations represent the AI&apos;s analysis at a
          point in time and should not be interpreted as editorial endorsement.
        </p>
      </section>

      <section>
        <h2>8. Local Vault & Encryption</h2>
        <p>
          The Local Vault feature encrypts data on your device using a PIN you
          choose. <strong>We cannot recover your data if you lose your PIN.</strong>{" "}
          You are solely responsible for remembering your vault PIN and
          maintaining backups of critical content.
        </p>
      </section>

      <section>
        <h2>9. Fees & Payments</h2>
        <p>
          Core features of eStories are free. Premium features may require
          payment. Blockchain transactions may incur gas fees payable to the
          network, not to eStories. We will clearly disclose any fees before you
          incur them.
        </p>
      </section>

      <section>
        <h2>10. Termination</h2>
        <p>
          You may delete your account at any time from your profile settings.
          Upon deletion:
        </p>
        <ul>
          <li>Your stories, profile, and platform data will be permanently deleted</li>
          <li>On-chain data (NFTs, transactions, verified metrics) will persist on the blockchain</li>
          <li>Vault-encrypted data in your browser will remain until you clear it</li>
        </ul>
        <p>
          We may suspend or terminate accounts that violate these Terms.
        </p>
      </section>

      <section>
        <h2>11. Disclaimers</h2>
        <p>
          The Service is provided &quot;as is&quot; and &quot;as available&quot;
          without warranties of any kind. We do not guarantee uninterrupted
          access, data preservation (beyond our reasonable efforts), or accuracy
          of AI-generated content.
        </p>
      </section>

      <section>
        <h2>12. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, eStories shall not be liable
          for indirect, incidental, special, consequential, or punitive damages
          arising from your use of the Service, including but not limited to
          loss of data, loss of digital assets, or unauthorized access to your
          account.
        </p>
      </section>

      <section>
        <h2>13. Changes to Terms</h2>
        <p>
          We may modify these Terms at any time. We will notify users of
          material changes by updating the &quot;Last updated&quot; date and, where
          appropriate, providing notice through the platform. Continued use
          after changes constitutes acceptance.
        </p>
      </section>

      <section>
        <h2>14. Contact</h2>
        <p>
          For questions about these Terms, contact us at{" "}
          <a href="mailto:legal@estories.app">legal@estories.app</a>.
        </p>
      </section>
    </article>
  );
}
