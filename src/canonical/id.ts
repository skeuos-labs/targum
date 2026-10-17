import { randomUUID as cryptoRandomUUID } from 'node:crypto';

export function randomUUID(): string {
  return cryptoRandomUUID();
}
