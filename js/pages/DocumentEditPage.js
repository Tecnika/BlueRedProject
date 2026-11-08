import { createElement } from '../utils/dom.js?v=21';
import {
    getDocument,
    getVersionsByNumber,
    createVersions,
    addVersion,
    updateDocument,
    deleteDocument
} from '../firebase/documentsService.js?v=21';
import { LEVELS, LEVEL_LABELS, DOC_FACTIONS, sortVersions } from '../domain/documents.js?v=21';
import { FACTION_LABELS } from '../utils/profile.js?v=21';
import { translateError } from '../utils/translateError.js?v=21';
import { Button } from '../components/Button.js?v=21';
import { StatusMessage, showMessage, showMessageHTML, hideMessage } from '../components/StatusMessage.js?v=21';
import { requireAuth } from '../components/PageLayout.js?v=21';

/** Одна строка версии: фракция + уровень + текст */
function createVersionRow(initial = {}) {
    const row = createElement('div', { className: 'document-edit-page__version-row' });

    const factionSelect = createElement('select', {
        className: 'document-edit-page__select',
        attributes: { 'aria-label': 'Фракция версии' }
    });
    for (const faction of DOC_FACTIONS) {
        const option = createElement('option', {
            text: FACTION_LABELS[faction] || faction,
            attributes: { value: faction }
        });
        if ((initial.faction || 'common') === faction) option.selected = true;
        factionSelect.appendChild(option);
    }

    const levelSelect = createElement('select', {
        className: 'document-edit-page__select',
        attributes: { 'aria-label': 'Уровень текста' }
    });
    for (const level of LEVELS) {
        const option = createElement('option', {
            text: LEVEL_LABELS[level],
            attributes: { value: level }
        });
        if ((initial.level || 'official') === level) option.selected = true;
        levelSelect.appendChild(option);
    }

    const head = createElement('div', { className: 'document-edit-page__version-head' });
    head.appendChild(factionSelect);
    head.appendChild(levelSelect);

    const removeBtn = Button({
        icon: 'close',
        variant: 'danger',
        size: 'sm',
        attributes: { type: 'button', 'aria-label': 'Удалить версию' }
    });

    const content = createElement('textarea', {
        className: 'document-edit-page__textarea',
        text: initial.content || '',
        attributes: { rows: 5, placeholder: 'Текст версии' }
    });

    row.appendChild(head);
    row.appendChild(removeBtn);
    row.appendChild(content);

    return {
        element: row,
        removeBtn,
        get data() {
            return {
                faction: factionSelect.value,
                level: levelSelect.value,
                content: content.value.trim()
            };
        }
    };
}

export async function DocumentEditPage(docId) {
    const section = createElement('section', { className: 'document-edit-page' });
    const user = requireAuth(section, { requiredRole: 'master' });
    if (!user) return section;

    const isNew = !docId;

    try {
        if (isNew) {
            section.appendChild(renderCreateForm());
        } else {
            const version = await getDocument(docId);
            if (!version) {
                section.appendChild(StatusMessage({ type: 'err', text: 'Файл не найден' }));
                return section;
            }
            section.appendChild(await renderEditForm(version));
        }
    } catch (err) {
        section.appendChild(StatusMessage({ type: 'err', text: 'Ошибка: ' + translateError(err) }));
    }

    return section;

    // ---------- создание группы версий ----------
    function renderCreateForm() {
        const container = createElement('div', { className: 'document-edit-page__container' });
        container.appendChild(createElement('h1', { className: 'document-edit-page__title', text: 'Создать файл' }));
        container.appendChild(createElement('p', {
            className: 'document-edit-page__hint',
            text: 'У файла один номер и от 1 до 12 версий: фракция и уровень. У каждой версии свой код доступа и QR.'
        }));

        const rowsHost = createElement('div', { className: 'document-edit-page__versions' });
        const rows = [];

        function addRow(initial) {
            const row = createVersionRow(initial);
            rows.push(row);
            rowsHost.appendChild(row.element);
            row.removeBtn.addEventListener('click', () => {
                if (rows.length === 1) return;
                rows.splice(rows.indexOf(row), 1);
                row.element.remove();
            });
        }

        addRow();

        const msg = StatusMessage({ type: 'ok', text: '', hidden: true });
        const saveBtn = Button({ text: 'Создать', attributes: { type: 'submit' } });

        const addBtn = Button({
            text: 'Добавить версию',
            icon: 'add',
            variant: 'secondary',
            size: 'sm',
            attributes: { type: 'button' },
            onClick: () => {
                if (rows.length >= 12) {
                    showMessage(msg, 'Максимум 12 версий', 'err');
                    return;
                }
                addRow();
            }
        });

        const form = createElement('form', {
            className: 'document-edit-page__form',
            events: { submit: (e) => e.preventDefault() }
        });

        form.appendChild(rowsHost);
        form.appendChild(addBtn);

        const actions = createElement('div', { className: 'document-edit-page__actions' });
        actions.appendChild(saveBtn);
        actions.appendChild(Button({
            text: 'Назад',
            variant: 'secondary',
            onClick: () => { window.location.hash = '#/documents'; }
        }));
        form.appendChild(actions);
        form.appendChild(msg);

        form.addEventListener('submit', async () => {
            hideMessage(msg);
            const items = rows.map(r => r.data).filter(item => item.content);

            if (items.length === 0) {
                showMessage(msg, 'Заполните хотя бы одну версию', 'err');
                return;
            }

            const combos = new Set();
            for (const item of items) {
                const key = item.faction + ':' + item.level;
                if (combos.has(key)) {
                    showMessage(msg, `Дубликат версии: ${FACTION_LABELS[item.faction]} · ${LEVEL_LABELS[item.level]}`, 'err');
                    return;
                }
                combos.add(key);
            }

            saveBtn.disabled = true;
            saveBtn.textContent = 'Создание...';
            try {
                const { number, versions } = await createVersions(items);
                const links = versions.map(v =>
                    `№ ${number} · ${FACTION_LABELS[v.faction]} · ${LEVEL_LABELS[v.level]} — код <strong>${v.accessKey}</strong> · <a href="#/documents/view?id=${v.id}">открыть</a>`
                ).join('<br>');
                showMessageHTML(msg, `Файл № ${number} создан.<br>${links}`, 'ok');
                form.querySelectorAll('button').forEach(b => { b.disabled = true; });
            } catch (err) {
                showMessage(msg, 'Ошибка: ' + translateError(err), 'err');
                saveBtn.disabled = false;
                saveBtn.textContent = 'Создать';
            }
        });

        container.appendChild(form);
        return container;
    }

    // ---------- редактирование версии ----------
    async function renderEditForm(version) {
        const container = createElement('div', { className: 'document-edit-page__container' });
        container.appendChild(createElement('h1', { className: 'document-edit-page__title', text: `Файл № ${version.number}` }));
        container.appendChild(createElement('p', {
            className: 'document-edit-page__hint',
            text: 'Редактируется одна версия. Остальные версии этого номера — ниже.'
        }));

        const row = createVersionRow(version);
        const msg = StatusMessage({ type: 'ok', text: '', hidden: true });
        const saveBtn = Button({ text: 'Сохранить', attributes: { type: 'submit' } });

        const form = createElement('form', {
            className: 'document-edit-page__form',
            events: { submit: (e) => e.preventDefault() }
        });
        form.appendChild(row.element);

        const actions = createElement('div', { className: 'document-edit-page__actions' });
        actions.appendChild(saveBtn);
        actions.appendChild(Button({
            text: 'Назад',
            variant: 'secondary',
            onClick: () => { window.location.hash = '#/documents'; }
        }));
        form.appendChild(actions);
        form.appendChild(msg);

        form.addEventListener('submit', async () => {
            hideMessage(msg);
            const data = row.data;
            if (!data.content) { showMessage(msg, 'Текст не может быть пустым', 'err'); return; }
            saveBtn.disabled = true;
            saveBtn.textContent = 'Сохранение...';
            try {
                await updateDocument(version.id, data);
                showMessage(msg, 'Сохранено', 'ok');
            } catch (err) {
                showMessage(msg, 'Ошибка: ' + translateError(err), 'err');
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Сохранить';
            }
        });

        container.appendChild(form);

        // Другие версии номера
        const versions = await getVersionsByNumber(version.number);
        container.appendChild(createElement('h2', { className: 'document-edit-page__subtitle', text: `Версии файла № ${version.number}` }));

        const list = createElement('div', { className: 'document-edit-page__version-list' });
        for (const v of versions.sort(sortVersions)) {
            const item = createElement('div', { className: 'document-edit-page__version-item' });
            item.appendChild(createElement('span', {
                text: `${FACTION_LABELS[v.faction] || v.faction} · ${LEVEL_LABELS[v.level] || v.level}`
            }));
            if (v.id === version.id) {
                item.appendChild(createElement('span', { className: 'document-edit-page__current-mark', text: 'текущая' }));
            } else {
                item.appendChild(Button({
                    text: 'Открыть',
                    variant: 'secondary',
                    size: 'sm',
                    href: `#/documents/edit?id=${v.id}`
                }));
            }
            item.appendChild(Button({
                text: 'Удалить версию',
                variant: 'danger',
                size: 'sm',
                onClick: async () => {
                    if (!confirm('Удалить эту версию файла?')) return;
                    try {
                        await deleteDocument(v.id);
                        if (v.id === version.id) window.location.hash = '#/documents';
                        else section.replaceChild(await renderEditForm(version), section.firstChild);
                    } catch (err) {
                        alert('Ошибка: ' + translateError(err));
                    }
                }
            }));
            list.appendChild(item);
        }
        container.appendChild(list);

        // Добавить версию к номеру
        const addWrap = createElement('div', { className: 'document-edit-page__add-version' });
        addWrap.appendChild(createElement('h2', { className: 'document-edit-page__subtitle', text: 'Добавить версию к этому номеру' }));
        const newRow = createVersionRow();
        addWrap.appendChild(newRow.element);

        const addMsg = StatusMessage({ type: 'ok', text: '', hidden: true });
        addWrap.appendChild(Button({
            text: 'Добавить версию',
            icon: 'add',
            variant: 'primary',
            size: 'sm',
            onClick: async () => {
                hideMessage(addMsg);
                const data = newRow.data;
                if (!data.content) { showMessage(addMsg, 'Заполните текст', 'err'); return; }
                try {
                    const created = await addVersion(version.number, data);
                    showMessageHTML(addMsg, `Версия добавлена. Код: <strong>${created.accessKey}</strong>`, 'ok');
                    newRow.element.querySelector('textarea').value = '';
                } catch (err) {
                    showMessage(addMsg, 'Ошибка: ' + translateError(err), 'err');
                }
            }
        }));
        addWrap.appendChild(addMsg);
        container.appendChild(addWrap);

        return container;
    }
}
