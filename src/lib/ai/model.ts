import { anthropic } from "@ai-sdk/anthropic";

export function getModel() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set. Add it to .env.");
  return anthropic(process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5");
}
