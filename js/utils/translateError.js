/**
 * translateError — переводит ошибки Firebase и другие в русский текст
 */

const ERROR_MAP = {
    // Firestore
    'Missing or insufficient permissions': 'Нет прав для выполнения операции',
    'PERMISSION_DENIED': 'Доступ запрещён',
    'Firebase: Error (auth/invalid-credential)': 'Неверный логин или пароль',
    // Auth
    'auth/user-not-found': 'Пользователь не найден',
    'auth/wrong-password': 'Неверный пароль',
    'auth/invalid-email': 'Некорректный email',
    'auth/user-disabled': 'Учётная запись отключена',
    'auth/email-already-in-use': 'Этот email уже используется',
    'auth/weak-password': 'Слишком простой пароль',
    'auth/too-many-requests': 'Слишком много попыток, повторите позже',
    'auth/network-request-failed': 'Ошибка сети, проверьте подключение',
    'auth/invalid-credential': 'Неверный логин или пароль',
    'auth/operation-not-allowed': 'Операция не разрешена',
    'auth/requires-recent-login': 'Требуется повторный вход',
};

export function translateError(err) {
    if (!err) return 'Неизвестная ошибка';

    const msg = typeof err === 'string' ? err : (err.message || err.code || String(err));

    // Прямое совпадение по коду
    if (ERROR_MAP[msg]) return ERROR_MAP[msg];

    // Поиск по подстроке
    for (const [key, val] of Object.entries(ERROR_MAP)) {
        if (msg.includes(key)) return val;
    }

    // Если ничего не подошло — возвращаем как есть, но убираем Firebase: Error()
    return msg
        .replace(/^Firebase:\s*Error\s*\([^)]+\)\s*/i, '')
        .replace(/^\s*Error:\s*/i, '')
        .trim() || 'Неизвестная ошибка';
}
