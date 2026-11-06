/**
 * GameEditPage — игра: персонажи и выдача фракций (только master).
 *
 * Роут: #/admin/games/edit?id=...
 *
 * Отображение: данные игрока / ФИ персонажа с переключателем фракции.
 */

import { createElement } from '../utils/dom.js?v=4';
import { store } from '../core/Store.js?v=4';
import { translateError } from '../utils/translateError.js?v=4';
import { getGame, updateGame, activateGame } from '../firebase/gamesService.js?v=4';
import {
    getCharactersByGame,
    getCharacter,
    createCharacter,
    updateCharacter,
    deleteCharacter,
    assignFaction
} from '../firebase/charactersService.js?v=4';
import { getAllPublicPlayers } from '../firebase/publicPlayersService.js?v=4';
import { Button } from '../components/Button.js?v=4';
import { StatusMessage, showMessage } from '../components/StatusMessage.js?v=4';
import { FormField } from '../components/FormField.js?v=4';
import { FACTION_LABELS } from '../utils/profile.js?v=4';

const STATUS_LABELS = { draft: 'Черновик', active: 'Активна', finished: 'Завершена' };

export async function GameEditPage(gameId) {
    const section = createElement('section', { className: 'games-page' });
    const me = store.get('user');

    if (!me || me.role !== 'master') {
        section.appendChild(StatusMessage({ type: 'err', text: 'Только для мастерской' }));
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
        } catch (err) {
            container.innerHTML = '';
            container.appendChild(StatusMessage({ type: 'err', text: 'Ошибка: ' + translateError(err) }));
            return;
        }
        renderPage();
    }

    function playerLabel(uid) {
        const p = players.find(x => x.uid === uid);
        if (!p) return '— игрок не назначен —';
        const name = p.displayName || p.username;
        return `${name} (@${p.username})`;
    }

    function renderPage() {
        container.innerHTML = '';

        const back = Button({ text: '← К играм', variant: 'secondary', size: 'sm', href: '#/admin/games' });
        container.appendChild(back);

        // --- Шапка игры ---
        const head = createElement('div', { className: 'games-page__head' });
        head.appendChild(createElement('h1', { className: 'games-page__title', text: game.name }));
        head.appendChild(createElement('span', {
            className: 'games-page__status games-page__status--' + (game.status || 'draft'),
            text: STATUS_LABELS[game.status] || game.status
        }));
        container.appendChild(head);

        if (game.status === 'active') {
            container.appendChild(createElement('p', {
                className: 'games-page__banner',
                text: 'Игра активна. Назначайте фракции персонажам — игроки увидят их в личном составе.'
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

        // --- Создание персонажа ---
        const createForm = createElement('form', {
            className: 'games-page__create',
            events: { submit: (e) => e.preventDefault() }
        });
        createForm.appendChild(createElement('h2', { className: 'games-page__subtitle', text: 'Новый персонаж' }));

        const playerSelect = createElement('select', { className: 'games-page__select' });
        playerSelect.appendChild(createElement('option', { text: '— игрок не назначен —', attributes: { value: '' } }));
        for (const p of players) {
            playerSelect.appendChild(createElement('option', {
                text: `${p.displayName || p.username} (@${p.username})`,
                attributes: { value: p.uid }
            }));
        }
        const playerField = createElement('div', { className: 'games-page__field' });
        playerField.appendChild(createElement('label', { className: 'games-page__label', text: 'Игрок' }));
        playerField.appendChild(playerSelect);
        createForm.appendChild(playerField);

        createForm.appendChild(FormField({ type: 'text', id: 'char-name', label: 'ФИ персонажа', placeholder: 'Например: Марк Соколов' }));
        createForm.appendChild(FormField({ type: 'text', id: 'char-profession', label: 'Профессия', placeholder: 'Инженер, журналист…' }));

        const msg = StatusMessage({ type: 'ok', text: '', hidden: true });
        createForm.appendChild(Button({ text: 'Добавить персонажа', variant: 'primary', attributes: { type: 'submit' } }));
        createForm.appendChild(msg);

        createForm.addEventListener('submit', async () => {
            const name = createForm.querySelector('#char-name').value.trim();
            if (!name) { showMessage(msg, 'Укажите ФИ персонажа', 'err'); return; }
            try {
                await createCharacter(gameId, {
                    playerId: playerSelect.value || null,
                    name,
                    profession: createForm.querySelector('#char-profession').value.trim()
                });
                await load();
            } catch (err) {
                showMessage(msg, 'Ошибка: ' + translateError(err), 'err');
            }
        });
        container.appendChild(createForm);

        // --- Список персонажей ---
        container.appendChild(createElement('h2', { className: 'games-page__subtitle', text: `Персонажи (${characters.length})` }));

        if (characters.length === 0) {
            container.appendChild(createElement('p', { className: 'games-page__empty', text: 'Персонажей пока нет' }));
            return;
        }

        const list = createElement('div', { className: 'games-page__characters' });
        for (const character of characters) {
            list.appendChild(createCharacterCard(character));
        }
        container.appendChild(list);
    }

    function createCharacterCard(character) {
        const card = createElement('div', {
            className: 'games-page__character' + (expanded.has(character.id) ? ' games-page__character--open' : '')
        });

        // Строка: игрок / персонаж / фракция
        const row = createElement('div', { className: 'games-page__character-row' });

        const info = createElement('div', { className: 'games-page__character-info' });
        info.appendChild(createElement('div', { className: 'games-page__character-name', text: character.name || 'Без имени' }));
        info.appendChild(createElement('div', {
            className: 'games-page__character-player',
            text: 'Игрок: ' + playerLabel(character.playerId)
        }));
        if (character.profession) {
            info.appendChild(createElement('div', { className: 'games-page__character-prof', text: character.profession }));
        }
        row.appendChild(info);

        // Переключатель фракции
        const factionWrap = createElement('div', { className: 'games-page__character-faction' });
        factionWrap.appendChild(createElement('span', { className: 'games-page__label', text: 'Фракция' }));
        const factionSelect = createElement('select', {
            className: 'games-page__select games-page__select--faction'
        });
        factionSelect.appendChild(createElement('option', { text: '— не выдана —', attributes: { value: '' } }));
        for (const f of ['red', 'blue', 'purple']) {
            const opt = createElement('option', { text: FACTION_LABELS[f], attributes: { value: f } });
            if (character.faction === f) opt.selected = true;
            factionSelect.appendChild(opt);
        }
        factionSelect.addEventListener('change', async () => {
            try {
                await assignFaction(character.id, factionSelect.value || null);
                await load();
            } catch (err) {
                alert('Ошибка: ' + translateError(err));
            }
        });
        factionWrap.appendChild(factionSelect);
        row.appendChild(factionWrap);

        const actions = createElement('div', { className: 'games-page__character-actions' });
        actions.appendChild(Button({
            text: expanded.has(character.id) ? 'Свернуть' : 'Править',
            variant: 'secondary',
            size: 'sm',
            onClick: () => {
                if (expanded.has(character.id)) expanded.delete(character.id);
                else expanded.add(character.id);
                renderPage();
            }
        }));
        actions.appendChild(Button({
            text: 'Удалить',
            variant: 'danger',
            size: 'sm',
            onClick: async () => {
                if (!confirm(`Удалить персонажа «${character.name}»?`)) return;
                try { await deleteCharacter(character.id); expanded.delete(character.id); await load(); }
                catch (err) { alert('Ошибка: ' + translateError(err)); }
            }
        }));
        row.appendChild(actions);

        card.appendChild(row);

        if (expanded.has(character.id)) {
            card.appendChild(buildEditor(character));
        }

        return card;
    }

    function buildEditor(character) {
        const form = createElement('div', { className: 'games-page__character-editor' });

        const playerSel = createElement('select', { className: 'games-page__select' });
        playerSel.appendChild(createElement('option', { text: '— игрок не назначен —', attributes: { value: '' } }));
        for (const p of players) {
            const opt = createElement('option', {
                text: `${p.displayName || p.username} (@${p.username})`,
                attributes: { value: p.uid }
            });
            if (character.playerId === p.uid) opt.selected = true;
            playerSel.appendChild(opt);
        }
        form.appendChild(labelled('Игрок', playerSel));

        const inputs = {
            name: inlineInput(character.name, 'ФИ персонажа'),
            profession: inlineInput(character.profession, 'Профессия'),
            age: inlineInput(character.age ?? '', 'Возраст', 'number'),
            worldview: inlineInput(character.worldview, 'Мировоззрение'),
            about: inlineTextarea(character.about, 'О персонаже'),
            languages: inlineInput((character.languages || []).join(', '), 'common, red…'),
            accessTags: inlineInput((character.accessTags || []).join(', '), 'Грифы через запятую'),
            hiddenTags: inlineInput((character.hiddenTags || []).join(', '), 'Секретные грифы'),
            factionAccessTags: inlineInput((character.factionAccessTags || []).join(', '), 'Субтеги (техник_к_0)')
        };

        for (const [key, label] of Object.entries({
            name: 'ФИ персонажа',
            profession: 'Профессия',
            age: 'Возраст',
            worldview: 'Мировоззрение',
            about: 'О персонаже',
            languages: 'Языки',
            accessTags: 'Грифы доступа',
            hiddenTags: 'Секретные грифы',
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
                    playerId: playerSel.value || null,
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

        form.appendChild(saveBtn);
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
