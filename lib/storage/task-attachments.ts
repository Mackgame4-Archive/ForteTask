import {
  defaultS3Bucket,
  deleteS3Object,
  getS3DownloadUrl,
  uploadS3Object,
} from "@/lib/utils/storage-s3";

function getTaskAttachmentObjectKey({
  fileName,
  taskId,
}: {
  fileName: string;
  taskId: number;
}) {
  const extension = fileName.includes(".")
    ? `.${fileName.split(".").pop()}`
    : "";
  const token = crypto.randomUUID();

  return `tasks/${taskId}/${token}${extension}`;
}

async function uploadTaskAttachmentObject({
  body,
  contentType,
  objectKey,
}: {
  body: Buffer;
  contentType: string;
  objectKey: string;
}) {
  await uploadS3Object({
    body,
    contentType,
    objectKey,
  });
}

async function deleteTaskAttachmentObject(objectKey: string) {
  await deleteS3Object({ objectKey });
}

async function getTaskAttachmentDownloadUrl({
  contentType,
  fileName,
  objectKey,
}: {
  contentType: string;
  fileName: string;
  objectKey: string;
}) {
  return getS3DownloadUrl({
    contentDisposition: `attachment; filename="${fileName.replaceAll('"', "")}"`,
    contentType,
    objectKey,
  });
}

export {
  defaultS3Bucket as taskAttachmentBucket,
  deleteTaskAttachmentObject,
  getTaskAttachmentDownloadUrl,
  getTaskAttachmentObjectKey,
  uploadTaskAttachmentObject,
};
