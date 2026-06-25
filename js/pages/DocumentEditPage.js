import { createElement } from '../utils/dom.js?v=3';
import { store } from '../core/Store.js?v=3';
import { getDocument, createDocument, updateDocument } from '../firebase/documentsService.js?v=3';
import { translateError } from '../utils/translateError.js?v=3';

const FACTION_OPTIONS = [
    { value: 'red', text: 'Красные' },
    { value: 'blue', text: 'Синие' },
    { value: 'purple', text: 'Фиолетовые' }
];

export async function DocumentEditPage(docId) {
    const section = createElement('section', { className: 'document-edit-page' });
    const user = store.get('user');

    if (!user || user.role !== 'master') {
        section.appendChild(createElement('p', { className: 'document-edit-page__error', text: 'Только для мастерской' }));
        return section;
    }

    const isNew = !docId;
    let existing = null;

    try {
        if (!isNew) {
            existing = await getDocument(docId);
            if (!existing) {
                section.appendChild(createElement('p', { className: 'document-edit-page__error', text: 'Документ не найден' }));
                return section;
            }
        }

        const container = createElement('div', { className: 'document-edit-page__container' });
        container.appendChild(createElement('h1', { className: 'document-edit-page__title', text: isNew ? 'Создать документ' : 'Редактировать документ' }));

        const form = createElement('form', { className: 'document-edit-page__form', events: { submit: (e) => e.preventDefault() } });

        form.appendChild(createSelect('doc-faction', 'Фракция', existing ? existing.faction : '', FACTION_OPTIONS));

        form.appendChild(createField('textarea', 'doc-content', 'Текст документа', existing ? existing.content || '' : ''));

        const msg = createElement('p', { className: 'document-edit-page__msg' });

        const actions = createElement('div', { className: 'document-edit-page__actions' });
        const saveBtn = createElement('button', { className: 'document-edit-page__save', text: isNew ? 'Создать' : 'Сохранить', attributes: { type: 'submit' } });
        const cancelBtn = createElement('a', { className: 'document-edit-page__cancel', text: 'Назад', attributes: { href: '#/documents' } });
        actions.appendChild(saveBtn);
        actions.appendChild(cancelBtn);
        form.appendChild(actions);
        form.appendChild(msg);

        let createdAccessKey = null;

        form.addEventListener('submit', async () => {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Сохранение...';
            msg.style.display = 'none';

            try {
                const faction = form.querySelector('#doc-faction').value;
                const content = form.querySelector('#doc-content').value.trim();

                if (!faction) throw new Error('Выберите фракцию');
                if (!content) throw new Error('Текст документа не может быть пустым');

                if (isNew) {
                    const result = await createDocument({ faction, content });
                    createdAccessKey = result.accessKey;
                    msg.innerHTML = `Документ № ${result.number} создан. ` +
                        `<strong>Код доступа: ${result.accessKey}</strong> (показать игрокам для добавления). ` +
                        `<a href="#/documents/view?id=${result.id}">Открыть</a>`;
                    msg.className = 'document-edit-page__msg document-edit-page__msg--ok';
                } else {
                    await updateDocument(docId, { faction, content });
                    msg.textContent = 'Сохранено';
                    msg.className = 'document-edit-page__msg document-edit-page__msg--ok';
                }
                msg.style.display = 'block';
            } catch (err) {
                msg.textContent = 'Ошибка: ' + translateError(err);
                msg.className = 'document-edit-page__msg document-edit-page__msg--err';
                msg.style.display = 'block';
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = isNew ? 'Создать' : 'Сохранить';
            }
        });

        container.appendChild(form);
        section.appendChild(container);
    } catch (err) {
        section.appendChild(createElement('p', { className: 'document-edit-page__error', text: 'Ошибка: ' + translateError(err) }));
    }

    return section;
}

function createField(type, id, label, value) {
    const group = createElement('div', { className: 'document-edit-page__field' });
    group.appendChild(createElement('label', { className: 'document-edit-page__label', text: label, attributes: { for: id } }));
    if (type === 'textarea') {
        group.appendChild(createElement('textarea', { className: 'document-edit-page__textarea', text: value, attributes: { id, rows: 12 } }));
    } else {
        group.appendChild(createElement('input', { className: 'document-edit-page__input', attributes: { type, id, value } }));
    }
    return group;
}

function createSelect(id, label, value, options) {
    const group = createElement('div', { className: 'document-edit-page__field' });
    group.appendChild(createElement('label', { className: 'document-edit-page__label', text: label, attributes: { for: id } }));
    const select = createElement('select', { className: 'document-edit-page__input', attributes: { id } });
    options.forEach(opt => {
        const option = createElement('option', { text: opt.text, attributes: { value: opt.value } });
        if (opt.value === value) option.selected = true;
        select.appendChild(option);
    });
    group.appendChild(select);
    return group;
}
