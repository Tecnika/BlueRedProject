import { createElement } from '../utils/dom.js?v=4';
import { store } from '../core/Store.js?v=4';
import { getDocument, getDocumentReaders } from '../firebase/documentsService.js?v=4';
import { encrypt } from '../utils/cipher.js?v=4';
import { translateError } from '../utils/translateError.js?v=4';

const FACTION_LABELS = { red: 'Красные', blue: 'Синие', purple: 'Фиолетовые' };

export async function DocumentViewPage(docId) {
    const section = createElement('section', { className: 'document-view-page' });
    const user = store.get('user');

    if (!user) {
        section.appendChild(createElement('p', { className: 'document-view-page__error', text: 'Требуется идентификация' }));
        return section;
    }

    try {
        const doc = await getDocument(docId);
        if (!doc) {
            section.appendChild(createElement('p', { className: 'document-view-page__error', text: 'Документ не найден' }));
            return section;
        }

        const isMaster = user.role === 'master';
        const hasAccess = isMaster || (user.documents || []).includes(docId);

        if (!hasAccess) {
            section.appendChild(createElement('p', { className: 'document-view-page__error', text: 'Нет доступа к этому документу' }));
            return section;
        }

        const isSameFaction = doc.faction === user.faction;
        const content = isSameFaction ? doc.content : (isMaster ? doc.content : encrypt(doc.content));

        const container = createElement('div', { className: 'document-view-page__container' });

        const header = createElement('div', { className: 'document-view-page__header' });

        const backLink = createElement('a', {
            className: 'document-view-page__back',
            text: '← К списку',
            attributes: { href: '#/documents' }
        });
        header.appendChild(backLink);

        const titleRow = createElement('div', { className: 'document-view-page__title-row' });
        titleRow.appendChild(createElement('h1', { className: 'document-view-page__title', text: `Документ № ${doc.number}` }));
        titleRow.appendChild(createElement('span', {
            className: `document-view-page__badge document-view-page__badge--${doc.faction}`,
            text: FACTION_LABELS[doc.faction] || '—'
        }));
        header.appendChild(titleRow);

        if (doc.createdBy && isMaster) {
            header.appendChild(createElement('p', { className: 'document-view-page__meta', text: 'Код доступа: ' + doc.accessKey }));
        }

        container.appendChild(header);

        // Информация о шифровании
        if (!isSameFaction && !isMaster) {
            const cipherNote = createElement('div', { className: 'document-view-page__cipher' });
            cipherNote.appendChild(createElement('span', { className: 'document-view-page__cipher-icon', text: '🔒' }));

            const cipherTitle = createElement('div', { className: 'document-view-page__cipher-title', text: 'Документ зашифрован' });
            const cipherDesc = createElement('div', { className: 'document-view-page__cipher-desc', text: 'Фракционный шифр — текст транслитерирован. Для полного доступа требуется привязка к фракции документа.' });
            cipherNote.appendChild(cipherTitle);
            cipherNote.appendChild(cipherDesc);
            container.appendChild(cipherNote);
        }

        // Тело документа
        const contentBlock = createElement('div', { className: 'document-view-page__content' });
        contentBlock.appendChild(createElement('p', { text: content }));
        container.appendChild(contentBlock);

        // Мастер: переключалка шифр/оригинал
        if (isMaster) {
            const toggleContainer = createElement('div', { className: 'document-view-page__cipher-toggle' });
            const toggleBtn = createElement('button', {
                className: 'document-view-page__toggle-btn',
                text: isSameFaction ? 'Показать шифр' : 'Показать оригинал',
                attributes: { type: 'button' }
            });
            toggleBtn.addEventListener('click', () => {
                const current = contentBlock.querySelector('p').textContent;
                if (current === doc.content) {
                    contentBlock.querySelector('p').textContent = encrypt(doc.content);
                    toggleBtn.textContent = 'Показать оригинал';
                } else {
                    contentBlock.querySelector('p').textContent = doc.content;
                    toggleBtn.textContent = 'Показать шифр';
                }
            });
            toggleContainer.appendChild(toggleBtn);
            container.appendChild(toggleContainer);
        }

        // QR-код
        const qrContainer = createElement('div', { className: 'document-view-page__qr' });
        const qrTitle = createElement('p', { className: 'document-view-page__qr-label', text: 'QR-код для передачи' });
        qrContainer.appendChild(qrTitle);

        const qrCodeBox = createElement('div', { className: 'document-view-page__qr-code' });
        const addPageUrl = window.location.origin + window.location.pathname
            + '#/documents/add?id=' + doc.id + '&number=' + doc.number + '&key=' + encodeURIComponent(doc.accessKey);
        const qrImg = createElement('img', {
            className: 'document-view-page__qr-img',
            attributes: {
                src: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(addPageUrl)}`,
                alt: 'QR-код документа'
            }
        });
        qrCodeBox.appendChild(qrImg);
        qrContainer.appendChild(qrCodeBox);

        if (isMaster) {
            const accessKeyInfo = createElement('p', {
                className: 'document-view-page__qr-key',
                html: `Код доступа: <strong>${doc.accessKey}</strong>`
            });
            qrContainer.appendChild(accessKeyInfo);
        }

        container.appendChild(qrContainer);

        // Печать
        const printBtn = createElement('button', {
            className: 'document-view-page__print-btn',
            text: 'Печать',
            attributes: { type: 'button' }
        });
        printBtn.addEventListener('click', () => window.print());
        container.appendChild(printBtn);

        // Мастер: список читателей
        if (isMaster) {
            try {
                const readers = await getDocumentReaders(docId);
                const readersSection = createElement('div', { className: 'document-view-page__readers' });
                readersSection.appendChild(createElement('h2', { className: 'document-view-page__readers-title', text: 'Доступ к документу имеют' }));
                if (readers.length === 0) {
                    readersSection.appendChild(createElement('p', { text: 'Нет читателей' }));
                } else {
                    const list = createElement('ul', { className: 'document-view-page__readers-list' });
                    readers.forEach(r => {
                        const li = createElement('li', { className: 'document-view-page__readers-item' });
                        li.appendChild(createElement('span', { text: r.username }));
                        li.appendChild(createElement('span', {
                            className: `document-view-page__readers-faction document-view-page__badge--${r.faction}`,
                            text: FACTION_LABELS[r.faction] || '—'
                        }));
                        list.appendChild(li);
                    });
                    readersSection.appendChild(list);
                }
                container.appendChild(readersSection);
            } catch (_) {}
        }

        section.appendChild(container);
    } catch (err) {
        section.appendChild(createElement('p', { className: 'document-view-page__error', text: 'Ошибка: ' + translateError(err) }));
    }

    return section;
}
