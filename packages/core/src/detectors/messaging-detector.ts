import type { Finding } from '../domain/finding.js';
import type { DiffFile } from '../domain/repository.js';
import { addedLines } from '../infrastructure/diff-parser.js';
import type { ChangeDetector, DetectorContext } from './types.js';

const MESSAGING_PATTERNS: Array<{ subject: string; pattern: RegExp }> = [
  { subject: 'Kafka topic', pattern: /@KafkaListener|KafkaTemplate|new\s+Topic\(|kafka_topic/i },
  { subject: 'Kafka consumer/producer config', pattern: /bootstrap\.servers|ConsumerConfig|ProducerConfig/i },
  { subject: 'queue consumer/producer', pattern: /@RabbitListener|amqp:\/\/|declareQueue|aws_sqs_queue/i },
];

export class MessagingDetector implements ChangeDetector {
  readonly category = 'messaging' as const;

  detect(diffFiles: DiffFile[], context: DetectorContext): Finding[] {
    const findings: Finding[] = [];
    for (const file of diffFiles) {
      for (const line of addedLines(file)) {
        for (const { subject, pattern } of MESSAGING_PATTERNS) {
          if (!pattern.test(line.content)) continue;
          findings.push({
            application: context.application,
            category: 'messaging',
            subject,
            operation: 'added',
            repositoryPath: context.repositoryPath,
            filePath: file.path,
            line: line.newLineNumber ?? undefined,
            evidence: `Messaging configuration (${subject}) detected in ${file.path}${line.newLineNumber ? `:${line.newLineNumber}` : ''}.`,
            confidence: 'medium',
          });
        }
      }
    }
    return findings;
  }
}
