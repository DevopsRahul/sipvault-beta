import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Storage } from "./types";

// PROD driver: writes files to S3. CloudFront (MEDIA_BASE_URL) serves them.
// Credentials come from the EC2 instance IAM role automatically - do NOT put AWS keys in .env.

export class S3Storage implements Storage {
  private client = new S3Client({ region: process.env.AWS_REGION });
  private bucket = process.env.S3_BUCKET;

  private requireBucket() {
    if (!this.bucket) throw new Error("S3_BUCKET is not set");
    return this.bucket;
  }

  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.requireBucket(),
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.requireBucket(), Key: key }));
  }
}
