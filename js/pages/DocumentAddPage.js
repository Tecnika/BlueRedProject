import { createElement } from '../utils/dom.js?v=24';
import { store } from '../core/Store.js?v=24';
import { addDocumentByCode, grantDocumentAccess } from '../firebase/documentsService.js?v=24';
import { updateUserProfile } from '../firebase/authService.js?v=24';
import { translateError } from '../utils/translateError.js?v=24';
import { BackButton } from '../components/BackButton.js?v=24';
import { Button } from '../components/Button.js?v=24';
import { StatusMessage, showMessage, showMessageHTML, hideMessage } from '../components/StatusMessage.js?v=24';
import { FACTION_LABELS } from '../utils/profile.js?v=24';
import { LEVEL_LABELS } from '../domain/documents.js?v=24';

export function DocumentAddPage() {
    const section = createElement('section', { className: 'document-add-page' });
    const user = store.get('user');

    if (!user) {
        section.appendChild(StatusMessage({ type: 'err', text: 'Требуется идентификация' }));
        return section;
    }

    const container = createElement('div', { className: 'document-add-page__container' });
    container.appendChild(BackButton({ fallback: '#/documents' }));
    container.appendChild(createElement('h1', { className: 'document-add-page__title', text: 'Добавить файл' }));

    const form = createElement('form', {
        className: 'document-add-page__form',
        events: { submit: (e) => e.preventDefault() }
    });

    const numInput = createElement('input', {
        className: 'document-add-page__input',
        attributes: { type: 'text', id: 'doc-number', placeholder: 'Номер файла (4 цифры)', maxlength: 4, autocomplete: 'off', inputmode: 'numeric' }
    });
    const numGroup = createElement('div', { className: 'document-add-page__field' });
    numGroup.appendChild(numInput);
    form.appendChild(numGroup);

    const keyInput = createElement('input', {
        className: 'document-add-page__input',
        attributes: { type: 'text', id: 'doc-key', placeholder: 'Секретный код', maxlength: 8, autocomplete: 'off' }
    });
    const keyGroup = createElement('div', { className: 'document-add-page__field' });
    keyGroup.appendChild(keyInput);
    form.appendChild(keyGroup);

    const submitBtn = Button({ text: 'Проверить и добавить', attributes: { type: 'submit' } });
    form.appendChild(submitBtn);

    const msg = StatusMessage({ type: 'ok', text: '', hidden: true });
    form.appendChild(msg);

    async function handleSubmit(number, key) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Проверка...';
        hideMessage(msg);

        try {
            const found = await addDocumentByCode(number, key);
            if (!found) throw new Error('Файл с такими данными не найден');

            const userDocs = user.documents || [];
            if (userDocs.includes(found.id)) {
                showMessage(msg, 'Этот файл уже есть у вас', 'ok');
                return;
            }

            await grantDocumentAccess(found.id, user.uid);
            const newDocs = [...userDocs, found.id];
            await updateUserProfile(user.uid, { documents: newDocs });
            store.set('user', { ...user, documents: newDocs });

            showMessageHTML(msg, `Файл № ${found.number} · ${FACTION_LABELS[found.faction] || found.faction} · ${LEVEL_LABELS[found.level] || found.level} добавлен. <a href="#/documents/view?id=${found.id}">Открыть</a>`, 'ok');
        } catch (err) {
            showMessage(msg, translateError(err), 'err');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Проверить и добавить';
        }
    }

    form.addEventListener('submit', () => {
        const number = numInput.value.trim();
        const key = keyInput.value.trim();
        if (!number || number.length !== 4) { showMessage(msg, 'Введите 4 цифры номера', 'err'); return; }
        if (!key || key.length !== 8) { showMessage(msg, 'Введите 8-символьный код доступа', 'err'); return; }
        handleSubmit(number, key);
    });

    container.appendChild(form);
    section.appendChild(container);

    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const qrId = params.get('id');
    const qrNumber = params.get('number');
    const qrKey = params.get('key');
    if (qrId && qrNumber && qrKey) {
        numInput.value = qrNumber;
        keyInput.value = qrKey;
        handleSubmit(qrNumber, qrKey);
    }

    return section;
}
