import { describe, expect, it } from 'vitest';
import { buildProgram } from './cli.js';

describe('sentinel CLI', () => {
  it('reports the core version', () => {
    expect(buildProgram().version()).toBe('0.1.0');
  });

  it('is named sentinel', () => {
    expect(buildProgram().name()).toBe('sentinel');
  });
});
