/**
 * File storage abstraction: Cloudflare R2 (S3-compatible) when configured,
 * local disk under /uploads otherwise.
 *
 * Env for R2:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   R2_BUCKET_NAME, R2_PUBLIC_URL (public bucket/custom domain base URL)
 */

const path = require('path');
const fs = require('fs');

function isR2Configured() {
    return !!(
        process.env.R2_ACCOUNT_ID &&
        process.env.R2_ACCESS_KEY_ID &&
        process.env.R2_SECRET_ACCESS_KEY &&
        process.env.R2_BUCKET_NAME &&
        process.env.R2_PUBLIC_URL
    );
}

let s3Client = null;
function getS3Client() {
    if (!s3Client) {
        const { S3Client } = require('@aws-sdk/client-s3');
        s3Client = new S3Client({
            region: 'auto',
            endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
            },
        });
    }
    return s3Client;
}

const LOCAL_UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');

/**
 * Store a buffer under `key` (e.g. "branding/org123_headerLogo.png").
 * Returns the public URL to serve it from.
 */
async function uploadBuffer(key, buffer, contentType) {
    if (isR2Configured()) {
        const { PutObjectCommand } = require('@aws-sdk/client-s3');
        await getS3Client().send(new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: contentType,
        }));
        return `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
    }

    const filepath = path.join(LOCAL_UPLOAD_ROOT, key);
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, buffer);
    return `/uploads/${key.replace(/\\/g, '/')}`;
}

/**
 * Delete a previously stored file, given the URL uploadBuffer returned.
 * Best-effort: missing files are not an error.
 */
async function deleteByUrl(url) {
    if (!url) return;

    if (isR2Configured() && url.startsWith(process.env.R2_PUBLIC_URL.replace(/\/$/, ''))) {
        const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
        const key = url.slice(process.env.R2_PUBLIC_URL.replace(/\/$/, '').length + 1);
        try {
            await getS3Client().send(new DeleteObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: key,
            }));
        } catch (err) {
            console.warn('[Storage] R2 delete failed:', err.message);
        }
        return;
    }

    if (url.startsWith('/uploads/')) {
        const filepath = path.join(LOCAL_UPLOAD_ROOT, url.slice('/uploads/'.length));
        try {
            if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        } catch (err) {
            console.warn('[Storage] Local delete failed:', err.message);
        }
    }
}

module.exports = { isR2Configured, uploadBuffer, deleteByUrl };
