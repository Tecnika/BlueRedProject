import { createElement } from '../utils/dom.js?v=27';
import { store } from '../core/Store.js?v=27';
import { getAllDocuments } from '../firebase/documentsService.js?v=27';
import { translateError } from '../utils/translateError.js?v=27';
import { BackButton } from '../components/BackButton.js?v=27';
import { Button } from '../components/Button.js?v=27';
import { QRCode } from '../components/QRCode.js?v=27';
import { FactionBadge } from '../components/FactionBadge.js?v=27';
import { LEVEL_LABELS } from '../domain/documents.js?v=27';
import { StatusMessage } from '../components/StatusMessage.js?v=27';

export async function DocumentPrintPage() {
    const section = createElement('section', { className: 'document-print-page' });
    const user = store.get('user');

    if (!user || user.role !== 'master') {
        section.appendChild(StatusMessage({ type: 'err', text: 'Только для мастерской' }));
        return section;
    }

    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const ids = (params.get('ids') || '').split(',').filter(Boolean);

    if (ids.length === 0) {
        section.appendChild(StatusMessage({ type: 'err', text: 'Нет выбранных файлов' }));
        return section;
    }

    try {
        const allDocs = await getAllDocuments();
        const docs = allDocs.filter(d => ids.includes(d.id));

        if (docs.length === 0) {
            section.appendChild(StatusMessage({ type: 'err', text: 'Файлы не найдены' }));
            return section;
        }

        const container = createElement('div', { className: 'document-print-page__container' });
        container.appendChild(createElement('h1', { className: 'document-print-page__title', text: 'Печать файлов (' + docs.length + ')' }));

        const grid = createElement('div', { className: 'document-print-page__grid' });

        for (const doc of docs) {
            const block = createElement('div', { className: 'document-print-page__doc' });

            const header = createElement('div', { className: 'document-print-page__doc-header' });
            header.appendChild(createElement('span', { text: '№ ' + doc.number }));
            header.appendChild(FactionBadge({ faction: doc.faction, size: 'sm' }));
            header.appendChild(createElement('span', { className: 'document-print-page__level', text: LEVEL_LABELS[doc.level] || doc.level || 'Официальная версия' }));
            block.appendChild(header);

            const textEl = createElement('div', { className: 'document-print-page__doc-text', text: doc.content });
            block.appendChild(textEl);

            const footer = createElement('div', { className: 'document-print-page__doc-footer' });

            const addPageUrl = window.location.origin + window.location.pathname
                + '#/documents/add?id=' + doc.id + '&number=' + doc.number + '&key=' + encodeURIComponent(doc.accessKey);
            footer.appendChild(QRCode({ data: addPageUrl, size: 120 }));

            footer.appendChild(createElement('span', {
                className: 'document-print-page__access-key',
                text: 'Код: ' + doc.accessKey
            }));

            block.appendChild(footer);
            grid.appendChild(block);
        }

        container.appendChild(grid);

        container.appendChild(Button({ text: 'Печать', onClick: () => window.print() }));
        container.appendChild(BackButton({ fallback: '#/documents' }));

        section.appendChild(container);
    } catch (err) {
        section.appendChild(StatusMessage({ type: 'err', text: 'Ошибка: ' + translateError(err) }));
    }

    return section;
}
