import { createElement } from '../utils/dom.js?v=4';
import { store } from '../core/Store.js?v=4';
import { getAllDocuments } from '../firebase/documentsService.js?v=4';
import { translateError } from '../utils/translateError.js?v=4';
import { Button } from '../components/Button.js?v=4';
import { FactionBadge } from '../components/FactionBadge.js?v=4';
import { StatusMessage } from '../components/StatusMessage.js?v=4';

export async function DocumentsListPage() {
    const section = createElement('section', { className: 'documents-list-page' });
    const user = store.get('user');

    if (!user) {
        section.appendChild(StatusMessage({ type: 'err', text: 'Требуется идентификация' }));
        return section;
    }

    const isMaster = user.role === 'master';
    const userDocs = user.documents || [];

    try {
        const allDocs = await getAllDocuments();
        const visible = isMaster
            ? allDocs
            : allDocs.filter(d => userDocs.includes(d.id) || d.faction === 'common');

        const container = createElement('div', { className: 'documents-list-page__container' });
        const header = createElement('div', { className: 'documents-list-page__header' });

        header.appendChild(createElement('h1', { className: 'documents-list-page__title', text: 'Документы' }));

        const actions = createElement('div', { className: 'documents-list-page__actions' });

        if (isMaster) {
            actions.appendChild(Button({ text: '+ Создать', href: '#/documents/create' }));
        }

        actions.appendChild(Button({ text: 'Добавить документ', variant: 'secondary', href: '#/documents/add' }));

        header.appendChild(actions);
        container.appendChild(header);

        if (visible.length === 0) {
            container.appendChild(StatusMessage({
                type: 'ok',
                text: isMaster ? 'Нет документов' : 'У вас нет документов.'
            }));
        } else {
            const selectedIds = [];

            if (isMaster) {
                const toolbar = createElement('div', { className: 'documents-list-page__toolbar' });
                toolbar.appendChild(Button({
                    text: 'Печать выбранных',
                    variant: 'secondary',
                    onClick: () => {
                        if (selectedIds.length === 0) { alert('Выберите документы'); return; }
                        window.location.hash = '#/documents/print?ids=' + selectedIds.join(',');
                    }
                }));
                container.appendChild(toolbar);
            }

            const list = createElement('div', { className: 'documents-list' });
            for (const doc of visible) {
                const card = createDocumentCard(doc, isMaster, selectedIds);
                list.appendChild(card);
            }
            container.appendChild(list);
        }

        section.appendChild(container);
    } catch (err) {
        section.appendChild(StatusMessage({ type: 'err', text: 'Ошибка: ' + translateError(err) }));
    }

    return section;
}

function createDocumentCard(doc, isMaster, selectedIds) {
    const card = createElement('a', {
        className: `documents-list__card documents-list__card--${doc.faction || 'none'}`,
        attributes: { href: `#/documents/view?id=${doc.id}` }
    });

    if (isMaster) {
        const checkbox = createElement('input', {
            className: 'documents-list__checkbox',
            attributes: { type: 'checkbox' }
        });
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            if (checkbox.checked) {
                if (!selectedIds.includes(doc.id)) selectedIds.push(doc.id);
            } else {
                const idx = selectedIds.indexOf(doc.id);
                if (idx >= 0) selectedIds.splice(idx, 1);
            }
        });
        checkbox.addEventListener('click', (e) => e.stopPropagation());
        card.insertBefore(checkbox, card.firstChild);
    }

    card.appendChild(createElement('span', {
        className: 'documents-list__number',
        text: `№ ${doc.number}`
    }));

    card.appendChild(FactionBadge({ faction: doc.faction, size: 'sm' }));

    if (doc.propaganda && doc.propaganda.enabled) {
        card.appendChild(createElement('span', {
            className: 'documents-list__propaganda',
            text: 'Пропаганда'
        }));
    }

    return card;
}
