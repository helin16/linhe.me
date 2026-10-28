import { randomInt } from 'node:crypto';
import { CODE_ALPHABET, CODE_LENGTH } from './protocol.ts';

/** A random room code that `taken` doesn't already use. */
export function newCode(taken: (code: string) => boolean, random: (max: number) => number = randomInt): string {
  for (let tries = 0; tries < 100; tries++) {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[random(CODE_ALPHABET.length)];
    if (!taken(code)) return code;
  }
  throw new Error('no free room code');
}
