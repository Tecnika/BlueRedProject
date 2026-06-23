/**
 * FactionPage — страница фракции.
 *
 * Для обычного игрока: показывает список участников своей фракции.
 *   — Сортировка: сначала игрок выше, затем по роли (мастер -> игротех -> игрок).
 *
 * Для мастера (role === 'master'): показывает ВСЕХ игроков, сгруппированных по фракциям.
 *   — Группы: Фиолетовые, Синие, Красные, Не распределены.
 *   — Внутри групп — сортировка по алфавиту.
 */

import { createElement } from '../utils/dom.js';
import { store } from '../core/Store.js';
import { getAvatarUrl } from '../core/Avatar.js';
import { getCollection } from '../firebase/dbService.js';
import { getAllTags, addTag, removeTag } from '../firebase/tagsService.js';

/** Порядок отображения групп (для админа) */
const FACTION_ORDER = ['purple', 'blue', 'red', '__unassigned'];

const FACTION_LABELS = {
    purple: 'Фиолетовые',
    blue: 'Синие',
    red: 'Красные',
    __unassigned: 'Не распределены'
};

const ROLE_LABELS = {
    master: 'Мастер',
    igrotech: 'Игротех',
    player: 'Игрок'
};

export async function FactionPage() {
    const section = createElement('section', { className: 'faction-page' });
    const currentUser = store.get('user');

    if (!currentUser) {
        section.appendChild(createElement('p', {
            className: 'faction-page__error',
            text: 'Необходимо авторизоваться'
        }));
        return section;
    }

    const isAdmin = currentUser.role === 'master';

    // Если нет фракции — показываем ошибку (админу можно)
    if (!isAdmin && !currentUser.faction) {
        section.appendChild(createElement('p', {
            className: 'faction-page__error',
            text: 'Вы ещё не выбрали фракцию'
        }));
        return section;
    }

    try {
        if (isAdmin) {
            // Мастер видит всех игроков, сгруппированных по фракциям
            const allUsers = await getCollection('users');
            const grouped = groupByFaction(allUsers);
            renderAdminView(section, grouped, currentUser.uid);
            // Панель управления каталогом тегов
            const tagManager = await createTagManager();
            section.appendChild(tagManager);
        } else {
            // Обычный игрок — только свою фракцию
            const members = await getCollection('users', [
                { field: 'faction', op: '==', value: currentUser.faction }
            ]);
            renderFactionView(section, members, currentUser);
        }
    } catch (err) {
        section.appendChild(createElement('p', {
            className: 'faction-page__error',
            text: 'Ошибка загрузки: ' + err.message
        }));
    }

    return section;
}

/**
 * Группирует пользователей по фракциям.
 * @param {Object[]} users
 * @returns {Object} { factionKey: [user, ...] }
 */
function groupByFaction(users) {
    const groups = {};

    for (const faction of FACTION_ORDER) {
        groups[faction] = [];
    }

    for (const user of users) {
        const key = user.faction && FACTION_LABELS[user.faction] ? user.faction : '__unassigned';
        groups[key].push(user);
    }

    // Сортировка по алфавиту внутри каждой группы
    for (const faction of FACTION_ORDER) {
        groups[faction].sort((a, b) => {
            const nameA = (a.username || '').toLowerCase();
            const nameB = (b.username || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });
    }

    return groups;
}

/** Рендерит представление для мастера: все фракции -> группы */
function renderAdminView(section, grouped, currentUid) {
    const header = createElement('div', { className: 'faction-page__header' });
    header.appendChild(createElement('h1', {
        className: 'faction-page__title',
        text: 'Все игроки'
    }));
    section.appendChild(header);

    for (const faction of FACTION_ORDER) {
        const members = grouped[faction];
        if (members.length === 0) continue;

        const group = createElement('div', { className: 'faction-group' });

        const title = createElement('h2', {
            className: 'faction-group__title',
            text: FACTION_LABELS[faction]
        });

        const count = createElement('span', {
            className: 'faction-group__count',
            text: `${members.length}`
        });

        title.appendChild(count);
        group.appendChild(title);

        const list = createElement('div', { className: 'faction-page__list' });
        for (const member of members) {
            list.appendChild(createMemberCard(member, currentUid));
        }
        group.appendChild(list);
        section.appendChild(group);
    }
}

/** Рендерит представление для обычного игрока: одна фракция */
function renderFactionView(section, members, currentUser) {
    const factionLabel = FACTION_LABELS[currentUser.faction] || currentUser.faction;

    const header = createElement('div', { className: 'faction-page__header' });
    header.appendChild(createElement('h1', {
        className: 'faction-page__title',
        text: `Фракция: ${factionLabel}`
    }));
    section.appendChild(header);

    const list = createElement('div', { className: 'faction-page__list' });

    sortMembers(members, currentUser.uid);

    for (const member of members) {
        list.appendChild(createMemberCard(member, currentUser.uid));
    }

    if (members.length === 0) {
        list.appendChild(createElement('p', {
            className: 'faction-page__empty',
            text: 'Во фракции пока никого нет'
        }));
    }

    section.appendChild(list);
}

/**
 * Сортировка участников:
 *   - Сначала текущий игрок
 *   - Затем по роли: master -> igrotech -> player -> остальные
 */
function sortMembers(members, currentUid) {
    members.sort((a, b) => {
        if (a.id === currentUid) return -1;
        if (b.id === currentUid) return 1;

        const roleOrder = { master: 0, igrotech: 1, player: 2 };
        const aOrder = roleOrder[a.role] ?? 3;
        const bOrder = roleOrder[b.role] ?? 3;
        return aOrder - bOrder;
    });
}

/** Создаёт карточку игрока (ссылка на профиль) */
function createMemberCard(member, currentUid) {
    const isCurrent = member.id === currentUid;
    const card = createElement('a', {
        className: `faction-card${isCurrent ? ' faction-card--current' : ''}`,
        attributes: { href: `#/profile?uid=${member.id}` }
    });

    const avatarUrl = getAvatarUrl(member.username, member.faction);

    const avatar = createElement('img', {
        className: 'faction-card__avatar',
        attributes: { src: avatarUrl, alt: member.username }
    });

    const info = createElement('div', { className: 'faction-card__info' });

    const nameRow = createElement('div', { className: 'faction-card__name-row' });
    nameRow.appendChild(createElement('span', {
        className: 'faction-card__name',
        text: member.username + (isCurrent ? ' (вы)' : '')
    }));
    nameRow.appendChild(createElement('span', {
        className: 'faction-card__role',
        text: ROLE_LABELS[member.role] || member.role
    }));
    info.appendChild(nameRow);

    if (member.worldview) {
        info.appendChild(createElement('p', {
            className: 'faction-card__detail',
            text: `Мировоззрение: ${member.worldview}`
        }));
    }

    // Показываем до 3 тегов доступа, остальные — свёрнуты
    if (member.accessTags && member.accessTags.length) {
        const tagList = createElement('div', { className: 'faction-card__tags' });
        const tagsToShow = member.accessTags.slice(0, 3);
        for (const tag of tagsToShow) {
            tagList.appendChild(createElement('span', { className: 'faction-card__tag', text: tag }));
        }
        if (member.accessTags.length > 3) {
            tagList.appendChild(createElement('span', {
                className: 'faction-card__tag faction-card__tag--more',
                text: `+${member.accessTags.length - 3}`
            }));
        }
        info.appendChild(tagList);
    }

    card.appendChild(avatar);
    card.appendChild(info);

    return card;
}

/** Панель управления каталогом тегов (только для мастера) */
async function createTagManager() {
    const section = createElement('div', { className: 'faction-tag-manager' });

    const header = createElement('div', { className: 'faction-tag-manager__header' });
    const title = createElement('h2', {
        className: 'faction-tag-manager__title',
        text: 'Каталог тегов'
    });
    header.appendChild(title);
    section.appendChild(header);

    // Блок добавления нового тега
    const addRow = createElement('div', { className: 'faction-tag-manager__add' });
    const addInput = createElement('input', {
        className: 'faction-tag-manager__input',
        attributes: { type: 'text', placeholder: 'Название нового тега...' }
    });
    const addBtn = createElement('button', {
        className: 'faction-tag-manager__add-btn',
        text: 'Добавить',
        attributes: { type: 'button' }
    });
    const addMsg = createElement('span', { className: 'faction-tag-manager__msg' });
    addRow.appendChild(addInput);
    addRow.appendChild(addBtn);
    addRow.appendChild(addMsg);
    section.appendChild(addRow);

    // Список тегов
    const list = createElement('div', { className: 'faction-tag-manager__list' });
    section.appendChild(list);

    /** Перезагрузить список тегов */
    async function reloadTags() {
        list.innerHTML = '';
        const tags = await getAllTags();

        if (tags.length === 0) {
            list.appendChild(createElement('p', {
                className: 'faction-tag-manager__empty',
                text: 'Каталог тегов пуст'
            }));
            return;
        }

        for (const tag of tags) {
            const row = createElement('div', { className: 'faction-tag-manager__row' });

            const nameEl = createElement('span', {
                className: 'faction-tag-manager__tag-name',
                text: tag.name
            });

            const delBtn = createElement('button', {
                className: 'faction-tag-manager__delete-btn',
                text: '✕',
                attributes: { type: 'button', title: 'Удалить тег' },
                events: {
                    click: async () => {
                        try {
                            await removeTag(tag.id);
                            await reloadTags();
                        } catch (err) {
                            addMsg.textContent = 'Ошибка: ' + err.message;
                        }
                    }
                }
            });

            row.appendChild(nameEl);
            row.appendChild(delBtn);
            list.appendChild(row);
        }
    }

    // Добавление нового тега
    addBtn.addEventListener('click', async () => {
        const value = addInput.value.trim();
        if (!value) return;

        addBtn.disabled = true;
        addMsg.textContent = '';
        try {
            await addTag(value);
            addInput.value = '';
            await reloadTags();
            addMsg.textContent = 'Тег добавлен';
            addMsg.className = 'faction-tag-manager__msg faction-tag-manager__msg--ok';
        } catch (err) {
            addMsg.textContent = 'Ошибка: ' + err.message;
            addMsg.className = 'faction-tag-manager__msg faction-tag-manager__msg--err';
        } finally {
            addBtn.disabled = false;
        }
    });

    // Enter в поле ввода
    addInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addBtn.click();
    });

    await reloadTags();
    return section;
}
