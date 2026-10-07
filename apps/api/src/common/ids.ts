import { createHash, randomInt } from 'node:crypto';

const ROOM_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'; // no 0/o/1/l lookalikes

/** Short, URL-friendly, unguessable-enough room id (32^10 ≈ 1.1e15). */
export function generateRoomId(length = 10): string {
  let id = '';
  for (let i = 0; i < length; i++) id += ROOM_ALPHABET[randomInt(ROOM_ALPHABET.length)];
  return id;
}

/** Guest tokens are secrets, so only their hash is persisted. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
