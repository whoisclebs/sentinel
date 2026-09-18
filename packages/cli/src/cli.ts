import { Command } from 'commander';
import { SENTINEL_CORE_VERSION } from '@sentinel/core';
import { registerAuditCommand } from './commands/audit-command.js';
import { registerIndexCommand } from './commands/index-command.js';
import { registerRagSearchCommand } from './commands/rag-search-command.js';

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('sentinel')
    .description('SENTINEL — Release Check for multi-repository applications')
    .version(SENTINEL_CORE_VERSION);

  registerAuditCommand(program);
  registerIndexCommand(program);
  registerRagSearchCommand(program);

  return program;
}

export function runCli(argv: string[]): void {
  buildProgram().parse(argv);
}
