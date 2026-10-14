import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Delete Your eStories Account",
  description: "Request deletion of your eStories account and associated off-chain data.",
  robots: { index: true, follow: true },
};

export default function AccountDeletionPage() {
  return (
    <article className="prose prose-gray dark:prose-invert max-w-3xl mx-auto py-8">
      <h1>Delete Your eStories Account</h1>
      <p className="text-sm text-muted-foreground">Last updated: July 31, 2026</p>

      <p>
        You can permanently delete your eStories account from either the mobile app or the
        website. Deletion removes your profile and associated off-chain data.
      </p>

      <section>
        <h2>Delete from the mobile app</h2>
        <ol>
          <li>Sign in to eStories.</li>
          <li>Open the Profile tab.</li>
          <li>Select <strong>Delete Account</strong>.</li>
          <li>Review the disclosure and confirm deletion.</li>
        </ol>
      </section>

      <section>
        <h2>Delete from the website</h2>
        <p>
          Sign in and open your <Link href="/profile">profile settings</Link>. In the Danger
          Zone, choose <strong>Delete Account</strong> and type DELETE to confirm.
        </p>
      </section>

      <section>
        <h2>Request deletion by email</h2>
        <p>
          If you cannot access your account, email{" "}
          <a href="mailto:privacy@estories.app?subject=eStories%20account%20deletion%20request">
            privacy@estories.app
          </a>{" "}
          from the address associated with your account. We may ask you to verify ownership
          before processing the request.
        </p>
      </section>

      <section>
        <h2>Data that is deleted</h2>
        <ul>
          <li>Your eStories profile and sign-in identity.</li>
          <li>Stories, private audio, comments, likes, follows, collections, and saved items.</li>
          <li>Habits, reflections, notifications, subscription records, and safety relationships.</li>
        </ul>
        <p>
          Public blockchain records, including completed transactions or attestations, cannot be
          altered or deleted by eStories. Records required for fraud prevention, legal compliance,
          or dispute resolution may be retained only where legally required.
        </p>
      </section>
    </article>
  );
}
