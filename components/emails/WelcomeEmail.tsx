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

interface WelcomeEmailProps {
  username: string;
  unsubscribeUrl?: string;
}

export const WelcomeEmail = ({ username, unsubscribeUrl }: WelcomeEmailProps) => {
  const previewText = `Welcome to eStories, ${username} — let's record your first story`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-gray-50 my-auto mx-auto font-sans">
          <Container className="bg-white border border-solid border-[#eaeaea] rounded-lg my-[40px] mx-auto p-[24px] max-w-[480px]">
            {/* Header */}
            <Section className="mt-[24px] text-center">
              <Heading className="text-black text-[26px] font-bold text-center p-0 my-[20px] mx-0 tracking-tight">
                Welcome to <span className="text-amber-600">eStories</span>
              </Heading>
              <Text className="text-gray-500 text-[14px] leading-[20px] mt-0">
                The first decentralized voice storytelling platform
              </Text>
            </Section>

            <Hr className="border-gray-100 my-[24px]" />

            {/* Personal greeting */}
            <Text className="text-black text-[15px] leading-[26px]">
              Hey {username},
            </Text>

            <Text className="text-black text-[15px] leading-[26px]">
              You just joined eStories. Here's what to do next:
            </Text>

            {/* 3-step flow */}
            <Section className="bg-amber-50 rounded-lg p-[20px] my-[24px]">
              <Text className="text-black text-[15px] leading-[26px] m-0 font-medium">
                1. Open the app
              </Text>
              <Text className="text-black text-[15px] leading-[26px] m-0 font-medium">
                2. Hit the record button
              </Text>
              <Text className="text-black text-[15px] leading-[26px] m-0 font-medium">
                3. Speak for 60 seconds about anything
              </Text>
            </Section>

            <Text className="text-black text-[15px] leading-[26px]">
              That's it. Your first entry saved.
            </Text>

            <Text className="text-black text-[15px] leading-[26px]">
              <strong>No prompts. No pressure. Just talk.</strong>
            </Text>

            <Text className="text-gray-600 text-[14px] leading-[24px]">
              The AI will transcribe it, clean it up, and find the themes.
              You'll start seeing patterns after 5-10 entries.
            </Text>

            {/* CTA */}
            <Section className="text-center mt-[32px] mb-[32px]">
              <Button
                className="bg-amber-600 rounded-lg text-white text-[14px] font-semibold no-underline text-center px-8 py-4 shadow-sm"
                href="https://estories.app/record"
              >
                Record Your First Story
              </Button>
            </Section>

            {/* Tip */}
            <Section className="bg-gray-50 rounded-lg p-[16px] my-[20px]">
              <Text className="text-gray-700 text-[13px] leading-[22px] m-0 italic">
                One tip: don't overthink it. The best stories aren't polished.
                They're honest. Speak like you're talking to yourself
                (because you are).
              </Text>
            </Section>

            <Text className="text-black text-[15px] leading-[26px]">
              Questions? Just reply to this email.
            </Text>

            <Text className="text-black text-[15px] leading-[26px]">
              Welcome to your memory archive.
            </Text>

            <Text className="text-black text-[15px] leading-[26px] mt-[24px]">
              — The eStories Team
            </Text>

            {/* P.S. */}
            <Text className="text-gray-500 text-[13px] leading-[20px] mt-[24px]">
              <strong>P.S.</strong> Your first 10 story AI analyses are free.
              No credit card needed.
            </Text>

            <EmailFooter unsubscribeUrl={unsubscribeUrl} />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default WelcomeEmail;
