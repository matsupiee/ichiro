import type { AvatarStorage } from "../third-party-lib/avatar-storage";

// テスト用のメモリ上のストレージ。objects を見れば、置かれている写真がわかる
export function memoryAvatarStorage() {
  const objects = new Map<string, { bytes: Uint8Array; contentType: string }>();
  const storage: AvatarStorage = {
    async put(key, value, options) {
      objects.set(key, {
        bytes: new Uint8Array(value.slice(0)),
        contentType: options.httpMetadata.contentType,
      });
      return null;
    },
    async get(key) {
      const o = objects.get(key);
      if (!o) return null;
      return {
        body: new Blob([o.bytes]).stream(),
        httpEtag: `"${key}"`,
        httpMetadata: { contentType: o.contentType },
      };
    },
    async delete(key) {
      objects.delete(key);
    },
  };
  return { storage, objects };
}
