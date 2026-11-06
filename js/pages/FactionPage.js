import { createElement } from '../utils/dom.js?v=6';
import { translateError } from '../utils/translateError.js?v=6';
import { store } from '../core/Store.js?v=6';
import { createAvatar } from '../core/Avatar.js?v=6';
import { getCharactersByGame } from '../firebase/charactersService.js?v=6';
import { getAllPublicPlayers } from '../firebase/publicPlayersService.js?v=6';
import { Chip } from '../components/Chip.js?v=6';
import { FactionBadge } from '../components/FactionBadge.js?v=6';
import { StatusMessage } from '../components/StatusMessage.js?v=6';
import { getActiveFaction, getActiveGame, FACTION_LABELS } from '../utils/profile.js?v=6';
import { ROLE_LABELS } from '../utils/constants.js?v=6';

const FACTION_ORDER = ['purple', 'blue', 'red', '__unassigned'];
const GROUP_LABELS = { ...FACTION_LABELS, __unassigned: 'Не распределены' };

export async function FactionPage() {
    const section = createElement('section', { className: 'faction-page' });
    const currentUser = store.get('user');

    if (!currentUser) {
        section.appendChild(StatusMessage({ type: 'err', text: 'Требуется идентификация' }));
        return section;
    }

    const isAdmin = currentUser.role === 'master';
    const game = getActiveGame();

    if (!game) {
        section.appendChild(StatusMessage({ type: 'ok', text: 'Игра ещё не начата' }));
        return section;
    }

    if (!isAdmin && !getActiveFaction()) {
        section.appendChild(StatusMessage({ type: 'err', text: 'Вам ещё не выдана роль' }));
        return section;
    }

    try {
        const characters = await getCharactersByGame(game.id);
        const players = await getAllPublicPlayers();
        const playerMap = {};
        for (const p of players) playerMap[p.uid] = p;

        const members = characters.map(c => ({
            character: c,
            player: playerMap[c.playerId] || null
        }));

        if (isAdmin) {
            renderAdminView(section, groupByFaction(members), currentUser.uid);
        } else {
            const myFaction = getActiveFaction();
            renderFactionView(section, members.filter(m => m.character.faction === myFaction), myFaction, currentUser.uid);
        }
    } catch (err) {
        section.appendChild(StatusMessage({ type: 'err', text: 'Ошибка загрузки: ' + translateError(err) }));
    }

    return section;
}

function groupByFaction(members) {
    const groups = {};
    for (const key of FACTION_ORDER) groups[key] = [];
    for (const member of members) {
        const faction = member.character.faction;
        const key = faction && FACTION_LABELS[faction] ? faction : '__unassigned';
        groups[key].push(member);
    }
    for (const key of FACTION_ORDER) {
        groups[key].sort((a, b) => (a.character.name || '').localeCompare(b.character.name || '', 'ru'));
    }
    return groups;
}

function renderAdminView(section, grouped, currentUid) {
    const header = createElement('div', { className: 'faction-page__header' });
    header.appendChild(createElement('h1', { className: 'faction-page__title', text: 'Личный состав' }));
    section.appendChild(header);

    for (const faction of FACTION_ORDER) {
        const members = grouped[faction];
        if (members.length === 0) continue;

        const group = createElement('div', { className: 'faction-group' });
        const title = createElement('h2', { className: 'faction-group__title', text: GROUP_LABELS[faction] });
        title.appendChild(createElement('span', { className: 'faction-group__count', text: `${members.length}` }));
        group.appendChild(title);

        const list = createElement('div', { className: 'faction-page__list' });
        for (const member of members) {
            list.appendChild(createMemberCard(member, currentUid));
        }
        group.appendChild(list);
        section.appendChild(group);
    }
}

function renderFactionView(section, members, myFaction, currentUid) {
    const header = createElement('div', { className: 'faction-page__header' });
    header.appendChild(createElement('h1', { className: 'faction-page__title', text: `Фракция: ${FACTION_LABELS[myFaction] || myFaction}` }));
    section.appendChild(header);

    const list = createElement('div', { className: 'faction-page__list' });
    if (members.length === 0) {
        list.appendChild(createElement('p', { className: 'faction-page__empty', text: 'В секции пока никого нет' }));
    } else {
        for (const member of members) list.appendChild(createMemberCard(member, currentUid));
    }
    section.appendChild(list);
}

function createMemberCard(member, currentUid) {
    const { character, player } = member;
    const isCurrent = player && player.uid === currentUid;

    const card = createElement('a', {
        className: `faction-card${isCurrent ? ' faction-card--current' : ''}`,
        attributes: { href: player ? `#/profile?uid=${player.uid}` : '#' }
    });

    const avatar = createAvatar(player?.username || 'agent', character.faction, 'faction-card__avatar', null);
    const info = createElement('div', { className: 'faction-card__info' });

    const nameRow = createElement('div', { className: 'faction-card__name-row' });
    nameRow.appendChild(createElement('span', {
        className: 'faction-card__name',
        text: (character.name || 'Без имени') + (isCurrent ? ' (вы)' : '')
    }));
    if (player) {
        nameRow.appendChild(createElement('span', {
            className: 'faction-card__role',
            text: ROLE_LABELS[player.role] || player.role
        }));
    }
    info.appendChild(nameRow);

    // Игрок (публичное имя) + профессия
    const meta = [player ? (player.displayName || player.username) : '', character.profession || '']
        .filter(Boolean).join(' · ');
    if (meta) {
        info.appendChild(createElement('p', { className: 'faction-card__detail', text: meta }));
    }

    if (character.worldview) {
        info.appendChild(createElement('p', { className: 'faction-card__detail', text: `Мировоззрение: ${character.worldview}` }));
    }

    const accessTags = character.accessTags || [];
    if (accessTags.length) {
        const tagList = createElement('div', { className: 'faction-card__tags' });
        for (const tag of accessTags.slice(0, 3)) {
            tagList.appendChild(Chip({ text: tag, variant: 'access' }));
        }
        if (accessTags.length > 3) {
            tagList.appendChild(Chip({ text: `+${accessTags.length - 3}`, variant: 'default' }));
        }
        info.appendChild(tagList);
    }

    if (character.faction) {
        const badgeRow = createElement('div', { className: 'faction-card__tags' });
        badgeRow.appendChild(FactionBadge({ faction: character.faction, size: 'sm' }));
        info.appendChild(badgeRow);
    }

    card.appendChild(avatar);
    card.appendChild(info);
    return card;
}
