import { hash, hashRaw, verify } from '@node-rs/argon2';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ARGON2_OPTIONS = {
  algorithm: 2,
  timeCost: 3,
  memoryCost: 65536,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hashStr: string, password: string): Promise<boolean> {
  try {
    return await verify(hashStr, password);
  } catch {
    return false;
  }
}

export function generateKdfSalt(): Buffer {
  return randomBytes(16);
}

export async function deriveMasterKey(password: string, salt: Buffer): Promise<Buffer> {
  const out = await hashRaw(password, {
    ...ARGON2_OPTIONS,
    salt,
    outputLen: 32,
  });
  return Buffer.from(out);
}

export interface EncryptedCredential {
  nonce: Buffer;
  ciphertext: Buffer;
  authTag: Buffer;
}

export function encryptCredential(masterKey: Buffer, plaintext: string): EncryptedCredential {
  if (masterKey.length !== 32) {
    throw new Error(`masterKey must be 32 bytes, got ${masterKey.length}`);
  }
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', masterKey, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { nonce, ciphertext, authTag };
}

export function decryptCredential(
  masterKey: Buffer,
  nonce: Buffer,
  ciphertext: Buffer,
  authTag: Buffer,
): string {
  if (masterKey.length !== 32) {
    throw new Error(`masterKey must be 32 bytes, got ${masterKey.length}`);
  }
  const decipher = createDecipheriv('aes-256-gcm', masterKey, nonce);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}
