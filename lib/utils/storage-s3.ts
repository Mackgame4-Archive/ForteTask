import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type UploadS3ObjectInput = {
  body: Buffer;
  bucket?: string;
  contentType: string;
  objectKey: string;
};

type DeleteS3ObjectInput = {
  bucket?: string;
  objectKey: string;
};

type S3DownloadUrlInput = {
  bucket?: string;
  contentDisposition?: string;
  contentType?: string;
  expiresIn?: number;
  objectKey: string;
};

const defaultBucket = process.env.S3_BUCKET ?? "fortetask";
const endpoint = process.env.S3_ENDPOINT;
const publicEndpoint = process.env.S3_PUBLIC_ENDPOINT;
const region = process.env.S3_REGION ?? "us-east-1";
const forcePathStyle = process.env.S3_FORCE_PATH_STYLE !== "false";

const s3 = new S3Client({
  endpoint,
  forcePathStyle,
  region,
  credentials:
    process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        }
      : undefined,
});

const bucketReady = new Map<string, Promise<void>>();

async function ensureS3Bucket(bucket = defaultBucket) {
  const existingPromise = bucketReady.get(bucket);

  if (existingPromise) {
    return existingPromise;
  }

  const nextPromise = (async () => {
    try {
      await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    }
  })();

  bucketReady.set(bucket, nextPromise);

  return nextPromise;
}

async function uploadS3Object({
  body,
  bucket = defaultBucket,
  contentType,
  objectKey,
}: UploadS3ObjectInput) {
  await ensureS3Bucket(bucket);

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: body,
      ContentType: contentType,
    })
  );
}

async function deleteS3Object({
  bucket = defaultBucket,
  objectKey,
}: DeleteS3ObjectInput) {
  await ensureS3Bucket(bucket);

  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    })
  );
}

async function getS3DownloadUrl({
  bucket = defaultBucket,
  contentDisposition,
  contentType,
  expiresIn = 60 * 10,
  objectKey,
}: S3DownloadUrlInput) {
  await ensureS3Bucket(bucket);

  const signedUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ResponseContentDisposition: contentDisposition,
      ResponseContentType: contentType,
    }),
    { expiresIn }
  );

  if (!publicEndpoint || !endpoint) {
    return signedUrl;
  }

  return signedUrl.replace(endpoint, publicEndpoint);
}

export {
  defaultBucket as defaultS3Bucket,
  deleteS3Object,
  ensureS3Bucket,
  getS3DownloadUrl,
  uploadS3Object,
};
