import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Tailwind,
} from "@react-email/components";
import * as React from "react";
import EmailFooter from "./EmailFooter";

interface WaitlistEmailProps {
  email: string;
  unsubscribeUrl?: string;
}

export const WaitlistEmail = ({ email, unsubscribeUrl }: WaitlistEmailProps) => {
  const previewText =
    "You're on the eStories waitlist — we'll let you know when the mobile app launches.";

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-gray-50 my-auto mx-auto font-sans">
          <Container className="bg-white border border-solid border-[#eaeaea] rounded-lg my-[40px] mx-auto p-[24px] max-w-[480px]">
            <Section className="mt-[24px] text-center">
              <Heading className="text-black text-[24px] font-bold text-center p-0 my-[20px] mx-0 tracking-tight">
                You're on the list, <span className="text-amber-600">{email}</span>
              </Heading>
              <Text className="text-gray-500 text-[14px] leading-[20px] mt-0">
                The mobile app is coming. You're first in line.
              </Text>
            </Section>

            <Hr className="border-gray-100 my-[24px]" />

            <Text className="text-black text-[15px] leading-[26px]">
              Thanks for signing up!
            </Text>

            <Text className="text-black text-[15px] leading-[26px]">
              eStories is the first decentralized voice storytelling platform —
              capture your stories with your voice, get AI-powered insights,
              and own your narratives on-chain.
            </Text>

            <Text className="text-black text-[15px] leading-[26px]">
              Whether it's personal journals, history, geopolitics, or cultural tales —
              your stories deserve to be heard.
            </Text>

            <Section className="bg-amber-50 rounded-lg p-[20px] my-[24px]">
              <Text className="text-black text-[14px] leading-[22px] m-0 font-medium">
                What to expect:
              </Text>
              <Text className="text-gray-700 text-[14px] leading-[22px] m-0 mt-[8px]">
                • Voice-first story recording<br />
                • AI transcription & theme analysis<br />
                • On-chain provenance & ownership<br />
                • Community collections & curation
              </Text>
            </Section>

            <Text className="text-black text-[15px] leading-[26px]">
              We'll notify you as soon as the mobile app is ready for download.
              In the meantime, you can start capturing stories on the web:
            </Text>

            <Section className="text-center mt-[32px] mb-[32px]">
              <Button
                className="bg-amber-600 rounded-lg text-white text-[14px] font-semibold no-underline text-center px-8 py-4 shadow-sm"
                href="https://estories.app"
              >
                Try eStories Web App
              </Button>
            </Section>

            <Text className="text-gray-500 text-[13px] leading-[20px]">
              P.S. Want early access to beta features? Follow us on{" "}
              <Link href="https://x.com/estoriesapp" className="text-amber-600">
                X
              </Link>{" "}
              for behind-the-scenes updates.
            </Text>

            <Hr className="border-gray-100 my-[24px]" />

            <Text className="text-[#666666] text-[12px] leading-[24px]">
              You received this email because {email} was signed up for the
              eStories waitlist. If this wasn't you, you can safely ignore
              this email.
            </Text>
            <EmailFooter unsubscribeUrl={unsubscribeUrl} />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default WaitlistEmail;
