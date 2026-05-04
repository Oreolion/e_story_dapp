import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Tailwind,
  Hr,
} from "@react-email/components";
import * as React from "react";
import EmailFooter from "./EmailFooter";

interface ReEngagementEmailProps {
  username: string;
  daysSinceLastStory: number;
  unsubscribeUrl?: string;
}

export const ReEngagementEmail = ({
  username,
  daysSinceLastStory,
  unsubscribeUrl,
}: ReEngagementEmailProps) => {
  const getContent = () => {
    // Day 3 equivalent — new user, haven't recorded yet
    if (daysSinceLastStory < 7) {
      return {
        preview: `${username}, your brain is interesting — let's capture it`,
        headline: `Your brain is interesting`,
        subheadline: `Let's capture it`,
        body: (
          <>
            <Text className="text-black text-[15px] leading-[26px]">
              You signed up for eStories a few days ago but haven't recorded yet.
            </Text>
            <Text className="text-black text-[15px] leading-[26px]">
              I get it. New apps are easy to forget.
            </Text>
            <Text className="text-black text-[15px] leading-[26px]">
              But here's the thing: you're already talking to yourself.
            </Text>
            <Text className="text-black text-[15px] leading-[26px]">
              In the shower. On your commute. At 2am when you can't sleep.
            </Text>
            <Text className="text-black text-[15px] leading-[26px]">
              Those thoughts disappear forever. Unless you capture them.
            </Text>
            <Section className="bg-amber-50 rounded-lg p-[20px] my-[24px]">
              <Text className="text-black text-[15px] leading-[26px] m-0 font-medium">
                Here's a challenge: record ONE story today.
              </Text>
              <Text className="text-gray-700 text-[14px] leading-[22px] m-0 mt-[8px]">
                Open the app. Hit record. Talk for 60 seconds. About anything:
              </Text>
              <Text className="text-gray-700 text-[14px] leading-[22px] m-0 mt-[8px]">
                • What's on your mind right now<br />
                • Something that happened today<br />
                • A decision you're weighing<br />
                • A memory that surfaced
              </Text>
            </Section>
            <Text className="text-black text-[15px] leading-[26px]">
              No structure. No rules. Just capture.
            </Text>
            <Text className="text-black text-[15px] leading-[26px]">
              Your future self will thank you.
            </Text>
          </>
        ),
        cta: "Record One Story",
      };
    }

    // Day 7 equivalent — engaged users, pattern insights
    if (daysSinceLastStory < 14) {
      return {
        preview: `What patterns are hiding in your thoughts, ${username}?`,
        headline: `What patterns are hiding`,
        subheadline: `in your thoughts?`,
        body: (
          <>
            <Text className="text-black text-[15px] leading-[26px]">
              Week one ✓
            </Text>
            <Text className="text-black text-[15px] leading-[26px]">
              If you've recorded a few stories, something interesting is happening.
            </Text>
            <Text className="text-black text-[15px] leading-[26px]">
              The AI is starting to see patterns.
            </Text>
            <Section className="bg-gray-50 rounded-lg p-[20px] my-[24px]">
              <Text className="text-gray-700 text-[14px] leading-[22px] m-0">
                Themes that recur. Emotions that cluster. People you mention.
              </Text>
              <Text className="text-gray-700 text-[14px] leading-[22px] m-0 mt-[8px]">
                After 10+ entries, you'll unlock your pattern dashboard.
              </Text>
            </Section>
            <Text className="text-black text-[15px] leading-[26px]">
              It's like having a therapist review your stories and say:
              <em> "Here's what I'm noticing..."</em>
            </Text>
            <Text className="text-black text-[15px] leading-[26px]">
              Except it's AI. And it's instant. And it's private.
            </Text>
            <Text className="text-black text-[15px] leading-[26px]">
              The more you record, the clearer the picture.
            </Text>
            <Text className="text-black text-[15px] leading-[26px]">
              Your patterns are waiting to be seen.
            </Text>
          </>
        ),
        cta: "Record Your Next Story",
      };
    }

    // 2 weeks — gentle nudge
    if (daysSinceLastStory < 30) {
      return {
        preview: `Two weeks without a story, ${username}?`,
        headline: `Two weeks without a story?`,
        subheadline: ``,
        body: (
          <>
            <Text className="text-black text-[15px] leading-[26px]">
              Your future self will thank you for writing today.
            </Text>
            <Text className="text-black text-[15px] leading-[26px]">
              Even a quick reflection counts. A 2-minute voice note can capture
              what you're thinking right now before it fades.
            </Text>
            <Text className="text-gray-600 text-[14px] leading-[24px]">
              The best stories aren't planned. They're the ones you capture
              in the moment — raw, honest, unfiltered.
            </Text>
          </>
        ),
        cta: "Write a Story",
      };
    }

    // 30+ days — stronger re-engagement
    return {
      preview: `Your stories are waiting for you, ${username}`,
      headline: `Your stories are waiting`,
      subheadline: `for you`,
      body: (
        <>
          <Text className="text-black text-[15px] leading-[26px]">
            It's been a while since your last story.
          </Text>
          <Text className="text-black text-[15px] leading-[26px]">
            The world is moving fast — your perspective matters.
          </Text>
          <Text className="text-black text-[15px] leading-[26px]">
            Come back and capture what's on your mind.
          </Text>
          <Text className="text-gray-600 text-[14px] leading-[24px]">
            Every story you record is a time capsule. Your future self will
            thank you for preserving these moments.
          </Text>
        </>
      ),
      cta: "Capture What's On Your Mind",
    };
  };

  const content = getContent();

  return (
    <Html>
      <Head />
      <Preview>{content.preview}</Preview>
      <Tailwind>
        <Body className="bg-gray-50 my-auto mx-auto font-sans">
          <Container className="bg-white border border-solid border-[#eaeaea] rounded-lg my-[40px] mx-auto p-[24px] max-w-[480px]">
            <Section className="mt-[24px] text-center">
              <Heading className="text-black text-[24px] font-bold text-center p-0 my-[20px] mx-0 tracking-tight">
                {content.headline}
                {content.subheadline && (
                  <>
                    <br />
                    <span className="text-amber-600">{content.subheadline}</span>
                  </>
                )}
              </Heading>
            </Section>

            <Hr className="border-gray-100 my-[24px]" />

            <Text className="text-black text-[15px] leading-[26px]">
              Hey {username},
            </Text>

            {content.body}

            <Section className="text-center mt-[32px] mb-[32px]">
              <Button
                className="bg-amber-600 rounded-lg text-white text-[14px] font-semibold no-underline text-center px-8 py-4 shadow-sm"
                href="https://estories.app/record"
              >
                {content.cta}
              </Button>
            </Section>

            <Text className="text-gray-500 text-[13px] leading-[20px] mt-[16px]">
              P.S. Hit reply and tell me: what's one thing you've noticed
              about yourself from your entries so far?
            </Text>

            <Text className="text-[#666666] text-[12px] leading-[24px] mt-[24px]">
              You can turn off these reminders in your{" "}
              <a href="https://estories.app/profile" className="text-amber-600">
                profile settings
              </a>
              .
            </Text>

            <EmailFooter unsubscribeUrl={unsubscribeUrl} />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default ReEngagementEmail;
