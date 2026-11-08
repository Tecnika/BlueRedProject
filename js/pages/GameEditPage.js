/**
 * GameEditPage — игра: игроки, пары персонажей и активация фракции (роль master).
 *
 * Роут: #/admin/games/edit?id=...
 *
 * Для обычного игрока создаются красная и синяя версии персонажа.
 * Мастеру или игротеху создаётся фиолетовый персонаж — они всегда фиолетовые.
 */

import { createElement } from '../utils/dom.js?v=25';
import { store } from '../core/Store.js?v=25';
import { translateError } from '../utils/translateError.js?v=25';
import { getGame, updateGame, activateGame } from '../firebase/gamesService.js?v=25';
import {
    getCharactersByGame,
    updateCharacter,
    deleteCharacter,
    isActiveCharacter,
    activateCharacterVariant,
    ensurePlayerCharacters
} from '../firebase/charactersService.js?v=25';
import { getAllPublicPlayers } from '../firebase/publicPlayersService.js?v=25';
import { getCollection } from '../firebase/dbService.js?v=25';
import { Button } from '../components/Button.js?v=25';
import { StatusMessage, showMessage } from '../components/StatusMessage.js?v=25';
import { FactionBadge } from '../components/FactionBadge.js?v=25';
import { createAvatar } from '../core/Avatar.js?v=25';
import { GAME_STATUS_LABELS, ROLE_LABELS } from '../utils/constants.js?v=25';

const VARIANT_LABELS = {
    red: 'Красная фракция',
    blue: 'Синяя фракция',
    purple: 'Фиолетовая фракция'
};

const ACTIVATE_LABELS = {
    red: 'Активировать красную фракцию',
    blue: 'Активировать синюю фракцию'
};

export async function GameEditPage(gameId) {
    const section = createElement('section', { className: 'games-page' });
    const me = store.get('user');

    if (!me || me.role !== 'master') {
        section.appendChild(StatusMessage({ type: 'err', text: 'Доступ только мастерам' }));
        return section;
    }
    if (!gameId) {
        section.appendChild(StatusMessage({ type: 'err', text: 'Не указана игра' }));
        return section;
    }

    const container = createElement('div', { className: 'games-page__container' });
    section.appendChild(container);

    let game = null;
    let characters = [];
    let players = [];
    let roleByUser = new Map();
    const expanded = new Set();

    async function load() {
        try {
            game = await getGame(gameId);
            if (!game) {
                container.innerHTML = '';
                container.appendChild(StatusMessage({ type: 'err', text: 'Игра не найдена' }));
                return;
            }
            characters = await getCharactersByGame(gameId);
            players = await getAllPublicPlayers();
            try {
                const users = await getCollection('users');
                roleByUser = new Map(users.map(u => [u.id, u.role]));
            } catch (e) {
                roleByUser = new Map();
            }
        } catch (err) {
            container.innerHTML = '';
            container.appendChild(StatusMessage({ type: 'err', text: 'Ошибка: ' + translateError(err) }));
            return;
        }
        renderPage();
    }

    function playerLabel(uid) {
        const p = players.find(x => x.uid === uid);
        if (!p) return '— игрок не найден —';
        return `${p.displayName || p.username} (@${p.username})`;
    }

    function playerRole(player) {
        return roleByUser.get(player.uid) || player.role || 'player';
    }

    function variantOf(character) {
        return character.variant || character.faction || null;
    }

    function renderPage() {
        container.innerHTML = '';

        const back = Button({ text: 'К списку игр', icon: 'arrow_back', variant: 'secondary', size: 'sm', href: '#/admin/games' });
        container.appendChild(back);

        // --- шапка игры ---
        const head = createElement('div', { className: 'games-page__head' });
        head.appendChild(createElement('h1', { className: 'games-page__title', text: game.name }));
        head.appendChild(createElement('span', {
            className: 'games-page__status games-page__status--' + (game.status || 'draft'),
            text: GAME_STATUS_LABELS[game.status] || game.status
        }));
        container.appendChild(head);

        const editRow = createElement('div', { className: 'games-page__edit-row' });
        const nameInput = createElement('input', {
            className: 'games-page__input',
            attributes: { type: 'text', value: game.name || '', placeholder: 'Название игры' }
        });
        const dateInput = createElement('input', {
            className: 'games-page__input games-page__input--date',
            attributes: { type: 'text', value: game.startDate || '', placeholder: 'Дата' }
        });
        editRow.appendChild(labelled('Название', nameInput));
        editRow.appendChild(labelled('Дата', dateInput));
        editRow.appendChild(Button({
            text: 'Сохранить',
            variant: 'secondary',
            size: 'sm',
            onClick: async () => {
                try {
                    await updateGame(gameId, {
                        name: nameInput.value.trim() || game.name,
                        startDate: dateInput.value.trim()
                    });
                    await load();
                } catch (err) {
                    alert('Ошибка: ' + translateError(err));
                }
            }
        }));
        container.appendChild(editRow);

        if (game.status === 'active') {
            container.appendChild(createElement('p', {
                className: 'games-page__banner',
                text: 'Игра активна. Активированные персонажи определяют фракцию игроков.'
            }));
        } else {
            container.appendChild(Button({
                text: 'Активировать игру',
                variant: 'primary',
                onClick: async () => {
                    if (!confirm(`Активировать игру «${game.name}»?`)) return;
                    try { await activateGame(gameId); await load(); }
                    catch (err) { alert('Ошибка: ' + translateError(err)); }
                }
            }));
        }

        // --- группировка по игрокам ---
        const byPlayer = new Map();
        for (const character of characters) {
            if (!character.playerId) continue;
            if (!byPlayer.has(character.playerId)) byPlayer.set(character.playerId, []);
            byPlayer.get(character.playerId).push(character);
        }

        container.appendChild(createElement('h2', {
            className: 'games-page__subtitle',
            text: `Игроки в игре (${byPlayer.size})`
        }));
        container.appendChild(createElement('p', {
            className: 'games-page__desc',
            text: 'Обычному игроку создаются красная и синяя версии персонажа. Мастеру и игротеху — фиолетовая.'
        }));

        container.appendChild(buildAddPlayerForm(byPlayer));

        if (byPlayer.size === 0) {
            container.appendChild(createElement('p', {
                className: 'games-page__empty',
                text: 'В игре пока нет игроков'
            }));
            return;
        }

        const list = createElement('div', { className: 'games-page__players' });
        const entries = [...byPlayer.entries()].sort((a, b) =>
            playerLabel(a[0]).localeCompare(playerLabel(b[0]), 'ru')
        );
        for (const [uid, listOfCharacters] of entries) {
            list.appendChild(renderPlayerCard(uid, listOfCharacters));
        }
        container.appendChild(list);
    }

    function buildAddPlayerForm(byPlayer) {
        const box = createElement('form', { className: 'games-page__add-player' });
        box.appendChild(createElement('div', { className: 'games-page__add-title', text: 'Добавить игрока' }));

        const candidates = players.filter(p => p.uid && !p.radioFaction);
        const select = createElement('select', {
            className: 'games-page__select',
            attributes: { 'aria-label': 'Игрок' }
        });

        if (candidates.length === 0) {
            box.appendChild(createElement('p', { className: 'games-page__empty', text: 'Нет доступных игроков' }));
            return box;
        }

        for (const p of candidates) {
            select.appendChild(createElement('option', {
                text: `${p.displayName || p.username} (@${p.username})${byPlayer.has(p.uid) ? ' — уже в игре' : ''}`,
                attributes: { value: p.uid }
            }));
        }

        const msg = StatusMessage({ type: 'ok', text: '', hidden: true });
        const submit = Button({
            text: 'Добавить в игру',
            icon: 'person_add',
            variant: 'primary',
            attributes: { type: 'submit' }
        });

        box.appendChild(select);
        box.appendChild(submit);
        box.appendChild(msg);

        box.addEventListener('submit', async (event) => {
            event.preventDefault();
            const uid = select.value;
            const player = candidates.find(p => p.uid === uid);
            if (!player) return;
            submit.disabled = true;
            try {
                await ensurePlayerCharacters(gameId, { ...player, role: playerRole(player) });
                showMessage(msg, 'Персонажи созданы. Активируйте нужную фракцию.', 'ok');
                await load();
            } catch (err) {
                showMessage(msg, 'Ошибка: ' + translateError(err), 'err');
                submit.disabled = false;
            }
        });

        return box;
    }

    function renderPlayerCard(uid, listOfCharacters) {
        const player = players.find(p => p.uid === uid) || {
            uid,
            username: '—',
            displayName: playerLabel(uid),
            role: 'player'
        };
        const role = playerRole(player);
        const staff = role === 'master' || role === 'igrotech';
        const activeChar = staff
            ? listOfCharacters.find(c => variantOf(c) === 'purple' && isActiveCharacter(c))
            : (listOfCharacters.find(c => c.active === true)
                || listOfCharacters.find(c => isActiveCharacter(c)));

        const card = createElement('div', { className: 'games-page__player' + (staff ? ' games-page__player--staff' : '') });

        const head = createElement('div', { className: 'games-page__player-head' });
        const avatarFaction = staff ? 'purple' : (activeChar ? (variantOf(activeChar) || activeChar.faction) : null);
        head.appendChild(createAvatar(
            player.username || player.displayName || 'user',
            avatarFaction,
            'games-page__player-avatar',
            player.gender
        ));
        const info = createElement('div', { className: 'games-page__player-info' });
        info.appendChild(createElement('div', {
            className: 'games-page__player-name',
            text: player.displayName || player.username || 'Игрок'
        }));
        info.appendChild(createElement('div', {
            className: 'games-page__player-meta',
            text: `@${player.username || '—'} · ${ROLE_LABELS[role] || role}`
        }));
        head.appendChild(info);

        const state = createElement('div', { className: 'games-page__player-state' });
        if (activeChar) {
            state.appendChild(FactionBadge({ faction: variantOf(activeChar) || activeChar.faction, size: 'sm' }));
            state.appendChild(createElement('span', { text: 'активен' }));
        } else {
            state.appendChild(createElement('span', { className: 'games-page__player-inactive', text: 'персонаж не активирован' }));
        }
        if (staff) {
            state.appendChild(createElement('span', { className: 'games-page__staff-note', text: 'фиолетовые всегда' }));
        }
        head.appendChild(state);
        card.appendChild(head);

        const variants = createElement('div', { className: 'games-page__variants' });

        if (staff) {
            const purple = listOfCharacters.find(c => variantOf(c) === 'purple');
            variants.appendChild(purple
                ? renderVariant(purple, 'purple', true)
                : renderEmptyVariant('purple', { ...player, role }));
        } else {
            for (const variant of ['red', 'blue']) {
                const character = listOfCharacters.find(c => variantOf(c) === variant);
                variants.appendChild(character
                    ? renderVariant(character, variant, false)
                    : renderEmptyVariant(variant, { ...player, role }));
            }
            for (const character of listOfCharacters) {
                const variant = variantOf(character);
                if (variant && variant !== 'red' && variant !== 'blue') {
                    variants.appendChild(renderVariant(character, variant, false));
                }
            }
        }

        card.appendChild(variants);
        return card;
    }

    function renderVariant(character, variant, staff) {
        const active = isActiveCharacter(character);
        const card = createElement('div', {
            className: [
                'games-page__variant',
                'games-page__variant--' + (variant || 'unknown'),
                active ? 'games-page__variant--active' : ''
            ].filter(Boolean).join(' ')
        });

        const head = createElement('div', { className: 'games-page__variant-head' });
        head.appendChild(FactionBadge({ faction: variant, size: 'sm' }));
        head.appendChild(createElement('span', {
            className: 'games-page__variant-status',
            text: active ? 'Активна' : 'Не активна'
        }));
        card.appendChild(head);

        card.appendChild(createElement('div', {
            className: 'games-page__variant-name',
            text: character.name || 'Без имени'
        }));
        if (character.profession) {
            card.appendChild(createElement('div', {
                className: 'games-page__variant-prof',
                text: character.profession
            }));
        }
        const details = [];
        if (character.age != null && character.age !== '') details.push(`${character.age} лет`);
        if (character.worldview) details.push(character.worldview);
        if (details.length) {
            card.appendChild(createElement('div', {
                className: 'games-page__variant-meta',
                text: details.join(' · ')
            }));
        }

        const actions = createElement('div', { className: 'games-page__variant-actions' });

        if (variant === 'red' || variant === 'blue') {
            actions.appendChild(Button({
                text: active ? 'Фракция активна' : ACTIVATE_LABELS[variant],
                icon: active ? 'check_circle' : 'toggle_on',
                variant: active ? 'secondary' : 'primary',
                size: 'sm',
                disabled: active,
                onClick: async () => {
                    if (!confirm(`${ACTIVATE_LABELS[variant]} для «${character.name || 'персонажа'}»?`)) return;
                    try {
                        await activateCharacterVariant(gameId, character.playerId, variant);
                        await load();
                    } catch (err) {
                        alert('Ошибка: ' + translateError(err));
                    }
                }
            }));
        } else if (staff) {
            actions.appendChild(createElement('span', {
                className: 'games-page__variant-note',
                text: 'Фиолетовые всегда активны'
            }));
        }

        actions.appendChild(Button({
            text: expanded.has(character.id) ? 'Свернуть' : 'Редактировать',
            variant: 'secondary',
            size: 'sm',
            onClick: () => {
                if (expanded.has(character.id)) expanded.delete(character.id);
                else expanded.add(character.id);
                renderPage();
            }
        }));

        card.appendChild(actions);

        if (expanded.has(character.id)) {
            card.appendChild(buildEditor(character));
        }

        return card;
    }

    function renderEmptyVariant(variant, player) {
        const card = createElement('div', {
            className: 'games-page__variant games-page__variant--empty games-page__variant--' + variant
        });
        card.appendChild(FactionBadge({ faction: variant, size: 'sm' }));
        card.appendChild(createElement('div', {
            className: 'games-page__variant-name',
            text: variant === 'purple' ? 'Фиолетовый персонаж не создан' : `${VARIANT_LABELS[variant]} не создана`
        }));
        card.appendChild(Button({
            text: variant === 'purple' ? 'Создать фиолетового' : 'Создать персонажей',
            variant: 'secondary',
            size: 'sm',
            onClick: async () => {
                try {
                    await ensurePlayerCharacters(gameId, player);
                    await load();
                } catch (err) {
                    alert('Ошибка: ' + translateError(err));
                }
            }
        }));
        return card;
    }

    function buildEditor(character) {
        const form = createElement('div', { className: 'games-page__character-editor' });
        form.appendChild(createElement('div', {
            className: 'games-page__editor-title',
            text: `Редактирование: ${character.name || 'персонаж'}`
        }));

        const inputs = {
            name: inlineInput(character.name, 'Имя персонажа'),
            profession: inlineInput(character.profession, 'Профессия'),
            age: inlineInput(character.age ?? '', 'Возраст', 'number'),
            worldview: inlineInput(character.worldview, 'Мировоззрение'),
            about: inlineTextarea(character.about, 'О персонаже'),
            languages: inlineInput((character.languages || []).join(', '), 'common, red…'),
            accessTags: inlineInput((character.accessTags || []).join(', '), 'Доступы через запятую'),
            hiddenTags: inlineInput((character.hiddenTags || []).join(', '), 'Скрытые теги'),
            factionAccessTags: inlineInput((character.factionAccessTags || []).join(', '), 'Составные теги (тег_ф_0)')
        };

        for (const [key, label] of Object.entries({
            name: 'Имя персонажа',
            profession: 'Профессия',
            age: 'Возраст',
            worldview: 'Мировоззрение',
            about: 'О персонаже',
            languages: 'Языки',
            accessTags: 'Доступы',
            hiddenTags: 'Скрытые теги',
            factionAccessTags: 'Доступ к ячейкам'
        })) {
            form.appendChild(labelled(label, inputs[key]));
        }

        const msg = StatusMessage({ type: 'ok', text: '', hidden: true });
        const saveBtn = Button({
            text: 'Сохранить персонажа',
            variant: 'primary',
            size: 'sm',
            onClick: async () => {
                const data = {
                    name: inputs.name.value.trim(),
                    profession: inputs.profession.value.trim(),
                    age: inputs.age.value !== '' ? parseInt(inputs.age.value, 10) : null,
                    worldview: inputs.worldview.value.trim(),
                    about: inputs.about.value.trim(),
                    languages: splitList(inputs.languages.value),
                    accessTags: splitList(inputs.accessTags.value),
                    hiddenTags: splitList(inputs.hiddenTags.value),
                    factionAccessTags: splitList(inputs.factionAccessTags.value)
                };
                try {
                    await updateCharacter(character.id, data);
                    showMessage(msg, 'Сохранено', 'ok');
                    await load();
                } catch (err) {
                    showMessage(msg, 'Ошибка: ' + translateError(err), 'err');
                }
            }
        });

        const deleteBtn = Button({
            text: 'Удалить персонажа',
            variant: 'danger',
            size: 'sm',
            onClick: async () => {
                if (!confirm(`Удалить персонажа «${character.name || 'без имени'}»?`)) return;
                try {
                    await deleteCharacter(character.id);
                    expanded.delete(character.id);
                    await load();
                } catch (err) {
                    alert('Ошибка: ' + translateError(err));
                }
            }
        });

        const footer = createElement('div', { className: 'games-page__editor-footer' });
        footer.appendChild(saveBtn);
        footer.appendChild(deleteBtn);
        form.appendChild(footer);
        form.appendChild(msg);
        return form;
    }

    function labelled(label, control) {
        const field = createElement('div', { className: 'games-page__field' });
        field.appendChild(createElement('label', { className: 'games-page__label', text: label }));
        field.appendChild(control);
        return field;
    }

    function inlineInput(value, placeholder, type = 'text') {
        return createElement('input', {
            className: 'games-page__input',
            attributes: { type, value: value ?? '', placeholder, autocomplete: 'off' }
        });
    }

    function inlineTextarea(value, placeholder) {
        return createElement('textarea', {
            className: 'games-page__textarea',
            text: value || '',
            attributes: { rows: 2, placeholder }
        });
    }

    function splitList(value) {
        return (value || '').split(',').map(t => t.trim()).filter(Boolean);
    }

    await load();
    return section;
}
