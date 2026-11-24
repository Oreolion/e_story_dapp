import { z } from "zod";

// Shared, browser-safe contracts. Never import provider or graph code into the UI.
export const MAX_INTERVIEW_TURNS = 6;
export const MAX_ANSWER_LENGTH = 1500;
export const STARTER_QUESTION =
  "What moment would you like to tell a story about?";
const questionText = z
  .string()
  .trim()
  .min(4)
  .max(240)
  .refine(
    (value) => value.endsWith("?") && (value.match(/\?/g) ?? []).length === 1,
  );
export const interviewTurn = z
  .object({
    question: questionText,
    answer: z.string().trim().min(1).max(MAX_ANSWER_LENGTH),
  })
  .strict();
export const interviewRequest = z
  .object({
    topic: z.string().trim().max(200).default(""),
    turns: z
      .array(interviewTurn)
      .min(1)
      .max(MAX_INTERVIEW_TURNS - 1),
  })
  .strict();
export const interviewQuestion = z.object({ question: questionText }).strict();
export type InterviewTurn = z.infer<typeof interviewTurn>;
export type InterviewRequest = z.input<typeof interviewRequest>;
export const interviewText = (turns: InterviewTurn[]) =>
  turns.map((turn) => `${turn.question}\n${turn.answer}`).join("\n\n");

// Used during recovery as well as normal additions. Keep author edits and skip
// exact answer blocks that have already reached the editor.
export function appendInterviewTurns(existing: string, turns: InterviewTurn[]) {
  return turns.reduce((text, turn) => {
    const block = interviewText([turn]);
    return text.includes(block)
      ? text
      : [text, block].filter(Boolean).join("\n\n");
  }, existing);
}
