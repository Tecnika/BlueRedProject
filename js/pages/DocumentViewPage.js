import { createElement } from '../utils/dom.js?v=5';
import { store } from '../core/Store.js?v=5';
import {
    getDocument,
    getVersionsByNumber,
    deleteVersionGroup
} from '../firebase/documentsService.js?v=5';
import { updateUserProfile } from '../firebase/authService.js?v=5';
import {
    getAccessibleVersions,
    getVersionView,
    LEVEL_LABELS
} from '../domain/documents.js?v=5';
import { encryptToFaction, normalizeForCompare, LANGUAGE_LABELS, LANGUAGE_THRESHOLDS } from '../utils/cipher.js?v=5';
import { translateError } from '../utils/translateError.js?v=5';
import { BackButton } from '../components/BackButton.js?v=5';
import { FactionBadge } from '../components/FactionBadge.js?v=5';
import { Button } from '../components/Button.js?v=5';
import { StatusMessage, showMessage, hideMessage } from '../components/StatusMessage.js?v=5';
import { QRCode } from '../components/QRCode.js?v=5';
import { getActiveFaction } from '../utils/profile.js?v=5';

export async function DocumentViewPage(docId) {
    const section = createElement('section', { className: 'document-view-page' });
    const user = store.get('user');

    if (!user) {
        section.appendChild(StatusMessage({ type: 'err', text: 'Требуется идентификация' }));
        return section;
    }

    let group = [];
    let number = '';
    let notice = null;

    try {
        const seed = await getDocument(docId);
        if (!seed) {
            section.appendChild(StatusMessage({ type: 'err', text: 'Документ не найден' }));
            return section;
        }
        number = seed.number;
        group = await getVersionsByNumber(number);
        if (!group.length) group = [seed];
    } catch (err) {
        section.appendChild(StatusMessage({ type: 'err', text: 'Ошибка: ' + translateError(err) }));
        return section;
    }

    const isMaster = user.role === 'master';
    const character = store.get('character') || null;

    render();
    return section;

    // ---------- внутренние ----------

    function currentUser() {
        return store.get('user');
    }

    function render() {
        section.innerHTML = '';
        const viewer = currentUser();
        const accessible = getAccessibleVersions(group, viewer, store.get('character') || null);

        if (accessible.length === 0) {
            section.appendChild(StatusMessage({ type: 'err', text: 'Нет доступа к этому документу' }));
            return;
        }

        const container = createElement('div', { className: 'document-view-page__container' });
        container.appendChild(BackButton({ fallback: '#/documents' }));

        const titleRow = createElement('div', { className: 'document-view-page__title-row' });
        titleRow.appendChild(createElement('h1', { className: 'document-view-page__title', text: `Документ № ${number}` }));
        titleRow.appendChild(createElement('span', {
            className: 'document-view-page__versions-count',
            text: `Версий: ${accessible.length}`
        }));
        container.appendChild(titleRow);

        if (notice) {
            container.appendChild(StatusMessage({ type: notice.type, text: notice.text }));
        }

        if (isMaster) {
            container.appendChild(createElement('p', {
                className: 'document-view-page__master-note',
                text: 'Вы видите оригиналы, потому что у вас права мастера. Игроки увидят доступные им версии.'
            }));
        }

        for (const version of accessible) {
            container.appendChild(buildVersionCard(version, viewer));
        }

        if (isMaster) {
            const actions = createElement('div', { className: 'document-view-page__master-actions' });
            actions.appendChild(Button({
                text: 'Редактировать',
                variant: 'secondary',
                size: 'sm',
                href: `#/documents/edit?id=${accessible[0].id}`
            }));
            actions.appendChild(Button({
                text: 'Печать',
                variant: 'secondary',
                size: 'sm',
                onClick: () => window.print()
            }));
            actions.appendChild(Button({
                text: 'Удалить документ',
                variant: 'danger',
                size: 'sm',
                onClick: async () => {
                    if (!confirm(`Удалить документ № ${number} и все его версии?`)) return;
                    try {
                        await deleteVersionGroup(number);
                        window.location.hash = '#/documents';
                    } catch (err) {
                        alert('Ошибка: ' + translateError(err));
                    }
                }
            }));
            container.appendChild(actions);
        }

        section.appendChild(container);
    }

    function buildVersionCard(version, viewer) {
        const card = createElement('div', {
            className: `document-view-page__version document-view-page__version--${version.faction}`
        });

        const head = createElement('div', { className: 'document-view-page__version-head' });
        head.appendChild(FactionBadge({ faction: version.faction, size: 'sm' }));
        head.appendChild(createElement('span', {
            className: 'document-view-page__version-level',
            text: LEVEL_LABELS[version.level] || version.level
        }));
        card.appendChild(head);

        const decryptions = viewer.decryptions || {};
        const view = getVersionView(version, getActiveFaction(), decryptions, viewer.role === 'master', store.get('character'));

        const contentEl = createElement('p', { text: view.text });
        const contentBlock = createElement('div', { className: 'document-view-page__content' });
        contentBlock.appendChild(contentEl);
        if (view.encrypted) {
            contentBlock.appendChild(createElement('div', {
                className: 'document-view-page__language',
                text: `Язык: ${LANGUAGE_LABELS[version.faction] || version.faction}`
            }));
            contentBlock.appendChild(createDecryptBlock(version, viewer));
        }
        card.appendChild(contentBlock);

        // Мастер: переключатель шифра и доступы версии
        if (viewer.role === 'master') {
            const tools = createElement('div', { className: 'document-view-page__version-tools' });

            if (version.faction !== 'common') {
                const toggleBtn = Button({
                    text: 'Показать шифр',
                    variant: 'secondary',
                    size: 'sm',
                    onClick: () => {
                        if (contentEl.textContent === version.content) {
                            contentEl.textContent = encryptToFaction(version.content, version.faction);
                            toggleBtn.textContent = 'Показать оригинал';
                        } else {
                            contentEl.textContent = version.content;
                            toggleBtn.textContent = 'Показать шифр';
                        }
                    }
                });
                tools.appendChild(toggleBtn);
            }

            const qrDetails = createElement('details', { className: 'document-view-page__version-qr' });
            qrDetails.appendChild(createElement('summary', { text: 'QR и код доступа' }));
            const url = window.location.origin + window.location.pathname
                + '#/documents/add?id=' + version.id
                + '&number=' + version.number
                + '&key=' + encodeURIComponent(version.accessKey);
            qrDetails.appendChild(QRCode({ data: url, size: 120 }));
            qrDetails.appendChild(createElement('p', {
                className: 'document-view-page__qr-key',
                html: `Код: <strong>${version.accessKey}</strong>`
            }));
            tools.appendChild(qrDetails);

            card.appendChild(tools);
        }

        return card;
    }

    function createDecryptBlock(version, viewer) {
        const block = createElement('div', { className: 'document-view-page__decrypt' });
        const lang = version.faction;
        const label = LANGUAGE_LABELS[lang] || lang;
        const count = (viewer.decryptions || {})[lang] || 0;

        block.appendChild(createElement('p', {
            className: 'document-view-page__decrypt-hint',
            text: 'Введите расшифрованный текст. Верная расшифровка приближает изучение языка.'
        }));

        const progressEl = createElement('p', {
            className: 'document-view-page__decrypt-progress',
            text: progressText(count, label)
        });
        block.appendChild(progressEl);

        const textarea = createElement('textarea', {
            className: 'document-view-page__decrypt-input',
            attributes: { rows: 3, placeholder: 'Расшифрованный текст...', 'aria-label': 'Расшифрованный текст документа' }
        });
        block.appendChild(textarea);

        const msg = StatusMessage({ type: 'ok', text: '', hidden: true });

        const btn = Button({
            text: 'Расшифровать',
            variant: 'primary',
            size: 'sm',
            onClick: async () => {
                hideMessage(msg);
                const typed = normalizeForCompare(textarea.value);
                if (!typed) { showMessage(msg, 'Введите текст', 'err'); return; }
                if (typed !== normalizeForCompare(version.content)) {
                    showMessage(msg, 'Текст не совпадает. Попробуйте ещё раз.', 'err');
                    return;
                }

                try {
                    const current = store.get('user');
                    const already = (current.decryptedDocs || []).includes(version.id);
                    let nextCount = (current.decryptions || {})[lang] || 0;

                    if (already) {
                        showMessage(msg, 'Этот документ уже учтён. Расшифруйте другие документы этого языка.', 'ok');
                        return;
                    }

                    nextCount += 1;
                    const decryptions = { ...(current.decryptions || {}), [lang]: nextCount };
                    const decryptedDocs = [...(current.decryptedDocs || []), version.id];
                    await updateUserProfile(current.uid, { decryptions, decryptedDocs });
                    store.set('user', { ...current, decryptions, decryptedDocs });

                    notice = {
                        type: 'ok',
                        text: nextCount >= LANGUAGE_THRESHOLDS.full
                            ? `Язык «${label}» изучен полностью.`
                            : `Верно! Расшифровано: ${nextCount}.`
                    };
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

    function progressText(count, label) {
        if (count >= LANGUAGE_THRESHOLDS.full) return `Язык «${label}» изучен.`;
        if (count >= LANGUAGE_THRESHOLDS.half) {
            const left = LANGUAGE_THRESHOLDS.full - count;
            return `Язык «${label}»: открыта половина букв. Ещё ${left} ${plural(left, 'расшифровка', 'расшифровки', 'расшифровок')} до полного изучения.`;
        }
        return `Язык «${label}»: расшифровано ${count} из ${LANGUAGE_THRESHOLDS.half} до открытия половины букв.`;
    }

    function plural(n, one, few, many) {
        const mod10 = n % 10;
        const mod100 = n % 100;
        if (mod10 === 1 && mod100 !== 11) return one;
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
        return many;
    }
}
