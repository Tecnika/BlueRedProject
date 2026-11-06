import { createElement } from '../utils/dom.js?v=4';
import { getDocument, createDocument, updateDocument } from '../firebase/documentsService.js?v=4';
import { translateError } from '../utils/translateError.js?v=4';
import { Button } from '../components/Button.js?v=4';
import { FormField } from '../components/FormField.js?v=4';
import { StatusMessage, showMessage, showMessageHTML, hideMessage } from '../components/StatusMessage.js?v=4';
import { requireAuth } from '../components/PageLayout.js?v=4';
import { FACTIONS, FACTION_LABELS } from '../utils/profile.js?v=4';

const FACTION_OPTIONS = [
    { value: 'common', text: 'Общий (всем)' },
    { value: 'red', text: 'Красные' },
    { value: 'blue', text: 'Синие' },
    { value: 'purple', text: 'Фиолетовые' }
];


export async function DocumentEditPage(docId) {
    const section = createElement('section', { className: 'document-edit-page' });
    const user = requireAuth(section, { requiredRole: 'master' });
    if (!user) return section;

    const isNew = !docId;
    let existing = null;

    try {
        if (!isNew) {
            existing = await getDocument(docId);
            if (!existing) {
                section.appendChild(StatusMessage({ type: 'err', text: 'Документ не найден' }));
                return section;
            }
        }

        const container = createElement('div', { className: 'document-edit-page__container' });
        container.appendChild(createElement('h1', { className: 'document-edit-page__title', text: isNew ? 'Создать документ' : 'Редактировать документ' }));

        const form = createElement('form', { className: 'document-edit-page__form', events: { submit: (e) => e.preventDefault() } });

        form.appendChild(FormField({
            type: 'select', id: 'doc-faction', label: 'Принадлежность',
            value: existing ? (existing.faction || 'common') : 'common',
            options: FACTION_OPTIONS
        }));

        form.appendChild(FormField({
            type: 'textarea', id: 'doc-content', label: 'Основной текст',
            value: existing ? existing.content || '' : '', rows: 10,
            placeholder: 'Версия документа для своей фракции'
        }));

        // --- Точки зрения других фракций ---
        form.appendChild(createElement('h3', { className: 'document-edit-page__subtitle', text: 'Точки зрения фракций' }));
        form.appendChild(createElement('p', {
            className: 'document-edit-page__hint',
            text: 'Если для фракции заполнена точка зрения — она увидит этот текст вместо зашифрованного документа.'
        }));

        const views = existing?.views || {};
        for (const f of FACTIONS) {
            form.appendChild(FormField({
                type: 'textarea', id: `doc-view-${f}`, label: `Точка зрения: ${FACTION_LABELS[f]}`,
                value: views[f] || '', rows: 5,
                placeholder: 'Можно оставить пустым'
            }));
        }

        // --- Пропаганда ---
        form.appendChild(createElement('h3', { className: 'document-edit-page__subtitle', text: 'Пропаганда' }));

        const propWrap = createElement('label', { className: 'document-edit-page__checkbox' });
        const propCheckbox = createElement('input', { attributes: { type: 'checkbox' } });
        if (existing?.propaganda?.enabled) propCheckbox.checked = true;
        propWrap.appendChild(propCheckbox);
        propWrap.appendChild(createElement('span', { text: 'Показывать версию для широкого круга' }));
        form.appendChild(propWrap);

        form.appendChild(FormField({
            type: 'textarea', id: 'doc-propaganda', label: 'Текст пропаганды',
            value: existing?.propaganda?.content || '', rows: 6,
            placeholder: 'Версия для всех, без шифра'
        }));

        const msg = StatusMessage({ type: 'ok', text: '', hidden: true });
        const saveBtn = Button({ text: isNew ? 'Создать' : 'Сохранить', attributes: { type: 'submit' } });
        const cancelBtn = Button({
            text: 'Назад',
            variant: 'secondary',
            onClick: () => {
                if (document.referrer && document.referrer !== window.location.href) {
                    window.history.back();
                } else {
                    window.location.hash = '#/documents';
                }
            }
        });

        const actions = createElement('div', { className: 'document-edit-page__actions' });
        actions.appendChild(saveBtn);
        actions.appendChild(cancelBtn);
        form.appendChild(actions);
        form.appendChild(msg);

        form.addEventListener('submit', async () => {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Сохранение...';
            hideMessage(msg);

            try {
                const faction = form.querySelector('#doc-faction').value;
                const content = form.querySelector('#doc-content').value.trim();
                if (!faction) throw new Error('Выберите принадлежность');
                if (!content) throw new Error('Текст документа не может быть пустым');

                const viewsData = {};
                for (const f of FACTIONS) {
                    const value = form.querySelector(`#doc-view-${f}`).value.trim();
                    if (value) viewsData[f] = value;
                }

                const propaganda = {
                    enabled: propCheckbox.checked,
                    content: form.querySelector('#doc-propaganda').value.trim(),
                    images: existing?.propaganda?.images || []
                };

                const data = { faction, content, views: viewsData, propaganda };

                if (isNew) {
                    const result = await createDocument(data);
                    showMessageHTML(msg, `Документ № ${result.number} создан. ` +
                        `<strong>Код доступа: ${result.accessKey}</strong> (показать игрокам для добавления). ` +
                        `<a href="#/documents/view?id=${result.id}">Открыть</a>`, 'ok');
                } else {
                    await updateDocument(docId, data);
                    showMessage(msg, 'Сохранено', 'ok');
                }
            } catch (err) {
                showMessage(msg, 'Ошибка: ' + translateError(err), 'err');
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = isNew ? 'Создать' : 'Сохранить';
            }
        });

        container.appendChild(form);
        section.appendChild(container);
    } catch (err) {
        section.appendChild(StatusMessage({ type: 'err', text: 'Ошибка: ' + translateError(err) }));
    }

    return section;
}
