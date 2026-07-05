import { createHash, randomInt } from "crypto";

export function generateInviteCode(): string {
  return String(randomInt(100000, 1000000));
}

export function hashInviteCode(code: string): string {
  return createHash("sha256").update(code.replace(/\s/g, "")).digest("hex");
}

export function createInvitationCode(): {
  code: string;
  codeHash: string;
} {
  const code = generateInviteCode();
  return { code, codeHash: hashInviteCode(code) };
}
