import { useRouter } from "@tanstack/react-router";
import { useCallback, useState } from "react";

import { useDialog } from "../components/dialog";

// プロフィール写真はサーバー（Cloudflare R2）に上げて、user.image にそのパスを入れる。
// 表示サイズは最大でも数十ピクセルなので、上げる前に中央を正方形に切り抜き、512px 四方の JPEG に縮める。
const UPLOAD_SIZE = 512;

async function loadImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    // ブラウザが読める形式なら何でもよい（Safari は HEIC も読める）
    await image.decode();
    return image;
  } catch {
    throw new Error("この形式の写真は読み込めませんでした。JPEG・PNG・WebP の写真を選んでください");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function shrinkToJpeg(file: File): Promise<Blob> {
  const image = await loadImage(file);
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  const size = Math.min(side, UPLOAD_SIZE);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("写真を加工できませんでした");
  context.drawImage(
    image,
    Math.floor((image.naturalWidth - side) / 2),
    Math.floor((image.naturalHeight - side) / 2),
    side,
    side,
    0,
    0,
    size,
    size,
  );
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  if (!blob) throw new Error("写真を加工できませんでした");
  return blob;
}

async function request(method: "PUT" | "DELETE", body?: Blob) {
  const res = await fetch("/api/profile/avatar", {
    method,
    body,
    headers: body ? { "Content-Type": "image/jpeg" } : undefined,
  }).catch(() => {
    throw new Error("通信できませんでした");
  });
  const data = (await res.json().catch(() => null)) as {
    image?: string | null;
    message?: string;
  } | null;
  if (!res.ok) throw new Error(data?.message ?? "通信に失敗しました");
  return data?.image ?? null;
}

// image はログイン中のユーザーの user.image（/avatars/... のパス）
export function useAvatar(image: string | null) {
  const router = useRouter();
  const dialog = useDialog();
  // アップロード中は選んだ写真をすぐに見せる
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = useCallback(
    async (file: File) => {
      if (busy) return;
      setBusy(true);
      let previewUrl: string | null = null;
      try {
        const small = await shrinkToJpeg(file);
        previewUrl = URL.createObjectURL(small);
        setPreview(previewUrl);
        const saved = await request("PUT", small);
        // 読み込み済みにしてから差し替え、表示が一瞬消えないようにする
        if (saved) {
          const next = new Image();
          next.src = saved;
          await next.decode().catch(() => {});
        }
        await router.invalidate();
      } catch (e) {
        await dialog.alert({
          title: "写真を保存できませんでした",
          message: e instanceof Error ? e.message : undefined,
        });
      } finally {
        setPreview(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setBusy(false);
      }
    },
    [busy, dialog, router],
  );

  const remove = useCallback(async () => {
    if (busy || !image) return;
    setBusy(true);
    try {
      await request("DELETE");
      await router.invalidate();
    } catch (e) {
      await dialog.alert({
        title: "写真を削除できませんでした",
        message: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }, [busy, dialog, image, router]);

  return { src: preview ?? image, busy, upload, remove };
}
