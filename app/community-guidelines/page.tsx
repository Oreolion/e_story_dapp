import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "eStories Community Guidelines",
  description: "Rules and safety standards for stories, comments, and profiles on eStories.",
  robots: { index: true, follow: true },
};

export default function CommunityGuidelinesPage() {
  return (
    <article className="prose prose-gray dark:prose-invert max-w-3xl mx-auto py-8">
      <h1>Community Guidelines</h1>
      <p className="text-sm text-muted-foreground">Effective July 31, 2026</p>

      <p>
        eStories is a place for personal stories, history, culture, journals, and creative
        non-fiction. Everyone using public stories, profiles, or comments must follow these rules.
      </p>

      <section>
        <h2>Content we do not allow</h2>
        <ul>
          <li>Threats, harassment, bullying, stalking, or targeted abuse.</li>
          <li>Hateful content or attacks based on protected characteristics.</li>
          <li>Sexual exploitation, non-consensual sexual content, or any sexual content involving minors.</li>
          <li>Graphic violence, credible threats, or encouragement of self-harm.</li>
          <li>Spam, scams, impersonation, malicious links, or coordinated manipulation.</li>
          <li>Private information shared without permission or content that violates another person&apos;s rights.</li>
          <li>Illegal content or content primarily intended to facilitate illegal activity.</li>
        </ul>
      </section>

      <section>
        <h2>Reporting and blocking</h2>
        <p>
          Signed-in users can report a story, comment, or account and can block another user from
          the story or community feed. Blocking removes following relationships and hides content
          between the two accounts. For urgent concerns, contact{" "}
          <a href="mailto:support@estories.app">support@estories.app</a>.
        </p>
      </section>

      <section>
        <h2>How we enforce these rules</h2>
        <p>
          Reports enter a moderation queue for review. Depending on severity and history, eStories
          may limit distribution, remove content, restrict features, suspend an account, preserve
          evidence required for safety, or refer credible threats to appropriate authorities.
          Repeated or severe violations may result in permanent account removal.
        </p>
      </section>

      <section>
        <h2>Appeals</h2>
        <p>
          If you believe an enforcement decision was incorrect, email{" "}
          <a href="mailto:support@estories.app?subject=eStories%20moderation%20appeal">
            support@estories.app
          </a>{" "}
          with your account information and a concise explanation.
        </p>
      </section>
    </article>
  );
}
