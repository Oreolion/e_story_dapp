import { describe, expect, it, vi } from "vitest";
import {
  interviewRequest,
  interviewQuestion,
  interviewText,
  appendInterviewTurns,
  STARTER_QUESTION,
} from "@/lib/story/interview";
import { runInterviewQuestion } from "@/lib/ai/interview";

const turns = [
  { question: STARTER_QUESTION, answer: "I took the train home." },
];
describe("guided interview contracts", () => {
  it("recovers missing answers without duplicating existing blocks or replacing author edits", () => {
    const second = {
      question: "What happened next?",
      answer: "I watched the sun set.",
    };
    const existing = `My own introduction.\n\n${interviewText(turns)}\n\nMy own closing paragraph.`;
    expect(appendInterviewTurns(existing, [...turns, second])).toBe(
      `${existing}\n\n${interviewText([second])}`,
    );
    expect(appendInterviewTurns("", turns)).toBe(interviewText(turns));
  });
  it("accepts bounded author answers and rejects authority-bearing fields", () => {
    expect(
      interviewRequest.safeParse({ topic: "A journey", turns }).success,
    ).toBe(true);
    for (const body of [
      null,
      { turns: [] },
      { turns, userId: "other" },
      { turns: [...turns, ...Array(6).fill(turns[0])] },
      { turns: [{ ...turns[0], answer: "a".repeat(1501) }] },
    ]) {
      expect(interviewRequest.safeParse(body).success).toBe(false);
    }
  });
  it.each([
    "Two questions? Really?",
    "A statement.",
    "?",
    "x".repeat(241) + "?",
  ])("rejects malformed questions: %s", (question) => {
    expect(interviewQuestion.safeParse({ question }).success).toBe(false);
  });
  it("makes exactly one graph generation, with no repair call", async () => {
    const generate = vi
      .fn()
      .mockResolvedValue('{"question":"What did you notice from the train?"}');
    expect(
      await runInterviewQuestion({ topic: "Journey", turns }, generate),
    ).toEqual({ question: "What did you notice from the train?" });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate.mock.calls[0][0]).toContain(
      JSON.stringify({ topic: "Journey", turns }),
    );
  });
  it("fails closed on repeated or extra-field model output", async () => {
    for (const output of [
      JSON.stringify({ question: STARTER_QUESTION }),
      '{"question":"Where did you go?","tool":"publish"}',
      "not json",
    ]) {
      const generate = vi.fn().mockResolvedValue(output);
      await expect(runInterviewQuestion({ turns }, generate)).rejects.toThrow();
      expect(generate).toHaveBeenCalledTimes(1);
    }
  });
  it("assembles only reviewed questions and author answers without inventing a narrative", () => {
    expect(interviewText(turns)).toBe(
      `${STARTER_QUESTION}\nI took the train home.`,
    );
  });
});
