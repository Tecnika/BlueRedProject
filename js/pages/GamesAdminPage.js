/**
 * GamesAdminPage — список игр (только master).
 *
 * Роут: #/admin/games
 * Создание игры, активация/завершение/удаление, переход к персонажам.
 */

import { createElement } from '../utils/dom.js?v=4';
import { store } from '../core/Store.js?v=4';
import { translateError } from '../utils/translateError.js?v=4';
import { getAllGames, createGame, deleteGame, activateGame, finishGame } from '../firebase/gamesService.js?v=4';
import { Button } from '../components/Button.js?v=4';
import { StatusMessage, showMessage, hideMessage } from '../components/StatusMessage.js?v=4';
import { FormField } from '../components/FormField.js?v=4';

const STATUS_LABELS = { draft: 'Черновик', active: 'Активна', finished: 'Завершена' };

export function GamesAdminPage() {
    const section = createElement('section', { className: 'games-page' });
    const me = store.get('user');

    if (!me || me.role !== 'master') {
        section.appendChild(StatusMessage({ type: 'err', text: 'Только для мастерской' }));
        return section;
    }

    const container = createElement('div', { className: 'games-page__container' });
    container.appendChild(createElement('h1', { className: 'games-page__title', text: 'Игры' }));
    container.appendChild(createElement('p', {
        className: 'games-page__desc',
        text: 'Создайте игру, добавьте персонажей и активируйте игру, чтобы выдать фракции.'
    }));

    container.appendChild(Button({ text: '← В мастерскую', variant: 'secondary', size: 'sm', href: '#/admin' }));

    // --- Создание игры ---
    const createForm = createElement('form', {
        className: 'games-page__create',
        events: { submit: (e) => e.preventDefault() }
    });
    createForm.appendChild(FormField({ type: 'text', id: 'game-name', label: 'Название игры', placeholder: 'Например: Осень 2026' }));
    createForm.appendChild(FormField({ type: 'text', id: 'game-date', label: 'Дата', placeholder: '01.11.2026' }));

    const msg = StatusMessage({ type: 'ok', text: '', hidden: true });
    const createBtn = Button({ text: 'Создать игру', variant: 'primary', attributes: { type: 'submit' } });
    createForm.appendChild(createBtn);
    createForm.appendChild(msg);

    createForm.addEventListener('submit', async () => {
        const name = createForm.querySelector('#game-name').value.trim();
        if (!name) {
            showMessage(msg, 'Укажите название', 'err');
            return;
        }
        try {
            await createGame({ name, startDate: createForm.querySelector('#game-date').value.trim() });
            createForm.querySelector('#game-name').value = '';
            createForm.querySelector('#game-date').value = '';
            await load();
            showMessage(msg, 'Игра создана', 'ok');
        } catch (err) {
            showMessage(msg, 'Ошибка: ' + translateError(err), 'err');
        }
    });
    container.appendChild(createForm);

    const listEl = createElement('div', { className: 'games-page__list', text: 'Загрузка...' });
    container.appendChild(listEl);
    section.appendChild(container);

    async function load() {
        try {
            const games = await getAllGames();
            listEl.innerHTML = '';
            if (games.length === 0) {
                listEl.appendChild(createElement('p', { className: 'games-page__empty', text: 'Игр пока нет' }));
                return;
            }
            for (const game of games) {
                listEl.appendChild(createGameCard(game));
            }
        } catch (err) {
            listEl.textContent = 'Ошибка загрузки: ' + translateError(err);
        }
    }

    function createGameCard(game) {
        const card = createElement('div', {
            className: 'games-page__card games-page__card--' + (game.status || 'draft')
        });

        const info = createElement('div', { className: 'games-page__info' });
        info.appendChild(createElement('div', { className: 'games-page__name', text: game.name }));
        const meta = createElement('div', { className: 'games-page__meta' });
        meta.appendChild(createElement('span', {
            className: 'games-page__status games-page__status--' + (game.status || 'draft'),
            text: STATUS_LABELS[game.status] || game.status
        }));
        if (game.startDate) meta.appendChild(createElement('span', { text: game.startDate }));
        info.appendChild(meta);
        card.appendChild(info);

        const actions = createElement('div', { className: 'games-page__actions' });
        actions.appendChild(Button({ text: 'Персонажи', variant: 'secondary', size: 'sm', href: `#/admin/games/edit?id=${game.id}` }));

        if (game.status !== 'active') {
            actions.appendChild(Button({
                text: 'Активировать',
                variant: 'primary',
                size: 'sm',
                onClick: async () => {
                    if (!confirm(`Активировать игру «${game.name}»? Фракции будут выданы по персонажам.`)) return;
                    try { await activateGame(game.id); load(); }
                    catch (err) { alert('Ошибка: ' + translateError(err)); }
                }
            }));
        } else {
            actions.appendChild(Button({ text: 'Активна', variant: 'primary', size: 'sm', disabled: true }));
        }

        if (game.status === 'active') {
            actions.appendChild(Button({
                text: 'Завершить',
                variant: 'secondary',
                size: 'sm',
                onClick: async () => {
                    if (!confirm(`Завершить игру «${game.name}»?`)) return;
                    try { await finishGame(game.id); load(); }
                    catch (err) { alert('Ошибка: ' + translateError(err)); }
                }
            }));
        }

        actions.appendChild(Button({
            text: 'Удалить',
            variant: 'danger',
            size: 'sm',
            onClick: async () => {
                if (!confirm(`Удалить игру «${game.name}»? Персонажи останутся в базе.`)) return;
                try { await deleteGame(game.id); load(); }
                catch (err) { alert('Ошибка: ' + translateError(err)); }
            }
        }));

        card.appendChild(actions);
        return card;
    }

    hideMessage(msg);
    load();
    return section;
}
