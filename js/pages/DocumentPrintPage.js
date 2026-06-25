import { createElement } from '../utils/dom.js?v=3';
import { store } from '../core/Store.js?v=3';
import { getAllDocuments } from '../firebase/documentsService.js?v=3';
import { encrypt } from '../utils/cipher.js?v=3';
import { translateError } from '../utils/translateError.js?v=3';

const FACTION_LABELS = { red: 'Красные', blue: 'Синие', purple: 'Фиолетовые' };

export async function DocumentPrintPage() {
    const section = createElement('section', { className: 'document-print-page' });
    const user = store.get('user');

    if (!user || user.role !== 'master') {
        section.appendChild(createElement('p', { className: 'document-print-page__error', text: 'Только для мастерской' }));
        return section;
    }

    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const ids = (params.get('ids') || '').split(',').filter(Boolean);

    if (ids.length === 0) {
        section.appendChild(createElement('p', { className: 'document-print-page__error', text: 'Нет выбранных документов' }));
        return section;
    }

    try {
        const allDocs = await getAllDocuments();
        const docs = allDocs.filter(d => ids.includes(d.id));

        const container = createElement('div', { className: 'document-print-page__container' });
        container.appendChild(createElement('h1', { className: 'document-print-page__title', text: 'Печать документов' }));

        for (const doc of docs) {
            const block = createElement('div', { className: 'document-print-page__doc' });
            const header = createElement('div', { className: 'document-print-page__doc-header' });
            header.appendChild(createElement('strong', { text: `Документ № ${doc.number}` }));
            header.appendChild(createElement('span', { text: FACTION_LABELS[doc.faction] || '—' }));
            block.appendChild(header);

            const textEl = createElement('p', { className: 'document-print-page__doc-text', text: doc.content });
            block.appendChild(textEl);

            // QR
            const addPageUrl = window.location.origin + window.location.pathname
                + '#/documents/add?id=' + doc.id + '&number=' + doc.number + '&key=' + encodeURIComponent(doc.accessKey);
            const qrImg = createElement('img', {
                className: 'document-print-page__qr',
                attributes: {
                    src: `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(addPageUrl)}`,
                    alt: 'QR'
                }
            });
            block.appendChild(qrImg);
            block.appendChild(createElement('p', { className: 'document-print-page__access-key', text: 'Код: ' + doc.accessKey }));

            container.appendChild(block);
        }

        const printBtn = createElement('button', {
            className: 'document-print-page__print-btn',
            text: 'Печать',
            attributes: { type: 'button' }
        });
        printBtn.addEventListener('click', () => window.print());
        container.appendChild(printBtn);

        const backBtn = createElement('button', {
            className: 'document-view-page__back',
            text: '← Назад',
            attributes: { type: 'button' }
        });
        backBtn.addEventListener('click', () => { window.location.hash = '#/documents'; });
        container.appendChild(backBtn);

        section.appendChild(container);
    } catch (err) {
        section.appendChild(createElement('p', { className: 'document-print-page__error', text: 'Ошибка: ' + translateError(err) }));
    }

    return section;
}
