import { createElement } from '../utils/dom.js?v=4';
import { store } from '../core/Store.js?v=4';
import { getDocument, getDocumentReaders, deleteDocument } from '../firebase/documentsService.js?v=4';
import { updateUserProfile } from '../firebase/authService.js?v=4';
import { encryptToFaction, renderCipher, normalizeForCompare, LANGUAGE_LABELS, LANGUAGE_THRESHOLDS } from '../utils/cipher.js?v=4';
import { translateError } from '../utils/translateError.js?v=4';
import { BackButton } from '../components/BackButton.js?v=4';
import { FactionBadge } from '../components/FactionBadge.js?v=4';
import { Button } from '../components/Button.js?v=4';
import { StatusMessage, showMessage, hideMessage } from '../components/StatusMessage.js?v=4';
import { QRCode } from '../components/QRCode.js?v=4';
import { getActiveFaction } from '../utils/profile.js?v=4';

const FACTION_LABELS = { red: 'Красные', blue: 'Синие', purple: 'Фиолетовые', common: 'Общий' };

export async function DocumentViewPage(docId) {
    const section = createElement('section', { className: 'document-view-page' });
    const user = store.get('user');

    if (!user) {
        section.appendChild(StatusMessage({ type: 'err', text: 'Требуется идентификация' }));
        return section;
    }

    try {
        const doc = await getDocument(docId);
        if (!doc) {
            section.appendChild(StatusMessage({ type: 'err', text: 'Документ не найден' }));
            return section;
        }

        const isMaster = user.role === 'master';
        const hasAccess = isMaster || (user.documents || []).includes(docId) || doc.faction === 'common';

        if (!hasAccess) {
            section.appendChild(StatusMessage({ type: 'err', text: 'Нет доступа к этому документу' }));
            return section;
        }

        render();
        return section;

        // ---------- внутренние ----------
        function render() {
            section.innerHTML = '';
            const viewerFaction = getActiveFaction();
            const isCommon = doc.faction === 'common';
            const isOwn = !isCommon && viewerFaction === doc.faction;
            const pov = (!isCommon && !isOwn) ? (doc.views || {})[viewerFaction] : null;

            const lang = isCommon ? null : doc.faction;
            const progress = lang ? (store.get('user').decryptions || {})[lang] || 0 : 0;
            const learned = progress >= LANGUAGE_THRESHOLDS.full;
            const encrypted = !isCommon && !isOwn && !pov && !learned && !isMaster;

            const container = createElement('div', { className: 'document-view-page__container' });
            container.appendChild(BackButton({ fallback: '#/documents' }));

            const titleRow = createElement('div', { className: 'document-view-page__title-row' });
            titleRow.appendChild(createElement('h1', { className: 'document-view-page__title', text: `Документ № ${doc.number}` }));
            titleRow.appendChild(FactionBadge({ faction: doc.faction }));
            container.appendChild(titleRow);

            const body = createElement('div', { className: 'document-view-page__body' });
            const contentBlock = createElement('div', { className: 'document-view-page__content' });

            let shownText;
            if (isMaster || isCommon) {
                shownText = doc.content;
            } else if (isOwn) {
                shownText = doc.content;
            } else if (pov) {
                shownText = pov;
            } else {
                shownText = renderCipher(doc.content, lang, docId, progress);
            }

            const contentEl = createElement('p', { text: shownText });
            contentBlock.appendChild(contentEl);

            if (encrypted) {
                contentBlock.appendChild(createElement('div', { className: 'document-view-page__language', text: `Язык документа: ${LANGUAGE_LABELS[lang] || lang}` }));
            }
            body.appendChild(contentBlock);

            // --- Пропаганда ---
            if (doc.propaganda && doc.propaganda.enabled && doc.propaganda.content) {
                const prop = createElement('div', { className: 'document-view-page__propaganda' });
                prop.appendChild(createElement('h2', { className: 'document-view-page__propaganda-title', text: 'Официальная версия' }));
                prop.appendChild(createElement('p', { text: doc.propaganda.content }));
                body.appendChild(prop);
            }

            // --- Панель мастера ---
            if (isMaster) {
                const actionsRow = createElement('div', { className: 'document-view-page__master-actions' });
                actionsRow.appendChild(Button({ text: 'Редактировать', variant: 'secondary', size: 'sm', href: `#/documents/edit?id=${doc.id}` }));

                const toggleBtn = Button({
                    text: 'Показать шифр',
                    variant: 'secondary',
                    size: 'sm',
                    onClick: () => {
                        if (contentEl.textContent === doc.content) {
                            contentEl.textContent = encryptToFaction(doc.content, doc.faction === 'common' ? 'blue' : doc.faction);
                            toggleBtn.textContent = 'Показать оригинал';
                        } else {
                            contentEl.textContent = doc.content;
                            toggleBtn.textContent = 'Показать шифр';
                        }
                    }
                });
                actionsRow.appendChild(toggleBtn);
                actionsRow.appendChild(Button({ text: 'Печать', variant: 'secondary', size: 'sm', onClick: () => window.print() }));
                actionsRow.appendChild(Button({
                    text: 'Удалить',
                    variant: 'danger',
                    size: 'sm',
                    onClick: async () => {
                        if (!confirm('Удалить документ навсегда?')) return;
                        try {
                            await deleteDocument(docId);
                            window.location.hash = '#/documents';
                        } catch (err) {
                            alert('Ошибка: ' + translateError(err));
                        }
                    }
                }));
                container.appendChild(actionsRow);
            }

            // --- Расшифровка ---
            if (encrypted) {
                container.appendChild(createDecryptBlock());
            } else if (!isCommon && !isOwn && lang) {
                container.appendChild(createProgressBlock(progress));
            }

            // --- QR ---
            const qrContainer = createElement('div', { className: 'document-view-page__qr' });
            const addPageUrl = window.location.origin + window.location.pathname
                + '#/documents/add?id=' + doc.id + '&number=' + doc.number + '&key=' + encodeURIComponent(doc.accessKey);
            const qrCodeBox = createElement('div', { className: 'document-view-page__qr-code' });
            qrCodeBox.appendChild(QRCode({ data: addPageUrl }));
            qrContainer.appendChild(qrCodeBox);

            if (isMaster) {
                qrContainer.appendChild(createElement('p', {
                    className: 'document-view-page__qr-key',
                    html: `Код доступа: <strong>${doc.accessKey}</strong>`
                }));
            }

            body.appendChild(qrContainer);
            container.appendChild(body);

            if (isMaster) container.appendChild(buildReadersBlock());

            section.appendChild(container);
        }

        function createDecryptBlock() {
            const block = createElement('div', { className: 'document-view-page__decrypt' });
            block.appendChild(createElement('h2', { className: 'document-view-page__decrypt-title', text: 'Расшифровать документ' }));
            block.appendChild(createElement('p', {
                className: 'document-view-page__decrypt-hint',
                text: 'Введите расшифрованный текст. Верная расшифровка приближает изучение языка.'
            }));

            const textarea = createElement('textarea', {
                className: 'document-view-page__decrypt-input',
                attributes: { rows: 4, placeholder: 'Расшифрованный текст...' }
            });
            block.appendChild(textarea);

            const msg = StatusMessage({ type: 'ok', text: '', hidden: true });
            const btn = Button({
                text: 'Расшифровать',
                variant: 'primary',
                size: 'sm',
                onClick: async () => {
                    hideMessage(msg);
                    const expected = normalizeForCompare(doc.content);
                    const typed = normalizeForCompare(textarea.value);
                    if (!typed) { showMessage(msg, 'Введите текст', 'err'); return; }
                    if (typed !== expected) {
                        showMessage(msg, 'Текст не совпадает. Попробуйте ещё раз.', 'err');
                        return;
                    }

                    try {
                        const current = store.get('user');
                        const lang = doc.faction;
                        const already = (current.decryptedDocs || []).includes(docId);
                        if (!already) {
                            const decryptions = { ...(current.decryptions || {}), [lang]: ((current.decryptions || {})[lang] || 0) + 1 };
                            const decryptedDocs = [...(current.decryptedDocs || []), docId];
                            await updateUserProfile(current.uid, { decryptions, decryptedDocs });
                            store.set('user', { ...current, decryptions, decryptedDocs });
                        }
                        showMessage(msg, 'Верно! Язык изучен чуть лучше.', 'ok');
                        render();
                    } catch (err) {
                        showMessage(msg, 'Ошибка: ' + translateError(err), 'err');
                    }
                }
            });
            block.appendChild(btn);
            block.appendChild(msg);
            return block;
        }

        function createProgressBlock(progress) {
            const block = createElement('div', { className: 'document-view-page__progress' });
            const lang = doc.faction;
            const label = LANGUAGE_LABELS[lang] || lang;

            if (progress >= LANGUAGE_THRESHOLDS.full) {
                block.appendChild(createElement('p', { text: `Язык «${label}» изучен — документы доступны полностью.` }));
            } else if (progress >= LANGUAGE_THRESHOLDS.half) {
                block.appendChild(createElement('p', {
                    text: `Язык «${label}»: открыта половина букв. Ещё ${LANGUAGE_THRESHOLDS.full - progress} расшифровок до полного изучения.`
                }));
            } else {
                block.appendChild(createElement('p', {
                    text: `Язык «${label}»: расшифровано ${progress} из ${LANGUAGE_THRESHOLDS.half} до открытия половины букв.`
                }));
            }
            return block;
        }

        function buildReadersBlock() {
            const readersSection = createElement('div', { className: 'document-view-page__readers' });
            readersSection.appendChild(createElement('h2', { className: 'document-view-page__readers-title', text: 'Доступ к документу' }));

            getDocumentReaders(docId).then(readers => {
                readersSection.querySelectorAll('.document-view-page__readers-list, .document-view-page__readers-empty').forEach(el => el.remove());
                readersSection.querySelector('h2').textContent = 'Доступ к документу имеют (' + readers.length + ')';

                if (readers.length === 0) {
                    readersSection.appendChild(createElement('p', { className: 'document-view-page__readers-empty', text: 'Нет читателей' }));
                    return;
                }
                const list = createElement('div', { className: 'document-view-page__readers-list' });
                for (const r of readers) {
                    const item = createElement('a', {
                        className: 'document-view-page__readers-item',
                        attributes: { href: `#/profile?uid=${r.uid}` }
                    });
                    item.appendChild(createElement('span', { text: r.displayName || r.username }));
                    if (r.faction) item.appendChild(FactionBadge({ faction: r.faction, size: 'sm' }));
                    list.appendChild(item);
                }
                readersSection.appendChild(list);
            }).catch(() => {});

            return readersSection;
        }
    } catch (err) {
        section.appendChild(StatusMessage({ type: 'err', text: 'Ошибка: ' + translateError(err) }));
        return section;
    }
}
