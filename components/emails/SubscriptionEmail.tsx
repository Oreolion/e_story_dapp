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

interface SubscriptionEmailProps {
  username: string;
  plan: string;
  expiresAt: string;
  unsubscribeUrl?: string;
}

export const SubscriptionEmail = ({
  username,
  plan,
  expiresAt,
  unsubscribeUrl,
}: SubscriptionEmailProps) => {
  const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
  const previewText = `Your ${planName} subscription is now active — welcome to the next level`;

  const getPlanBenefits = () => {
    if (plan === "storyteller") {
      return [
        "Unlimited AI story analyses",
        "Actionable craft advice",
        "Story collections & organization",
        "Weekly reflection summaries",
        "Advanced theme tracking",
      ];
    }
    if (plan === "creator") {
      return [
        "Everything in Storyteller",
        "Unlimited public publishing",
        "Creator analytics dashboard",
        "Custom author profile",
        "Priority support",
        "Early access to new features",
      ];
    }
    return ["Full access to eStories features"];
  };

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-gray-50 my-auto mx-auto font-sans">
          <Container className="bg-white border border-solid border-[#eaeaea] rounded-lg my-[40px] mx-auto p-[24px] max-w-[480px]">
            {/* Celebration header */}
            <Section className="mt-[24px] text-center">
              <Text className="text-amber-600 text-[32px] leading-[32px] text-center m-0">
                ✦
              </Text>
              <Heading className="text-black text-[24px] font-bold text-center p-0 my-[16px] mx-0 tracking-tight">
                Your <span className="text-amber-600">{planName}</span> plan is active
              </Heading>
              <Text className="text-gray-500 text-[14px] leading-[20px] mt-0">
                Welcome to the next level of storytelling
              </Text>
            </Section>

            <Hr className="border-gray-100 my-[24px]" />

            <Text className="text-black text-[15px] leading-[26px]">
              Hey {username},
            </Text>

            <Text className="text-black text-[15px] leading-[26px]">
              Your payment is confirmed and your {planName} subscription is now active.
              Thank you for supporting eStories — you're helping us build the future
              of sovereign storytelling.
            </Text>

            {/* Plan details */}
            <Section className="bg-gray-50 rounded-lg p-[20px] my-[24px]">
              <Text className="text-black text-[14px] font-semibold leading-[20px] m-0 mb-[12px]">
                Plan details
              </Text>
              <Text className="text-gray-700 text-[14px] leading-[22px] m-0">
                <strong>Plan:</strong> {planName}
              </Text>
              <Text className="text-gray-700 text-[14px] leading-[22px] m-0">
                <strong>Valid until:</strong> {expiresAt}
              </Text>
            </Section>

            {/* Benefits */}
            <Text className="text-black text-[15px] leading-[26px] font-medium">
              Here's what you now have access to:
            </Text>

            <Section className="my-[16px]">
              {getPlanBenefits().map((benefit, index) => (
                <Text
                  key={index}
                  className="text-gray-700 text-[14px] leading-[24px] m-0 mb-[8px]"
                >
                  ✓ {benefit}
                </Text>
              ))}
            </Section>

            <Text className="text-black text-[15px] leading-[26px]">
              Your stories deserve the best tools. Let's put them to work.
            </Text>

            {/* CTA */}
            <Section className="text-center mt-[32px] mb-[32px]">
              <Button
                className="bg-amber-600 rounded-lg text-white text-[14px] font-semibold no-underline text-center px-8 py-4 shadow-sm"
                href="https://estories.app/record"
              >
                Start Writing
              </Button>
            </Section>

            <Text className="text-gray-600 text-[13px] leading-[20px]">
              If you have questions about your subscription, just reply to this email
              or visit your{" "}
              <a href="https://estories.app/profile" className="text-amber-600">
                profile settings
              </a>
              .
            </Text>

            <Text className="text-black text-[15px] leading-[26px] mt-[24px]">
              — The eStories Team
            </Text>

            <EmailFooter unsubscribeUrl={unsubscribeUrl} />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default SubscriptionEmail;
