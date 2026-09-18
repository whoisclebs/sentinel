import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import {
  DocumentationJudgementSchema,
  type DocumentationJudgement,
  type DocumentationJudgementInput,
} from '../domain/judgement.js';
import { buildJudgePrompt, JUDGE_SYSTEM_PROMPT } from './judge-prompt.js';

const MAX_ATTEMPTS = 3;
const MAX_ERROR_LENGTH = 200;
const URL_RE = /https?:\/\/\S+/g;

function sanitizeErrorText(text: string): string {
  const withoutUrls = text.replace(URL_RE, '[url removed]');
  return withoutUrls.length > MAX_ERROR_LENGTH ? `${withoutUrls.slice(0, MAX_ERROR_LENGTH)}...` : withoutUrls;
}

function inconclusive(rationale: string): DocumentationJudgement {
  return {
    verdict: 'inconclusive',
    confidence: 'low',
    rationale,
    citedEvidence: [],
    requiredDocumentation: [],
  };
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed);
  return JSON.parse(fenced ? fenced[1]! : trimmed);
}

export class DocumentationJudge {
  constructor(private readonly model: BaseChatModel) {}

  async judge(input: DocumentationJudgementInput): Promise<DocumentationJudgement> {
    if (input.releaseDocumentCandidates.length === 0 && input.relatedCodeAndKnowledge.length === 0) {
      return inconclusive('No release document or code/knowledge-base context was retrieved for this finding.');
    }

    const prompt = buildJudgePrompt(input);
    let lastError = 'unknown error';

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await this.model.invoke([new SystemMessage(JUDGE_SYSTEM_PROMPT), new HumanMessage(prompt)]);
        const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        const parsed = DocumentationJudgementSchema.safeParse(extractJson(text));
        if (parsed.success) return parsed.data;
        lastError = `Invalid judge output: ${parsed.error.message}`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    return inconclusive(`Judge provider failed after ${MAX_ATTEMPTS} attempts: ${sanitizeErrorText(lastError)}`);
  }
}
