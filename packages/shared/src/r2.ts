import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (_client) return _client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY must be set');
  }

  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return _client;
}

function getBucket(): string {
  return process.env.R2_BUCKET || 'hawk-os-backups';
}

export async function uploadToR2(
  key: string,
  body: Buffer | string,
  contentType = 'application/octet-stream',
): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: typeof body === 'string' ? Buffer.from(body) : body,
      ContentType: contentType,
    }),
  );
}

export async function downloadFromR2(key: string): Promise<Buffer> {
  const result = await getClient().send(new GetObjectCommand({ Bucket: getBucket(), Key: key }));
  const stream = result.Body;
  if (!stream) throw new Error(`Empty response for key: ${key}`);
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function listR2Objects(prefix: string): Promise<string[]> {
  const result = await getClient().send(
    new ListObjectsV2Command({ Bucket: getBucket(), Prefix: prefix }),
  );
  return (result.Contents || []).map((obj) => obj.Key!).filter(Boolean);
}

export async function deleteFromR2(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}
