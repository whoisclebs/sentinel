import { ENV_KEY_RE, PROPERTIES_KEY_RE, YAML_KEY_RE } from '../detectors/environment-detector.js';

const REDACTED_VALUE = '***REDACTED***';

/**
 * Masks the *value* portion of config key/value lines (YAML, .env, .properties style),
 * mirroring the key patterns the environment detector itself uses to identify config
 * keys. Lines that don't look like a key/value pair (SQL, code, markdown, diff headers,
 * ...) pass through unchanged.
 *
 * Each line may optionally carry a single leading unified-diff marker ('+', '-', or a
 * literal space), as produced by `buildDiffExcerpt` in the audit graph; the marker is
 * preserved verbatim around the redaction.
 */
export function redactConfigValues(text: string): string {
  return text
    .split('\n')
    .map((line) => redactLine(line))
    .join('\n');
}

function redactLine(rawLine: string): string {
  const hasDiffMarker = rawLine.length > 0 && '+- '.includes(rawLine[0]!);
  const diffPrefix = hasDiffMarker ? rawLine[0]! : '';
  const line = hasDiffMarker ? rawLine.slice(1) : rawLine;

  const colonMatch = YAML_KEY_RE.exec(line);
  if (colonMatch) {
    return diffPrefix + redactAfter(line, line.indexOf(':') + 1);
  }
  const equalsMatch = ENV_KEY_RE.exec(line) ?? PROPERTIES_KEY_RE.exec(line);
  if (equalsMatch) {
    return diffPrefix + redactAfter(line, line.indexOf('=') + 1);
  }
  return rawLine;
}

function redactAfter(line: string, separatorIndex: number): string {
  const before = line.slice(0, separatorIndex);
  const after = line.slice(separatorIndex);
  const leadingWhitespace = /^\s*/.exec(after)![0];
  const value = after.slice(leadingWhitespace.length);
  if (!value) return line;
  return `${before}${leadingWhitespace}${REDACTED_VALUE}`;
}
