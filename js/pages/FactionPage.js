import { createElement } from '../utils/dom.js?v=12';
import { translateError } from '../utils/translateError.js?v=12';
import { store } from '../core/Store.js?v=12';
import { createAvatar } from '../core/Avatar.js?v=12';
import { getCharactersByGame } from '../firebase/charactersService.js?v=12';
import { getAllPublicPlayers } from '../firebase/publicPlayersService.js?v=12';
import { getAllComments, addComment } from '../firebase/factionCommentsService.js?v=12';
import { FactionBadge } from '../components/FactionBadge.js?v=12';
import { Icon } from '../components/Icon.js?v=12';
import { StatusMessage, showMessage } from '../components/StatusMessage.js?v=12';
import { ViewModeToggle, isAdminMode } from '../components/ViewModeToggle.js?v=12';
import { getActiveFaction, getActiveGame, FACTION_LABELS } from '../utils/profile.js?v=12';
import { ROLE_LABELS } from '../utils/constants.js?v=12';

const FACTION_ORDER = ['purple', 'blue', 'red', '__unassigned'];
const GROUP_LABELS = { ...FACTION_LABELS, __unassigned: 'Не распределены' };

export async function FactionPage() {
    const section = createElement('section', { className: 'faction-page' });
    const user = store.get('user');

    if (!user) {
        section.appendChild(StatusMessage({ type: 'err', text: 'Требуется идентификация' }));
        return section;
    }

    const adminMode = isAdminMode(user);
    const fullView = user.role === 'igrotech' || adminMode;
    const game = getActiveGame();

    const container = createElement('div', { className: 'faction-page__container' });

    const header = createElement('div', { className: 'faction-page__header' });
    // Аккаунт радиорубки смотрит состав своей фракции, даже без персонажа
    const myFaction = getActiveFaction() || user.radioFaction || null;
    header.appendChild(createElement('h1', {
        className: 'faction-page__title',
        text: fullView ? 'Фракции' : (myFaction ? `Фракция: ${FACTION_LABELS[myFaction] || myFaction}` : 'Фракции')
    }));
    const toggle = ViewModeToggle(user);
    if (toggle) header.appendChild(toggle);
    container.appendChild(header);
    section.appendChild(container);

    if (!game) {
        container.appendChild(StatusMessage({ type: 'ok', text: 'Игра ещё не начата' }));
        return section;
    }

    if (!fullView && !myFaction) {
        container.appendChild(StatusMessage({ type: 'err', text: 'Вам ещё не выдана роль' }));
        return section;
    }

    try {
        const [characters, players, commentsMap] = await Promise.all([
            getCharactersByGame(game.id),
            getAllPublicPlayers(),
            getAllComments()
        ]);

        const playerMap = {};
        for (const p of players) playerMap[p.uid] = p;

        // Аккаунты радиорубок не показываем в личном составе фракции
        const roster = characters.filter(c => !playerMap[c.playerId]?.radioFaction);

        const visible = fullView
            ? roster
            : roster.filter(c => c.faction === myFaction);

        if (fullView) {
            for (const faction of FACTION_ORDER) {
                const members = visible.filter(c => {
                    const key = c.faction && FACTION_LABELS[c.faction] ? c.faction : '__unassigned';
                    return key === faction;
                });
                if (members.length === 0) continue;
                container.appendChild(renderGroup(faction, members, playerMap, commentsMap, user, fullView));
            }
        } else {
            container.appendChild(renderGroup(myFaction, visible, playerMap, commentsMap, user, fullView));
        }
    } catch (err) {
        container.appendChild(StatusMessage({ type: 'err', text: 'Ошибка загрузки: ' + translateError(err) }));
    }

    return section;
}

function renderGroup(faction, members, playerMap, commentsMap, user, fullView) {
    const group = createElement('div', { className: 'faction-group' });

    const title = createElement('h2', { className: 'faction-group__title', text: GROUP_LABELS[faction] || faction });
    title.appendChild(createElement('span', { className: 'faction-group__count', text: String(members.length) }));
    group.appendChild(title);

    const list = createElement('div', { className: 'faction-page__list' });
    for (const character of members) {
        list.appendChild(createMemberCard(character, playerMap[character.playerId] || null, commentsMap, user, fullView));
    }
    group.appendChild(list);

    return group;
}

function createMemberCard(character, player, commentsMap, user, fullView) {
    const isSelf = player && player.uid === user.uid;
    const targetId = character.playerId || character.id;
    const comments = commentsMap[targetId] || [];

    const card = createElement('div', {
        className: 'faction-card' + (isSelf ? ' faction-card--current' : '')
    });

    card.appendChild(createAvatar(player?.username || 'agent', character.faction, 'faction-card__avatar', null));

    const info = createElement('div', { className: 'faction-card__info' });

    const nameRow = createElement('div', { className: 'faction-card__name-row' });
    const canOpenProfile = isSelf || fullView;
    const nameText = character.name || 'Без имени';

    if (canOpenProfile && player) {
        nameRow.appendChild(createElement('a', {
            className: 'faction-card__name faction-card__name--link',
            text: nameText + (isSelf ? ' (вы)' : ''),
            attributes: { href: `#/profile?uid=${player.uid}` }
        }));
    } else {
        nameRow.appendChild(createElement('span', {
            className: 'faction-card__name',
            text: nameText + (isSelf ? ' (вы)' : '')
        }));
    }

    if (player) {
        nameRow.appendChild(createElement('span', {
            className: 'faction-card__role',
            text: ROLE_LABELS[player.role] || player.role
        }));
    }
    info.appendChild(nameRow);

    // Настоящее имя игрока — только игротеху и мастеру-админу
    if (fullView && player) {
        info.appendChild(createElement('div', {
            className: 'faction-card__real-name',
            text: `Игрок: ${player.displayName || player.username}`
        }));
    }

    if (character.profession) {
        info.appendChild(createElement('div', {
            className: 'faction-card__detail',
            text: `Должность: ${character.profession}`
        }));
    }
    if (character.worldview) {
        info.appendChild(createElement('div', {
            className: 'faction-card__detail',
            text: `Мировоззрение: ${character.worldview}`
        }));
    }

    card.appendChild(info);

    // Комментарии о человеке
    const commentsWrap = createElement('div', { className: 'faction-card__comments-wrap' });
    const toggleBtn = createElement('button', {
        className: 'faction-card__comments-toggle',
        attributes: { type: 'button' }
    });
    toggleBtn.appendChild(Icon({ name: 'comment', size: 'sm' }));
    const toggleLabel = createElement('span', { text: `Комментарии (${comments.length})` });
    toggleBtn.appendChild(toggleLabel);
    commentsWrap.appendChild(toggleBtn);

    const commentsBox = createElement('div', { className: 'faction-card__comments', attributes: { hidden: '' } });
    const listEl = createElement('div', { className: 'faction-card__comments-list' });
    const msg = StatusMessage({ type: 'ok', text: '', hidden: true });

    function renderList(items) {
        listEl.innerHTML = '';
        if (items.length === 0) {
            listEl.appendChild(createElement('div', {
                className: 'faction-card__comments-empty',
                text: 'Пока нет комментариев'
            }));
            return;
        }
        for (const item of items) {
            const row = createElement('div', { className: 'faction-card__comment' });
            row.appendChild(createElement('span', {
                className: 'faction-card__comment-author',
                text: item.authorName || 'Агент'
            }));
            row.appendChild(createElement('span', {
                className: 'faction-card__comment-text',
                text: item.text
            }));
            listEl.appendChild(row);
        }
    }
    renderList(comments);

    const textarea = createElement('textarea', {
        className: 'faction-card__comment-input',
        attributes: { rows: 2, placeholder: 'Комментарий о человеке...', 'aria-label': 'Комментарий о человеке' }
    });
    const sendBtn = createElement('button', {
        className: 'btn btn--secondary btn--sm',
        attributes: { type: 'button' },
        events: {
            click: async () => {
                const text = textarea.value.trim();
                if (!text) { showMessage(msg, 'Введите комментарий', 'err'); return; }
                sendBtn.disabled = true;
                try {
                    const entry = await addComment(targetId, text);
                    commentsMap[targetId] = [...(commentsMap[targetId] || []), entry];
                    renderList(commentsMap[targetId]);
                    toggleLabel.textContent = `Комментарии (${commentsMap[targetId].length})`;
                    textarea.value = '';
                    showMessage(msg, 'Комментарий добавлен', 'ok');
                } catch (err) {
                    showMessage(msg, 'Ошибка: ' + translateError(err), 'err');
                } finally {
                    sendBtn.disabled = false;
                }
            }
        }
    });
    sendBtn.appendChild(Icon({ name: 'send', size: 'sm' }));
    sendBtn.appendChild(createElement('span', { text: 'Отправить' }));

    commentsBox.appendChild(listEl);
    commentsBox.appendChild(textarea);
    commentsBox.appendChild(sendBtn);
    commentsBox.appendChild(msg);
    commentsWrap.appendChild(commentsBox);

    toggleBtn.addEventListener('click', () => {
        commentsBox.hidden = !commentsBox.hidden;
    });

    card.appendChild(commentsWrap);

    if (character.faction) {
        const badgeRow = createElement('div', { className: 'faction-card__badge' });
        badgeRow.appendChild(FactionBadge({ faction: character.faction, size: 'sm' }));
        card.appendChild(badgeRow);
    }

    return card;
}
