import { createElement } from '../utils/dom.js?v=3';
import { store } from '../core/Store.js?v=3';
import { getAllDocuments } from '../firebase/documentsService.js?v=3';
import { translateError } from '../utils/translateError.js?v=3';

const FACTION_LABELS = { red: 'Красные', blue: 'Синие', purple: 'Фиолетовые' };
const FACTION_CLASS = { red: 'documents-list__badge--red', blue: 'documents-list__badge--blue', purple: 'documents-list__badge--purple' };

export async function DocumentsListPage() {
    const section = createElement('section', { className: 'documents-list-page' });
    const user = store.get('user');

    if (!user) {
        section.appendChild(createElement('p', { className: 'documents-list-page__empty', text: 'Требуется идентификация' }));
        return section;
    }

    const isMaster = user.role === 'master';
    const userDocs = user.documents || [];

    try {
        const allDocs = await getAllDocuments();
        const visible = isMaster ? allDocs : allDocs.filter(d => userDocs.includes(d.id));

        const container = createElement('div', { className: 'documents-list-page__container' });
        const header = createElement('div', { className: 'documents-list-page__header' });

        header.appendChild(createElement('h1', { className: 'documents-list-page__title', text: 'Документы' }));

        const actions = createElement('div', { className: 'documents-list-page__actions' });

        if (isMaster) {
            actions.appendChild(createElement('a', {
                className: 'documents-list-page__create-btn',
                text: '+ Создать',
                attributes: { href: '#/documents/create' }
            }));
        }

        actions.appendChild(createElement('a', {
            className: 'documents-list-page__add-btn',
            text: 'Добавить документ',
            attributes: { href: '#/documents/add' }
        }));

        header.appendChild(actions);
        container.appendChild(header);

        if (visible.length === 0) {
            container.appendChild(createElement('p', {
                className: 'documents-list-page__empty',
                text: isMaster ? 'Нет документов' : 'У вас нет документов.'
            }));
        } else {
            const selectedIds = [];

            if (isMaster) {
                const toolbar = createElement('div', { className: 'documents-list-page__toolbar' });
                const printSelectedBtn = createElement('button', {
                    className: 'documents-list-page__print-selected',
                    text: 'Печать выбранных',
                    attributes: { type: 'button' }
                });
                printSelectedBtn.addEventListener('click', () => {
                    if (selectedIds.length === 0) { alert('Выберите документы'); return; }
                    window.location.hash = '#/documents/print?ids=' + selectedIds.join(',');
                });
                toolbar.appendChild(printSelectedBtn);
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
        section.appendChild(createElement('p', { className: 'documents-list-page__empty', text: 'Ошибка: ' + translateError(err) }));
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
        // Prevent navigation when clicking checkbox
        checkbox.addEventListener('click', (e) => e.stopPropagation());
        card.insertBefore(checkbox, card.firstChild);
    }

    const number = createElement('span', {
        className: 'documents-list__number',
        text: `№ ${doc.number}`
    });

    const faction = createElement('span', {
        className: `documents-list__badge ${FACTION_CLASS[doc.faction] || ''}`,
        text: FACTION_LABELS[doc.faction] || '—'
    });

    card.appendChild(number);
    card.appendChild(faction);
    return card;
}
