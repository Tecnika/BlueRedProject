import { createElement } from '../utils/dom.js?v=3';
import { store } from '../core/Store.js?v=3';
import { getDocument, getDocumentReaders, deleteDocument } from '../firebase/documentsService.js?v=3';
import { encrypt } from '../utils/cipher.js?v=3';
import { translateError } from '../utils/translateError.js?v=3';

const FACTION_LABELS = { red: 'Красные', blue: 'Синие', purple: 'Фиолетовые' };

function goBack() {
    if (document.referrer && document.referrer !== window.location.href) {
        window.history.back();
    } else {
        window.location.hash = '#/documents';
    }
}

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

        const backBtn = createElement('button', {
            className: 'document-view-page__back',
            text: '← Назад',
            attributes: { type: 'button' }
        });
        backBtn.addEventListener('click', goBack);
        container.appendChild(backBtn);

        const titleRow = createElement('div', { className: 'document-view-page__title-row' });
        titleRow.appendChild(createElement('h1', { className: 'document-view-page__title', text: `Документ № ${doc.number}` }));
        titleRow.appendChild(createElement('span', {
            className: `document-view-page__badge document-view-page__badge--${doc.faction}`,
            text: FACTION_LABELS[doc.faction] || '—'
        }));
        container.appendChild(titleRow);

        // Body: text + QR side by side
        const body = createElement('div', { className: 'document-view-page__body' });

        const contentBlock = createElement('div', { className: 'document-view-page__content' });
        const contentEl = createElement('p', { text: content });
        contentBlock.appendChild(contentEl);
        body.appendChild(contentBlock);

        if (isMaster) {
            const actionsRow = createElement('div', { className: 'document-view-page__master-actions' });

            const editLink = createElement('a', {
                className: 'document-view-page__master-btn',
                text: 'Редактировать',
                attributes: { href: `#/documents/edit?id=${doc.id}` }
            });
            actionsRow.appendChild(editLink);

            const toggleBtn = createElement('button', {
                className: 'document-view-page__master-btn',
                text: isSameFaction ? 'Показать шифр' : 'Показать оригинал',
                attributes: { type: 'button' }
            });
            toggleBtn.addEventListener('click', () => {
                if (contentEl.textContent === doc.content) {
                    contentEl.textContent = encrypt(doc.content);
                    toggleBtn.textContent = 'Показать оригинал';
                } else {
                    contentEl.textContent = doc.content;
                    toggleBtn.textContent = 'Показать шифр';
                }
            });
            actionsRow.appendChild(toggleBtn);

            const printBtn = createElement('button', {
                className: 'document-view-page__master-btn',
                text: 'Печать',
                attributes: { type: 'button' }
            });
            printBtn.addEventListener('click', () => window.print());
            actionsRow.appendChild(printBtn);

            const deleteBtn = createElement('button', {
                className: 'document-view-page__master-btn document-view-page__master-btn--danger',
                text: 'Удалить',
                attributes: { type: 'button' }
            });
            deleteBtn.addEventListener('click', async () => {
                if (!confirm('Удалить документ навсегда?')) return;
                try {
                    await deleteDocument(docId);
                    window.location.hash = '#/documents';
                } catch (err) {
                    alert('Ошибка: ' + translateError(err));
                }
            });
            actionsRow.appendChild(deleteBtn);

            container.appendChild(actionsRow);
        }

        if (!isSameFaction && !isMaster) {
            const cipherNote = createElement('div', { className: 'document-view-page__cipher' });
            cipherNote.appendChild(createElement('span', { className: 'document-view-page__cipher-icon', text: '🔒' }));
            cipherNote.appendChild(createElement('div', { className: 'document-view-page__cipher-title', text: 'Документ на чужом языке' }));
            cipherNote.appendChild(createElement('div', { className: 'document-view-page__cipher-desc', text: 'Текст документа не распознан. Требуется привязка к фракции документа.' }));
            container.appendChild(cipherNote);
        }

        const qrContainer = createElement('div', { className: 'document-view-page__qr' });
        const addPageUrl = window.location.origin + window.location.pathname
            + '#/documents/add?id=' + doc.id + '&number=' + doc.number + '&key=' + encodeURIComponent(doc.accessKey);
        const qrCodeBox = createElement('div', { className: 'document-view-page__qr-code' });
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
            qrContainer.appendChild(createElement('p', {
                className: 'document-view-page__qr-key',
                html: `Код доступа: <strong>${doc.accessKey}</strong>`
            }));
        }

        body.appendChild(qrContainer);
        container.appendChild(body);

        if (isMaster) {
            try {
                const readers = await getDocumentReaders(docId);
                const readersSection = createElement('div', { className: 'document-view-page__readers' });
                readersSection.appendChild(createElement('h2', { className: 'document-view-page__readers-title', text: 'Доступ к документу имеют (' + readers.length + ')' }));
                if (readers.length === 0) {
                    readersSection.appendChild(createElement('p', { className: 'document-view-page__readers-empty', text: 'Нет читателей' }));
                } else {
                    const list = createElement('div', { className: 'document-view-page__readers-list' });
                    readers.forEach(r => {
                        const item = createElement('a', {
                            className: 'document-view-page__readers-item',
                            attributes: { href: `#/profile?uid=${r.uid}` }
                        });
                        item.appendChild(createElement('span', { text: r.username }));
                        item.appendChild(createElement('span', {
                            className: `document-view-page__badge--${r.faction}`,
                            text: FACTION_LABELS[r.faction] || '—'
                        }));
                        list.appendChild(item);
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
