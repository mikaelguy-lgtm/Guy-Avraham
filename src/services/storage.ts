import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { AppEnv } from "../config/env.js";

export interface StoredObject {
  body: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface StorageService {
  initialize(): Promise<void>;
  put(key: string, body: Buffer, contentType: string, metadata?: Record<string, string>): Promise<void>;
  get(key: string): Promise<StoredObject>;
  signedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
  delete(key: string): Promise<void>;
}

export class S3StorageService implements StorageService {
  private readonly client: S3Client;
  private initialized = false;

  constructor(private readonly env: AppEnv) {
    this.client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_KEY}
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      await this.client.send(new HeadBucketCommand({Bucket: this.env.S3_BUCKET}));
    } catch (error: unknown) {
      const status = typeof error === "object" && error !== null && "$metadata" in error
        ? Number((error as {$metadata?: {httpStatusCode?: number}}).$metadata?.httpStatusCode)
        : 0;
      if (status !== 404 && status !== 403) throw error;
      await this.client.send(new CreateBucketCommand({Bucket: this.env.S3_BUCKET}));
    }
    this.initialized = true;
  }

  async put(key: string, body: Buffer, contentType: string, metadata?: Record<string, string>): Promise<void> {
    await this.initialize();
    await this.client.send(new PutObjectCommand({Bucket: this.env.S3_BUCKET, Key: key, Body: body, ContentType: contentType, Metadata: metadata}));
  }

  async get(key: string): Promise<StoredObject> {
    const result = await this.client.send(new GetObjectCommand({Bucket: this.env.S3_BUCKET, Key: key}));
    if (!result.Body) throw new Error("Stored object has no body");
    return {
      body: Buffer.from(await result.Body.transformToByteArray()),
      contentType: result.ContentType ?? "application/octet-stream",
      metadata: result.Metadata
    };
  }

  async signedDownloadUrl(key: string, expiresInSeconds = 300): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({Bucket: this.env.S3_BUCKET, Key: key}), {expiresIn: expiresInSeconds});
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({Bucket: this.env.S3_BUCKET, Key: key}));
  }
}

