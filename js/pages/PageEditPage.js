import { createElement } from '../utils/dom.js';
import { store } from '../core/Store.js';
import { getPageBySlug, savePage, deletePage, getAllPages, slugify, createEmptyMatrix, MATRIX_ROW_LABELS } from '../firebase/pagesService.js';
import { getAllTags } from '../firebase/tagsService.js';

const FACTION_LABELS = { red: 'Красные', blue: 'Синие', purple: 'Фиолетовые' };
const TYPE_OPTIONS = [
    { value: 'general', text: 'Общая (серый фон, доступ по тегам)' },
    { value: 'faction', text: 'Фракционная (таблица 3×3)' }
];

export async function PageEditPage(slug) {
    const section = createElement('section', { className: 'page-edit-page' });
    const user = store.get('user');

    if (!user || user.role !== 'master') {
        section.appendChild(createElement('p', { className: 'page-edit-page__error', text: 'Доступно только мастеру' }));
        return section;
    }

    try {
        const existing = slug ? await getPageBySlug(slug) : null;
        const isNew = !existing;
        const allPages = await getAllPages();
        const allTags = await getAllTags();

        const container = createElement('div', { className: 'page-edit-page__container' });

        container.appendChild(createElement('h1', { className: 'page-edit-page__title', text: isNew ? 'Создать страницу' : `Редактировать: ${existing.title}` }));

        const form = createElement('form', { className: 'page-edit-page__form', events: { submit: (e) => e.preventDefault() } });

        form.appendChild(createField('text', 'p-title', 'Заголовок', existing ? existing.title : ''));
        form.appendChild(createFieldReadonly('p-slug', 'URL (генерируется)', existing ? existing.slug : ''));

        // Тип страницы
        const pageType = existing ? existing.type || 'general' : 'general';
        form.appendChild(createSelect('p-type', 'Тип страницы', pageType, TYPE_OPTIONS));

        // Теги доступа
        const tagLabel = createElement('label', { className: 'page-edit-page__label', text: 'Теги доступа к странице' });
        form.appendChild(tagLabel);
        const existingTags = [...(existing ? existing.tags || [] : [])];
        const pageTagContainer = createElement('div', { className: 'page-edit-page__tags' });
        allTags.forEach(tag => {
            const checked = existingTags.includes(tag.name);
            const label = createElement('label', { className: 'page-edit-page__tag-label' });
            label.appendChild(createElement('input', { attributes: { type: 'checkbox', value: tag.name, checked } }));
            label.appendChild(createElement('span', { text: tag.name }));
            pageTagContainer.appendChild(label);
        });
        form.appendChild(pageTagContainer);

        // Родительская страница
        form.appendChild(createSelect('p-parent', 'Родительская страница', existing ? existing.parentId || '' : '', [
            { value: '', text: '— Корневая страница —' },
            ...allPages.filter(p => p.id !== (existing ? existing.id : null)).map(p => ({ value: p.id, text: p.title }))
        ]));

        // Область контента/матрицы
        const contentArea = createElement('div', { id: 'p-content-area' });
        if (pageType === 'faction') {
            renderFactionEditor(contentArea, existing, allTags);
        } else {
            renderGeneralEditor(contentArea, existing);
        }
        form.appendChild(contentArea);

        // Переключение типа
        const typeSelect = form.querySelector('#p-type');
        typeSelect.addEventListener('change', () => {
            if (typeSelect.value === 'faction') {
                renderFactionEditor(contentArea, null, allTags);
            } else {
                renderGeneralEditor(contentArea, null);
            }
        });

        // Кнопки
        const actions = createElement('div', { className: 'page-edit-page__actions' });
        const saveBtn = createElement('button', { className: 'page-edit-page__save', text: isNew ? 'Создать' : 'Сохранить', attributes: { type: 'submit' } });
        const cancelBtn = createElement('a', { className: 'page-edit-page__cancel', text: 'Отмена', attributes: { href: existing ? `#/page/view?slug=${existing.slug}` : '#/pages' } });
        const msg = createElement('p', { className: 'page-edit-page__msg' });
        actions.appendChild(saveBtn);
        actions.appendChild(cancelBtn);
        form.appendChild(actions);
        form.appendChild(msg);
        container.appendChild(form);

        // Удаление
        if (!isNew) {
            const deleteBtn = createElement('button', { className: 'page-edit-page__delete', text: 'Удалить страницу', attributes: { type: 'button' } });
            deleteBtn.addEventListener('click', async () => {
                if (!confirm('Удалить страницу навсегда?')) return;
                try { await deletePage(existing.id); window.location.hash = '#/pages'; }
                catch (err) { msg.textContent = 'Ошибка: ' + err.message; msg.className = 'page-edit-page__msg page-edit-page__msg--err'; }
            });
            container.appendChild(deleteBtn);
        }

        // Сохранение
        form.addEventListener('submit', async () => {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Сохранение...';
            msg.style.display = 'none';

            try {
                const title = form.querySelector('#p-title').value.trim();
                if (!title) throw new Error('Заголовок обязателен');

                const type = form.querySelector('#p-type').value;
                const pageTags = [];
                pageTagContainer.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => pageTags.push(cb.value));

                const data = {
                    title,
                    type,
                    tags: pageTags,
                    parentId: form.querySelector('#p-parent').value || null,
                    createdBy: user.uid
                };

                if (type === 'general') {
                    data.content = form.querySelector('#p-content')?.value || '';
                    data.images = [];
                    form.querySelectorAll('#p-images input').forEach(inp => { if (inp.value.trim()) data.images.push(inp.value.trim()); });
                } else {
                    const matrix = {};
                    for (const faction of ['red', 'blue', 'purple']) {
                        const fGroup = {};
                        for (const row of ['info', 'propaganda', 'hard-propaganda']) {
                            const content = form.querySelector(`#cell-${faction}-${row}`)?.value || '';
                            const tags = [];
                            form.querySelectorAll(`#cell-tags-${faction}-${row} input[type="checkbox"]:checked`).forEach(cb => tags.push(cb.value));
                            const images = [];
                            form.querySelectorAll(`#cell-img-${faction}-${row}`).forEach(inp => { if (inp.value.trim()) images.push(inp.value.trim()); });
                            fGroup[row] = { content, tags, images };
                        }
                        matrix[faction] = fGroup;
                    }
                    data.matrix = matrix;
                }

                const slugValue = isNew ? slugify(title) + '-' + Date.now().toString(36) : existing.slug;
                data.slug = slugValue;

                await savePage(existing ? existing.id : null, data);

                msg.textContent = 'Сохранено!';
                msg.className = 'page-edit-page__msg page-edit-page__msg--ok';
                msg.style.display = 'block';
                setTimeout(() => window.location.hash = `#/page/view?slug=${slugValue}`, 800);
            } catch (err) {
                msg.textContent = 'Ошибка: ' + err.message;
                msg.className = 'page-edit-page__msg page-edit-page__msg--err';
                msg.style.display = 'block';
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = isNew ? 'Создать' : 'Сохранить';
            }
        });

        section.appendChild(container);
    } catch (err) {
        section.appendChild(createElement('p', { className: 'page-edit-page__error', text: 'Ошибка: ' + err.message }));
    }

    return section;
}

function renderGeneralEditor(area, existing) {
    area.innerHTML = '';
    area.appendChild(createElement('label', { className: 'page-edit-page__label', text: 'Содержимое', attributes: { for: 'p-content' } }));
    area.appendChild(createElement('textarea', { className: 'page-edit-page__textarea', text: existing ? existing.content || '' : '', attributes: { id: 'p-content', rows: 10, placeholder: 'Текст страницы... {{img:https://...}}' } }));

    const imgLabel = createElement('label', { className: 'page-edit-page__label', text: 'Изображения', attributes: { style: 'margin-top:var(--space-md);display:block' } });
    area.appendChild(imgLabel);
    const imgContainer = createElement('div', { id: 'p-images', className: 'page-edit__img-list' });
    const urls = existing && existing.images && existing.images.length ? existing.images : [''];
    urls.forEach(url => {
        imgContainer.appendChild(createElement('input', { className: 'page-edit-page__input page-edit__img-input', attributes: { type: 'url', value: url || '', placeholder: 'https://...' } }));
    });
    const addImgBtn = createElement('button', { className: 'page-edit-page__add-img', text: '+ Ещё', attributes: { type: 'button' } });
    addImgBtn.addEventListener('click', () => {
        imgContainer.insertBefore(createElement('input', { className: 'page-edit-page__input page-edit__img-input', attributes: { type: 'url', placeholder: 'https://...' } }), addImgBtn);
    });
    imgContainer.appendChild(addImgBtn);
    area.appendChild(imgContainer);
}

function renderFactionEditor(area, existing, allTags) {
    area.innerHTML = '';
    const matrix = existing && existing.matrix ? existing.matrix : createEmptyMatrix();

    const wrapper = createElement('div', { className: 'page-edit__matrix' });

    // Заголовок таблицы
    const headerRow = createElement('div', { className: 'page-edit__matrix-row page-edit__matrix-header' });
    headerRow.appendChild(createElement('div', { className: 'page-edit__matrix-cell page-edit__matrix-label' }));
    for (const f of ['red', 'blue', 'purple']) {
        headerRow.appendChild(createElement('div', { className: `page-edit__matrix-cell page-edit__matrix-col-head page-edit__matrix-col-head--${f}`, text: FACTION_LABELS[f] }));
    }
    wrapper.appendChild(headerRow);

    for (const row of ['info', 'propaganda', 'hard-propaganda']) {
        const rowEl = createElement('div', { className: 'page-edit__matrix-row' });
        rowEl.appendChild(createElement('div', { className: 'page-edit__matrix-cell page-edit__matrix-label', text: MATRIX_ROW_LABELS[row] }));

        for (const f of ['red', 'blue', 'purple']) {
            const cell = matrix[f] && matrix[f][row] ? matrix[f][row] : { content: '', tags: [], images: [] };
            const cellEl = createElement('div', { className: 'page-edit__matrix-cell page-edit__matrix-editor' });

            const textarea = createElement('textarea', {
                className: 'page-edit-page__textarea',
                text: cell.content || '',
                attributes: { id: `cell-${f}-${row}`, rows: 4, placeholder: '{{img:https://...}}' }
            });
            cellEl.appendChild(textarea);

            // Картинки
            const imgs = cell.images && cell.images.length ? cell.images : [''];
            const imgContainer = createElement('div', { className: 'page-edit__matrix-imgs' });
            imgs.forEach(url => {
                imgContainer.appendChild(createElement('input', { className: 'page-edit-page__input', attributes: { type: 'url', id: `cell-img-${f}-${row}`, value: url || '', placeholder: 'URL картинки' } }));
            });
            cellEl.appendChild(imgContainer);

            // Теги
            const tagContainer = createElement('div', { className: 'page-edit__matrix-tags', id: `cell-tags-${f}-${row}` });
            allTags.forEach(tag => {
                const checked = cell.tags && cell.tags.includes(tag.name);
                const label = createElement('label', { className: 'page-edit-page__tag-label' });
                label.appendChild(createElement('input', { attributes: { type: 'checkbox', value: tag.name, checked } }));
                label.appendChild(createElement('span', { text: tag.name }));
                tagContainer.appendChild(label);
            });
            cellEl.appendChild(tagContainer);

            rowEl.appendChild(cellEl);
        }

        wrapper.appendChild(rowEl);
    }

    area.appendChild(wrapper);
}

function createField(type, id, label, value) {
    const group = createElement('div', { className: 'page-edit-page__field' });
    group.appendChild(createElement('label', { className: 'page-edit-page__label', text: label, attributes: { for: id } }));
    group.appendChild(createElement('input', { className: 'page-edit-page__input', attributes: { type, id, value } }));
    return group;
}

function createFieldReadonly(id, label, value) {
    const group = createElement('div', { className: 'page-edit-page__field' });
    group.appendChild(createElement('label', { className: 'page-edit-page__label', text: label, attributes: { for: id } }));
    group.appendChild(createElement('input', { className: 'page-edit-page__input', attributes: { type: 'text', id, value, readonly: '' } }));
    return group;
}

function createSelect(id, label, value, options) {
    const group = createElement('div', { className: 'page-edit-page__field' });
    group.appendChild(createElement('label', { className: 'page-edit-page__label', text: label, attributes: { for: id } }));
    const select = createElement('select', { className: 'page-edit-page__input', attributes: { id } });
    options.forEach(opt => {
        const option = createElement('option', { text: opt.text, attributes: { value: opt.value } });
        if (opt.value === value) option.selected = true;
        select.appendChild(option);
    });
    group.appendChild(select);
    return group;
}
