import cloudbase from '@cloudbase/js-sdk';

const DEFAULT_BUCKET = 'goujianyunzong-files';
const SIGNED_URL_TTL_SECONDS = 60 * 60;

type CloudBaseApp = ReturnType<typeof cloudbase.init>;
type StorageBucket = ReturnType<CloudBaseApp['storage']['from']>;

let app: CloudBaseApp | undefined;
let bucket: StorageBucket | undefined;

function storageBucket(): StorageBucket {
  if (bucket) return bucket;
  const env = process.env.CLOUDBASE_ENV_ID?.trim();
  if (!env) throw new Error('缺少 CloudBase 环境变量 CLOUDBASE_ENV_ID');
  const accessKey = process.env.CLOUDBASE_APIKEY?.trim();
  if (!accessKey) throw new Error('缺少 CloudBase 服务端环境变量 CLOUDBASE_APIKEY');
  app ??= cloudbase.init({
    env,
    accessKey,
  });
  bucket = app.storage.from(
    process.env.CLOUDBASE_STORAGE_BUCKET?.trim() || DEFAULT_BUCKET,
  );
  return bucket;
}

export async function uploadObject(
  objectKey: string,
  file: File,
  metadata: Record<string, string>,
  contentType = file.type || 'application/octet-stream',
) {
  const { error } = await storageBucket().upload(objectKey, file, {
    contentType,
    metadata,
    upsert: false,
  });
  if (error) throw new Error(`文件上传失败：${error.message}`);
}

export async function removeObject(objectKey: string) {
  const { error } = await storageBucket().remove([objectKey]);
  if (error) throw new Error(`文件删除失败：${error.message}`);
}

export async function createPrivateUrl(
  objectKey: string,
  downloadName?: string,
) {
  const { data, error } = await storageBucket().createSignedUrl(
    objectKey,
    SIGNED_URL_TTL_SECONDS,
    downloadName ? { download: downloadName } : undefined,
  );
  if (error) throw new Error(`文件访问链接生成失败：${error.message}`);
  if (!data?.fullSignedURL) throw new Error('文件访问链接生成失败');
  return data.fullSignedURL;
}
