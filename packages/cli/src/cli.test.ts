import { describe, expect, it } from 'vitest';
import { buildProgram } from './cli.js';

describe('sentinel CLI', () => {
  it('reports the core version', () => {
    expect(buildProgram().version()).toBe('0.1.0');
  });

  it('registers audit, index, and rag commands', () => {
    const names = buildProgram().commands.map((c) => c.name());
    expect(names).toEqual(expect.arrayContaining(['audit', 'index', 'rag']));
  });

  it('registers rag search as a subcommand of rag', () => {
    const ragCommand = buildProgram().commands.find((c) => c.name() === 'rag')!;
    expect(ragCommand.commands.map((c) => c.name())).toContain('search');
  });
});
