import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

let cachedKey: Buffer | null = null;

export function getServerMasterKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET env not set — cannot derive encryption key');
  }
  cachedKey = createHash('sha256').update(secret, 'utf8').digest();
  return cachedKey;
}

export interface EncryptedCredential {
  nonce: Buffer;
  ciphertext: Buffer;
  authTag: Buffer;
}

export function encryptCredential(plaintext: string): EncryptedCredential {
  const key = getServerMasterKey();
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { nonce, ciphertext, authTag };
}

export function decryptCredential(
  nonce: Buffer,
  ciphertext: Buffer,
  authTag: Buffer,
): string {
  const key = getServerMasterKey();
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}
