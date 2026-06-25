import { createElement } from '../utils/dom.js?v=3';
import { store } from '../core/Store.js?v=3';
import { addDocumentByCode, grantDocumentAccess } from '../firebase/documentsService.js?v=3';
import { updateUserProfile } from '../firebase/authService.js?v=3';
import { translateError } from '../utils/translateError.js?v=3';

export function DocumentAddPage() {
    const section = createElement('section', { className: 'document-add-page' });
    const user = store.get('user');

    if (!user) {
        section.appendChild(createElement('p', { className: 'document-add-page__error', text: 'Требуется идентификация' }));
        return section;
    }

    const container = createElement('div', { className: 'document-add-page__container' });
    container.appendChild(createElement('h1', { className: 'document-add-page__title', text: 'Добавить документ' }));

    const form = createElement('form', {
        className: 'document-add-page__form',
        events: { submit: (e) => e.preventDefault() }
    });

    const numGroup = createElement('div', { className: 'document-add-page__field' });
    const numInput = createElement('input', {
        className: 'document-add-page__input',
        attributes: { type: 'text', id: 'doc-number', placeholder: 'Номер документа (4 цифры)', maxlength: 4, autocomplete: 'off', inputmode: 'numeric' }
    });
    numGroup.appendChild(numInput);
    form.appendChild(numGroup);

    const keyGroup = createElement('div', { className: 'document-add-page__field' });
    const keyInput = createElement('input', {
        className: 'document-add-page__input',
        attributes: { type: 'text', id: 'doc-key', placeholder: 'Секретный код', maxlength: 8, autocomplete: 'off' }
    });
    keyGroup.appendChild(keyInput);
    form.appendChild(keyGroup);

    const submitBtn = createElement('button', {
        className: 'document-add-page__submit',
        text: 'Проверить и добавить',
        attributes: { type: 'submit' }
    });
    form.appendChild(submitBtn);

    const msg = createElement('p', { className: 'document-add-page__msg' });
    form.appendChild(msg);

    async function handleSubmit(number, key) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Проверка...';
        msg.style.display = 'none';

        try {
            const found = await addDocumentByCode(number, key);
            if (!found) throw new Error('Документ с такими данными не найден');

            const userDocs = user.documents || [];
            if (userDocs.includes(found.id)) {
                msg.textContent = 'Этот документ уже есть у вас';
                msg.className = 'document-add-page__msg document-add-page__msg--ok';
                msg.style.display = 'block';
                return;
            }

            await grantDocumentAccess(found.id, user.uid);
            const newDocs = [...userDocs, found.id];
            await updateUserProfile(user.uid, { documents: newDocs });
            store.set('user', { ...user, documents: newDocs });

            msg.innerHTML = `Документ № ${found.number} добавлен. <a href="#/documents/view?id=${found.id}">Открыть</a>`;
            msg.className = 'document-add-page__msg document-add-page__msg--ok';
            msg.style.display = 'block';
        } catch (err) {
            msg.textContent = translateError(err);
            msg.className = 'document-add-page__msg document-add-page__msg--err';
            msg.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Проверить и добавить';
        }
    }

    form.addEventListener('submit', () => {
        const number = numInput.value.trim();
        const key = keyInput.value.trim();
        if (!number || number.length !== 4) { msg.textContent = 'Введите 4 цифры номера'; msg.className = 'document-add-page__msg document-add-page__msg--err'; msg.style.display = 'block'; return; }
        if (!key || key.length !== 8) { msg.textContent = 'Введите 8-символьный код доступа'; msg.className = 'document-add-page__msg document-add-page__msg--err'; msg.style.display = 'block'; return; }
        handleSubmit(number, key);
    });

    container.appendChild(form);
    section.appendChild(container);

    // Авто-добавление по QR (параметры из URL)
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
