import { createElement } from '../utils/dom.js?v=4';
import { store } from '../core/Store.js?v=4';
import { getAllDocuments } from '../firebase/documentsService.js?v=4';
import { translateError } from '../utils/translateError.js?v=4';

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
                text: isMaster ? 'Нет документов' : 'У вас нет документов. Чтобы получить доступ, отсканируйте QR-код или введите код у мастера.'
            }));
        } else {
            const list = createElement('div', { className: 'documents-list' });
            for (const doc of visible) {
                list.appendChild(createDocumentCard(doc));
            }
            container.appendChild(list);
        }

        if (isMaster) {
            container.appendChild(createElement('div', { className: 'documents-list-page__master-note' }));
        }

        section.appendChild(container);
    } catch (err) {
        section.appendChild(createElement('p', { className: 'documents-list-page__empty', text: 'Ошибка: ' + translateError(err) }));
    }

    return section;
}

function createDocumentCard(doc) {
    const card = createElement('a', {
        className: `documents-list__card documents-list__card--${doc.faction || 'none'}`,
        attributes: { href: `#/documents/view?id=${doc.id}` }
    });

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
