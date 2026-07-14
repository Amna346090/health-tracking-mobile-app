import { S3Client, DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ─── Client ───────────────────────────────────────────────────────────────────

function createClient(): S3Client {
  const endpoint = process.env.S3_ENDPOINT; // set for Cloudflare R2, MinIO, etc.
  return new S3Client({
    region: process.env.S3_REGION ?? 'auto',
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    credentials: {
      accessKeyId:     process.env.S3_ACCESS_KEY_ID     ?? '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
    },
  });
}

// Lazy singleton — avoids crashing at startup if env vars are missing
let _client: S3Client | null = null;
function client(): S3Client {
  if (!_client) _client = createClient();
  return _client;
}

const BUCKET     = () => process.env.S3_BUCKET_NAME ?? '';
const PUB_BASE   = () => process.env.S3_PUBLIC_URL_BASE ?? '';
const EXPIRES_IN = 900; // 15 minutes

// ─── Key helpers ──────────────────────────────────────────────────────────────

function generateKey(patientId: number, originalName: string): string {
  const ext  = originalName.split('.').pop()?.toLowerCase() ?? 'jpg';
  const rand = crypto.randomUUID();
  return `patients/${patientId}/${rand}.${ext}`;
}

export function publicUrl(key: string): string {
  const base = PUB_BASE();
  if (base) return `${base}/${key}`;
  // Fall back to standard S3 path-style URL
  return `https://${BUCKET()}.s3.${process.env.S3_REGION ?? 'us-east-1'}.amazonaws.com/${key}`;
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function presignUpload(
  patientId: number,
  filename: string,
  contentType: string,
): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  const key = generateKey(patientId, filename);
  const cmd = new PutObjectCommand({
    Bucket:      BUCKET(),
    Key:         key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(client(), cmd, { expiresIn: EXPIRES_IN });
  return { uploadUrl, publicUrl: publicUrl(key), key };
}

export async function deleteObject(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: BUCKET(), Key: key }));
}
