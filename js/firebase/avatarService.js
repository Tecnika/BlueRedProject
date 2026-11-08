import { updateUserProfile, syncPublicPlayer } from './authService.js?v=27';

/** Сохранить фото в профиль и публичную проекцию (бесплатно, data URL в Firestore) */
export async function saveUserPhoto(uid, photo) {
    const photoUpdatedAt = new Date().toISOString();
    await updateUserProfile(uid, {
        photo: photo || null,
        photoUpdatedAt
    });
    await syncPublicPlayer(uid, {
        photo: photo || null,
        photoUpdatedAt
    });
}

export async function removeUserPhoto(uid) {
    await saveUserPhoto(uid, null);
}
