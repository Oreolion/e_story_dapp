import { Hr, Link, Section, Text } from "@react-email/components";
import * as React from "react";

interface EmailFooterProps {
  unsubscribeUrl?: string;
}

/**
 * Shared footer for all transactional / marketing email templates.
 * Includes the unsubscribe link (when provided) and the legal boilerplate
 * expected by Gmail / Apple Mail senders.
 */
export const EmailFooter = ({ unsubscribeUrl }: EmailFooterProps) => (
  <Section>
    <Hr className="border-gray-200 my-[24px]" />
    <Text className="text-gray-500 text-[12px] leading-[18px] text-center">
      EStories · Sovereign storytelling on Base L2
      <br />
      <Link
        href="https://estories.app"
        className="text-gray-500 underline"
      >
        estories.app
      </Link>
      {" · "}
      <Link
        href="https://estories.app/privacy"
        className="text-gray-500 underline"
      >
        Privacy
      </Link>
      {" · "}
      <Link
        href="https://estories.app/terms"
        className="text-gray-500 underline"
      >
        Terms
      </Link>
    </Text>
    {unsubscribeUrl && (
      <Text className="text-gray-500 text-[12px] leading-[18px] text-center mt-[8px]">
        Don&apos;t want these emails?{" "}
        <Link href={unsubscribeUrl} className="text-gray-500 underline">
          Unsubscribe
        </Link>
      </Text>
    )}
  </Section>
);

export default EmailFooter;
