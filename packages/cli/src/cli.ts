import { Command } from 'commander';
import { SENTINEL_CORE_VERSION } from '@sentinel/core';

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('sentinel')
    .description('SENTINEL — Release Check for multi-repository applications')
    .version(SENTINEL_CORE_VERSION);
  return program;
}

export function runCli(argv: string[]): void {
  buildProgram().parse(argv);
}
