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

import { createElement } from '../utils/dom.js?v=2';
import { translateError } from '../utils/translateError.js?v=2';
import { store } from '../core/Store.js?v=2';
import { getAvatarUrl } from '../core/Avatar.js?v=2';
import { getCollection } from '../firebase/dbService.js?v=2';

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
            text: 'Ошибка загрузки: ' + translateError(err)
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

