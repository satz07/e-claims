// src/config/s3-config.ts
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import {
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} from '@azure/storage-blob';
import { BadRequestException } from '@nestjs/common';

const AZURE_STORAGE_ACCOUNT = process.env.AZURE_STORAGE_ACCOUNT || '';
const AZURE_STORAGE_KEY = process.env.AZURE_STORAGE_KEY || '';

// Container name where bank supporting docs will be stored
export const bankDocsContainerName = 'bank-documents';

function getSharedKeyCredential(): StorageSharedKeyCredential {
  if (!AZURE_STORAGE_ACCOUNT || !AZURE_STORAGE_KEY) {
    throw new BadRequestException('Azure storage is not configured');
  }
  return new StorageSharedKeyCredential(
    AZURE_STORAGE_ACCOUNT,
    AZURE_STORAGE_KEY,
  );
}

function getBlobServiceClient(): BlobServiceClient {
  const credential = getSharedKeyCredential();
  return new BlobServiceClient(
    `https://${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net`,
    credential,
  );
}

// Ensure container exists
export const getContainerClient = async (): Promise<ContainerClient> => {
  const containerClient = getBlobServiceClient().getContainerClient(
    bankDocsContainerName,
  );
  const exists = await containerClient.exists();
  if (!exists) {
    await containerClient.create();
  }
  return containerClient;
};

/**
 * Convert blob paths to SAS URLs for downloading
 */
export function getDocumentUrls(
  blobPaths?: string | string[],
  expiresInHours = 1,
): string[] {
  if (!blobPaths) return [];

  const paths = Array.isArray(blobPaths) ? blobPaths : [blobPaths];
  const sharedKeyCredential = getSharedKeyCredential();
  const containerClient = getBlobServiceClient().getContainerClient(
    bankDocsContainerName,
  );

  return paths.map((path) => {
    const blobClient = containerClient.getBlobClient(path);

    const sasToken = generateBlobSASQueryParameters(
      {
        containerName: bankDocsContainerName,
        blobName: path,
        permissions: BlobSASPermissions.parse('r'),
        startsOn: new Date(),
        expiresOn: new Date(Date.now() + expiresInHours * 3600 * 1000),
      },
      sharedKeyCredential,
    ).toString();

    return `${blobClient.url}?${sasToken}`;
  });
}

export async function uploadFilesToAzure(
  files: Express.Multer.File[],
  folder: string,
): Promise<string[]> {
  if (!files?.length) return [];

  const container = await getContainerClient();
  const uploadedPaths: string[] = [];

  for (const file of files) {
    try {
      const blobName = `${folder}/${Date.now()}-${file.originalname}`;
      const blob = container.getBlockBlobClient(blobName);

      await blob.uploadData(file.buffer, {
        blobHTTPHeaders: {
          blobContentType: file.mimetype,
        },
      });

      uploadedPaths.push(blobName);
    } catch (err) {
      throw new BadRequestException(
        `Failed to upload document: ${file.originalname}`,
      );
    }
  }

  return uploadedPaths;
}
