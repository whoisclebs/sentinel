import type { Finding } from '../domain/finding.js';
import type { DiffFile } from '../domain/repository.js';
import { addedLines } from '../infrastructure/diff-parser.js';
import type { ChangeDetector, DetectorContext } from './types.js';

const AWS_PATTERNS: Array<{ subject: string; pattern: RegExp }> = [
  { subject: 'S3', pattern: /\b(S3Client|AmazonS3|s3:\/\/|aws_s3_bucket)\b/ },
  { subject: 'SQS', pattern: /\b(SqsClient|AmazonSQS|aws_sqs_queue)\b/ },
  { subject: 'SNS', pattern: /\b(SnsClient|AmazonSNS|aws_sns_topic)\b/ },
  { subject: 'Secrets Manager', pattern: /\b(SecretsManagerClient|secretsmanager)\b/i },
  { subject: 'Parameter Store', pattern: /\b(SsmClient|ssm:GetParameter|aws_ssm_parameter)\b/i },
  { subject: 'DynamoDB', pattern: /\b(DynamoDbClient|AmazonDynamoDB|aws_dynamodb_table)\b/ },
  { subject: 'ECR', pattern: /\b(ecr\.amazonaws|aws_ecr_repository)\b/i },
  { subject: 'IAM', pattern: /\b(iam:[A-Za-z]+|aws_iam_role|aws_iam_policy)\b/ },
];

export class AwsDetector implements ChangeDetector {
  readonly category = 'aws' as const;

  detect(diffFiles: DiffFile[], context: DetectorContext): Finding[] {
    const findings: Finding[] = [];
    for (const file of diffFiles) {
      for (const line of addedLines(file)) {
        for (const { subject, pattern } of AWS_PATTERNS) {
          if (!pattern.test(line.content)) continue;
          findings.push({
            application: context.application,
            category: 'aws',
            subject,
            operation: 'added',
            repositoryPath: context.repositoryPath,
            filePath: file.path,
            line: line.newLineNumber ?? undefined,
            evidence: `New reference to ${subject} detected in ${file.path}${line.newLineNumber ? `:${line.newLineNumber}` : ''} (provisioning not verified).`,
            confidence: 'medium',
          });
        }
      }
    }
    return findings;
  }
}
