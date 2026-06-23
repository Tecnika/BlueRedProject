import { createElement } from '../utils/dom.js';
import { store } from '../core/Store.js';
import { getAvatarUrl } from '../core/Avatar.js';
import { getCollection } from '../firebase/dbService.js';

const FACTION_LABELS = {
    red: 'Красные',
    blue: 'Синие',
    purple: 'Фиолетовые'
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

    if (!currentUser.faction) {
        section.appendChild(createElement('p', {
            className: 'faction-page__error',
            text: 'Вы ещё не выбрали фракцию'
        }));
        return section;
    }

    const factionLabel = FACTION_LABELS[currentUser.faction] || currentUser.faction;

    const header = createElement('div', { className: 'faction-page__header' });
    header.appendChild(createElement('h1', {
        className: 'faction-page__title',
        text: `Фракция: ${factionLabel}`
    }));
    section.appendChild(header);

    const list = createElement('div', { className: 'faction-page__list' });

    try {
        const members = await getCollection('users', [
            { field: 'faction', op: '==', value: currentUser.faction }
        ]);

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
    } catch (err) {
        list.appendChild(createElement('p', {
            className: 'faction-page__error',
            text: 'Ошибка загрузки: ' + err.message
        }));
    }

    section.appendChild(list);
    return section;
}

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
