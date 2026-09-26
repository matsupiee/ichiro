// プロフィール写真を置く Cloudflare R2 のバケットのうち、ここで使う部分だけ。テストではメモリ上の実装を渡す
export type AvatarObject = {
  body: ReadableStream;
  httpEtag: string;
  httpMetadata?: { contentType?: string };
};

export type AvatarStorage = {
  put(
    key: string,
    value: ArrayBuffer,
    options: { httpMetadata: { contentType: string } },
  ): Promise<unknown>;
  get(key: string): Promise<AvatarObject | null>;
  delete(key: string): Promise<void>;
};
