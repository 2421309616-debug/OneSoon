import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function onesoonEnvFile(): string {
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../.env'),
  ];
  const found = candidates.find((file) => existsSync(file));
  if (!found) {
    throw new Error('Cannot find the OneSoon .env file');
  }
  return found;
}
