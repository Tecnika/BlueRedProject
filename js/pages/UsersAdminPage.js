/**
 * UsersAdminPage — список игроков с реальными данными (только master).
 *
 * Роут: #/admin/users
 * Показывает PII (контакт, аллергии, медпоказания), роль и персонажа.
 * Управление ролями игротехника.
 */

import { createElement } from '../utils/dom.js?v=18';
import { store } from '../core/Store.js?v=18';
import { createAvatar } from '../core/Avatar.js?v=18';
import { getCollection } from '../firebase/dbService.js?v=18';
import { getAllPublicPlayers } from '../firebase/publicPlayersService.js?v=18';
import { setUserRole, setRadioRoom, getPlayerDisplayName } from '../firebase/authService.js?v=18';
import { createRecipientCode } from '../firebase/radioService.js?v=18';
import { translateError } from '../utils/translateError.js?v=18';
import { Button } from '../components/Button.js?v=18';
import { StatusMessage } from '../components/StatusMessage.js?v=18';
import { FactionBadge } from '../components/FactionBadge.js?v=18';
import { ROLE_LABELS } from '../utils/constants.js?v=18';

export function UsersAdminPage() {
    const section = createElement('section', { className: 'users-admin-page' });
    const me = store.get('user');

    if (!me || me.role !== 'master') {
        section.appendChild(StatusMessage({ type: 'err', text: 'Только для мастерской' }));
        return section;
    }

    const container = createElement('div', { className: 'users-admin-page__container' });
    container.appendChild(createElement('h1', { className: 'users-admin-page__title', text: 'Игроки' }));
    container.appendChild(createElement('p', {
        className: 'users-admin-page__desc',
        text: 'Реальные данные игроков. Видны только владельцу и администрации.'
    }));
    container.appendChild(Button({ text: 'В мастерскую', icon: 'arrow_back', variant: 'secondary', size: 'sm', href: '#/admin' }));

    const search = createElement('input', {
        className: 'users-admin-page__search',
        attributes: { type: 'search', placeholder: 'Поиск по имени / позывному', autocomplete: 'off', 'aria-label': 'Поиск игроков' }
    });
    const listEl = createElement('div', { className: 'users-admin-page__list', text: 'Загрузка...' });

    container.appendChild(search);
    container.appendChild(listEl);
    section.appendChild(container);

    let allUsers = [];
    let publicMap = {};

    async function load() {
        try {
            const [users, publicPlayers] = await Promise.all([
                getCollection('users'),
                getAllPublicPlayers()
            ]);
            publicMap = {};
            for (const p of publicPlayers) publicMap[p.uid] = p;
            allUsers = users.sort((a, b) =>
                (getPlayerDisplayName(a) || '').localeCompare(getPlayerDisplayName(b) || '', 'ru'));
        } catch (err) {
            listEl.textContent = 'Ошибка загрузки: ' + translateError(err);
            return;
        }
        render();
    }

    function render() {
        const q = search.value.trim().toLowerCase();
        const filtered = allUsers.filter(u =>
            !q
            || (getPlayerDisplayName(u) || '').toLowerCase().includes(q)
            || ((u.username || '').toLowerCase().includes(q))
        );

        listEl.innerHTML = '';
        if (filtered.length === 0) {
            listEl.appendChild(createElement('p', { className: 'users-admin-page__empty', text: 'Никто не найден' }));
            return;
        }
        for (const user of filtered) {
            listEl.appendChild(createUserCard(user));
        }
    }

    search.addEventListener('input', () => render());

    function createUserCard(user) {
        const p = user.player || {};
        const pub = publicMap[user.id] || {};
        const isSelf = user.id === me.uid;

        const card = createElement('div', { className: 'users-admin-page__card' });

        const head = createElement('div', { className: 'users-admin-page__card-head' });
        head.appendChild(createAvatar(user.username, pub.faction || null, 'users-admin-page__avatar', null));

        const identity = createElement('div', { className: 'users-admin-page__identity' });
        identity.appendChild(createElement('div', { className: 'users-admin-page__name', text: getPlayerDisplayName(user) || user.username }));
        identity.appendChild(createElement('div', { className: 'users-admin-page__username', text: '@' + user.username }));
        identity.appendChild(createElement('span', {
            className: 'users-admin-page__role users-admin-page__role--' + user.role,
            text: ROLE_LABELS[user.role] || user.role
        }));
        head.appendChild(identity);

        if (pub.faction) {
            const badges = createElement('div', { className: 'users-admin-page__badges' });
            badges.appendChild(FactionBadge({ faction: pub.faction, size: 'sm' }));
            if (pub.characterName) {
                badges.appendChild(createElement('span', { className: 'users-admin-page__character', text: pub.characterName }));
            }
            head.appendChild(badges);
        }

        card.appendChild(head);

        const data = createElement('div', { className: 'users-admin-page__data' });
        data.appendChild(dataRow('Контакт', p.contact));
        data.appendChild(dataRow('Контактное лицо', [p.emergencyName, p.emergencyRelation, p.emergencyContact].filter(Boolean).join(' · ')));
        data.appendChild(dataRow('Аллергии', p.allergies));
        data.appendChild(dataRow('Медпоказания', p.medical));
        card.appendChild(data);

        const actions = createElement('div', { className: 'users-admin-page__actions' });

        // Радиорубка: аккаунт-терминал для фракции
        if (user.role !== 'master') {
            const radioWrap = createElement('div', { className: 'users-admin-page__radio' });
            radioWrap.appendChild(createElement('span', { className: 'users-admin-page__radio-label', text: 'Радиорубка' }));
            const radioSelect = createElement('select', {
                className: 'users-admin-page__radio-select',
                attributes: { 'aria-label': 'Фракция радиорубки' }
            });
            for (const [value, label] of [['', '—'], ['red', 'Красные'], ['blue', 'Синие'], ['purple', 'Фиолетовые']]) {
                const option = createElement('option', { text: label, attributes: { value } });
                if ((user.radioFaction || '') === value) option.selected = true;
                radioSelect.appendChild(option);
            }
            radioSelect.addEventListener('change', async () => {
                try {
                    await setRadioRoom(user.id, radioSelect.value || null);
                    await load();
                } catch (err) {
                    alert('Ошибка: ' + translateError(err));
                }
            });
            radioWrap.appendChild(radioSelect);

            const codeBtn = Button({
                text: 'Код получателя',
                icon: 'vpn_key',
                variant: 'secondary',
                size: 'sm',
                onClick: async () => {
                    try {
                        const faction = publicMap[user.id]?.faction || user.radioFaction || null;
                        const result = await createRecipientCode(
                            { uid: user.id, name: getPlayerDisplayName(user) || user.username },
                            faction
                        );
                        alert(`Код получателя: ${result.code}\nДействует до ${new Date(result.expiresAt).toLocaleString('ru-RU')}`);
                    } catch (err) {
                        alert('Ошибка: ' + translateError(err));
                    }
                }
            });
            radioWrap.appendChild(codeBtn);
            actions.appendChild(radioWrap);
        }

        if (user.role === 'master') {
            // Права мастера через эту страницу не выдаются и не снимаются
            actions.appendChild(Button({ text: 'Мастер', variant: 'primary', size: 'sm', disabled: true }));
        } else {
            actions.appendChild(Button({
                text: user.role === 'igrotech' ? 'Снять игротехника' : 'Дать роль техника',
                variant: user.role === 'igrotech' ? 'primary' : 'secondary',
                size: 'sm',
                disabled: isSelf,
                attributes: { title: isSelf ? 'Нельзя менять права себе' : '' },
                onClick: async () => {
                    const next = user.role === 'igrotech' ? 'player' : 'igrotech';
                    if (!confirm('Изменить права игротехника для ' + (getPlayerDisplayName(user) || user.username) + '?')) return;
                    try {
                        await setUserRole(user.id, next);
                        await load();
                    } catch (err) {
                        alert('Ошибка: ' + translateError(err));
                    }
                }
            }));
        }
        card.appendChild(actions);

        return card;
    }

    function dataRow(label, value) {
        const row = createElement('div', { className: 'users-admin-page__data-row' });
        row.appendChild(createElement('span', { className: 'users-admin-page__data-label', text: label }));
        row.appendChild(createElement('span', { className: 'users-admin-page__data-value', text: value || '—' }));
        return row;
    }

    load();
    return section;
}
