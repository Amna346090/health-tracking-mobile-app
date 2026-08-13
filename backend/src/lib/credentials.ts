import crypto from 'crypto';

// Reversible storage for generated patient passwords so an admin can view
// them later — unlike passwordHash (bcrypt, one-way, used for login checks).
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function key(): Buffer {
  const val = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!val) throw new Error('Missing env var: CREDENTIALS_ENCRYPTION_KEY');
  const buf = Buffer.from(val, 'hex');
  if (buf.length !== 32) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY must be a 32-byte hex string (64 hex characters)');
  }
  return buf;
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), ciphertext.toString('hex')].join(':');
}

export function decrypt(stored: string): string {
  const [ivHex, authTagHex, ciphertextHex] = stored.split(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, key(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const plain = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, 'hex')), decipher.final()]);
  return plain.toString('utf8');
}
