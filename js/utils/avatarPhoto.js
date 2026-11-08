/**
 * Бесплатная замена аватарки: файл сжимается в canvas и хранится
 * как data URL в Firestore. Без Firebase Storage и платных сервисов.
 */

const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const OUTPUT_SIZE = 320;
const MAX_DATA_URL_LENGTH = 180000;

function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
        reader.readAsDataURL(file);
    });
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Не удалось открыть изображение'));
        img.src = src;
    });
}

/** Сжимает фото в квадрат 320×320 JPEG */
export async function processAvatarFile(file) {
    if (!file) throw new Error('Файл не выбран');
    if (!String(file.type || '').startsWith('image/')) {
        throw new Error('Нужен файл изображения (JPG, PNG, WebP)');
    }
    if (file.size > MAX_SOURCE_BYTES) {
        throw new Error('Фото слишком большое. Максимум 8 МБ');
    }

    const raw = await readFile(file);
    const image = await loadImage(raw);

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');

    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const sx = (image.naturalWidth - side) / 2;
    const sy = (image.naturalHeight - side) / 2;
    ctx.drawImage(image, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    let quality = 0.82;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (dataUrl.length > MAX_DATA_URL_LENGTH && quality > 0.45) {
        quality -= 0.08;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
    }

    if (dataUrl.length > MAX_DATA_URL_LENGTH) {
        throw new Error('Не удалось достаточно сжать фото');
    }

    return dataUrl;
}
