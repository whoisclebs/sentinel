import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveJudgeModel } from './judge-model-resolver.js';

describe('resolveJudgeModel', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns a ChatAnthropic instance when ANTHROPIC_API_KEY is set', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-fake-dummy-key');
    vi.stubEnv('OPENAI_API_KEY', '');

    const model = resolveJudgeModel();

    expect(model.constructor.name).toBe('ChatAnthropic');
  });

  it('returns a ChatOpenAI instance when only OPENAI_API_KEY is set', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('OPENAI_API_KEY', 'sk-fake-dummy-key');
    vi.stubEnv('OPENAI_MODEL', 'fake-model-name');
    vi.stubEnv('OPENAI_BASE_URL', 'https://fake-openai-compatible.example.com/v1');

    const model = resolveJudgeModel();

    expect(model.constructor.name).toBe('ChatOpenAI');
  });

  it('throws when neither ANTHROPIC_API_KEY nor OPENAI_API_KEY is set', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('OPENAI_API_KEY', '');

    expect(() => resolveJudgeModel()).toThrow(/No LLM provider configured/);
  });
});
