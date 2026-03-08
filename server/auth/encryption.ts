import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

// Cached for process lifetime. Changing ENCRYPTION_KEY requires a restart.
let cachedKey: Buffer | null = null;

export function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  const key = Buffer.from(raw, 'hex');
  if (key.length !== 32) {
    throw new Error(`ENCRYPTION_KEY must be 32 bytes (64 hex chars), got ${key.length} bytes`);
  }

  cachedKey = key;
  return key;
}

export function isEncryptionAvailable(): boolean {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(encrypted: string): string {
  const key = getEncryptionKey();
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format');
  }

  const iv = Buffer.from(parts[0]!, 'hex');
  const authTag = Buffer.from(parts[1]!, 'hex');
  const ciphertext = Buffer.from(parts[2]!, 'hex');

  if (iv.length !== IV_LENGTH) throw new Error('Invalid IV length');
  if (authTag.length !== AUTH_TAG_LENGTH) throw new Error('Invalid auth tag length');
  if (ciphertext.length === 0) throw new Error('Empty ciphertext');

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
