import { createElement } from '../utils/dom.js?v=12';
import { store } from '../core/Store.js?v=12';
import { getAllDocuments } from '../firebase/documentsService.js?v=12';
import { getAccessibleVersions, groupByNumber, LEVEL_LABELS } from '../domain/documents.js?v=12';
import { translateError } from '../utils/translateError.js?v=12';
import { Button } from '../components/Button.js?v=12';
import { FactionBadge } from '../components/FactionBadge.js?v=12';
import { StatusMessage } from '../components/StatusMessage.js?v=12';
import { ViewModeToggle, isAdminMode } from '../components/ViewModeToggle.js?v=12';

export async function DocumentsListPage() {
    const section = createElement('section', { className: 'documents-list-page' });
    const user = store.get('user');

    if (!user) {
        section.appendChild(StatusMessage({ type: 'err', text: 'Требуется идентификация' }));
        return section;
    }

    const adminMode = isAdminMode(user);
    const isMaster = adminMode;
    const toggle = ViewModeToggle(user);

    try {
        const all = await getAllDocuments();
        const viewer = { ...user, role: adminMode ? 'master' : 'player' };
        const accessible = adminMode
            ? all
            : getAccessibleVersions(all, viewer, store.get('character') || null);

        const groups = groupByNumber(accessible);
        const numbers = [...groups.keys()].sort();

        const container = createElement('div', { className: 'documents-list-page__container' });
        const header = createElement('div', { className: 'documents-list-page__header' });

        header.appendChild(createElement('h1', { className: 'documents-list-page__title', text: 'Файлы' }));

        const actions = createElement('div', { className: 'documents-list-page__actions' });
        if (isMaster) actions.appendChild(Button({ text: 'Создать', icon: 'add', href: '#/documents/create' }));
        actions.appendChild(Button({ text: 'Добавить файл', variant: 'secondary', href: '#/documents/add' }));
        if (toggle) actions.appendChild(toggle);
        header.appendChild(actions);
        container.appendChild(header);

        if (numbers.length === 0) {
            container.appendChild(StatusMessage({
                type: 'ok',
                text: isMaster ? 'Нет файлов' : 'У вас нет файлов.'
            }));
            section.appendChild(container);
            return section;
        }

        const selectedIds = [];

        if (isMaster) {
            const toolbar = createElement('div', { className: 'documents-list-page__toolbar' });
            toolbar.appendChild(Button({
                text: 'Печать выбранных',
                variant: 'secondary',
                onClick: () => {
                    if (selectedIds.length === 0) { alert('Выберите файлы'); return; }
                    window.location.hash = '#/documents/print?ids=' + selectedIds.join(',');
                }
            }));
            container.appendChild(toolbar);
        }

        const list = createElement('div', { className: 'documents-list' });
        for (const number of numbers) {
            list.appendChild(createGroupCard(number, groups.get(number), isMaster, selectedIds));
        }
        container.appendChild(list);

        section.appendChild(container);
    } catch (err) {
        section.appendChild(StatusMessage({ type: 'err', text: 'Ошибка: ' + translateError(err) }));
    }

    return section;
}

function createGroupCard(number, versions, isMaster, selectedIds) {
    const factions = new Set(versions.map(v => v.faction));
    const colorClass = factions.size === 1 ? [...factions][0] : 'multi';

    const card = createElement('a', {
        className: `documents-list__card documents-list__card--${colorClass}`,
        attributes: { href: `#/documents/view?id=${versions[0].id}` }
    });

    if (isMaster) {
        const checkbox = createElement('input', {
            className: 'documents-list__checkbox',
            attributes: { type: 'checkbox', 'aria-label': 'Выбрать файл № ' + number }
        });
        const ids = versions.map(v => v.id);
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            for (const id of ids) {
                const idx = selectedIds.indexOf(id);
                if (checkbox.checked && idx === -1) selectedIds.push(id);
                if (!checkbox.checked && idx >= 0) selectedIds.splice(idx, 1);
            }
        });
        checkbox.addEventListener('click', (e) => e.stopPropagation());
        card.insertBefore(checkbox, card.firstChild);
    }

    card.appendChild(createElement('span', {
        className: 'documents-list__number',
        text: `№ ${number}`
    }));

    const badges = createElement('div', { className: 'documents-list__versions' });
    for (const version of versions) {
        const badge = createElement('span', { className: 'documents-list__version' });
        badge.appendChild(FactionBadge({ faction: version.faction, size: 'sm' }));
        badge.appendChild(createElement('span', {
            className: 'documents-list__version-level',
            text: LEVEL_LABELS[version.level] || version.level
        }));
        badges.appendChild(badge);
    }
    card.appendChild(badges);

    return card;
}
