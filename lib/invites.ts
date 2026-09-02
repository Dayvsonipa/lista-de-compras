import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createInviteCode() {
  return Array.from({ length: 8 }, () => ALPHABET[randomInt(0, ALPHABET.length)]).join("");
}
