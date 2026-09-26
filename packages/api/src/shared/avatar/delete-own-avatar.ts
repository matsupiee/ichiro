import type { AvatarStorage } from "../../third-party-lib/avatar-storage";

// user.image が自分のアップロードした写真なら、ストレージから消す。
// 外部の URL（将来のソーシャルログインなど）やほかのユーザーのパスには触れない
export async function deleteOwnAvatar(
  storage: AvatarStorage,
  userId: string,
  image: string | null,
) {
  if (!image?.startsWith(`/avatars/${userId}/`)) return;
  await storage.delete(image.slice(1));
}
