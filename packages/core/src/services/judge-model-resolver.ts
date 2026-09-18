import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';

/**
 * Picks a concrete @langchain/core BaseChatModel from whichever provider
 * credentials are available in the environment. DocumentationJudge (Task 26)
 * and the rest of the domain only ever depend on BaseChatModel — adding a
 * second provider means adding a branch here, never touching the judge.
 */
export function resolveJudgeModel(): BaseChatModel {
  if (process.env.ANTHROPIC_API_KEY) {
    return new ChatAnthropic({ model: 'claude-sonnet-5', temperature: 0 });
  }
  if (process.env.OPENAI_API_KEY) {
    return new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      temperature: 0,
      configuration: process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : undefined,
    });
  }
  throw new Error(
    'No LLM provider configured for the documentation judge: set ANTHROPIC_API_KEY or OPENAI_API_KEY, or extend resolveJudgeModel() with another @langchain/core BaseChatModel provider.',
  );
}
