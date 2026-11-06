/**
 * constants — общие текстовые метки и константы домена.
 *
 * Единый источник истины (DRY): не дублируйте эти словари по страницам.
 */

/** Роли пользователей */
export const ROLE_LABELS = {
    player: 'Игрок',
    igrotech: 'Игротех',
    master: 'Мастер'
};

/** Статусы игры */
export const GAME_STATUS_LABELS = {
    draft: 'Черновик',
    active: 'Активна',
    finished: 'Завершена'
};

/** Названия языков (для языков персонажа) */
export const LANGUAGE_LABELS = {
    common: 'Общий',
    red: 'Красных',
    blue: 'Синих',
    purple: 'Фиолетовых'
};

/** Пол */
export const GENDER_LABELS = {
    male: 'Мужской',
    female: 'Женский'
};
