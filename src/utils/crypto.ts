import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

export function encryptField(text: string): string {
  if (!text) return '';
  const keyHex = process.env.FIELD_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('FIELD_ENCRYPTION_KEY environment variable is not defined.');
  }
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag().toString('hex');
  
  return `v1:${iv.toString('hex')}:${tag}:${encrypted}`;
}

export function decryptField(encryptedText: string | null | undefined): string {
  if (!encryptedText) return '';
  if (!encryptedText.startsWith('v1:')) {
    return encryptedText;
  }
  
  const keyHex = process.env.FIELD_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('FIELD_ENCRYPTION_KEY environment variable is not defined.');
  }
  const key = Buffer.from(keyHex, 'hex');
  
  const parts = encryptedText.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted text format.');
  }
  
  const [, ivHex, tagHex, ciphertextHex] = parts;
  
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export function hashNormalizedIdentityNumber(idNum: string): string {
  if (!idNum) return '';
  const normalized = idNum.trim().replace(/\D/g, '');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export function maskIdentityNumber(idNum: string): string {
  if (!idNum) return '';
  const normalized = idNum.trim();
  if (normalized.length <= 4) return normalized;
  return normalized.slice(-4);
}
