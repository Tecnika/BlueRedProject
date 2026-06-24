import { createElement } from '../utils/dom.js?v=2';
import { store } from '../core/Store.js?v=2';
import { getPageBySlug, savePage, deletePage, getAllPages, slugify, createEmptyMatrix, MATRIX_ROW_LABELS, ensureFactionSubTags } from '../firebase/pagesService.js?v=2';
import { getAllTags } from '../firebase/tagsService.js?v=2';
import { translateError } from '../utils/translateError.js?v=2';

const FACTION_LABELS = { red: 'Красные', blue: 'Синие', purple: 'Фиолетовые' };

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

        // === Заголовок ===
        form.appendChild(createField('text', 'p-title', 'Название страницы', existing ? existing.title : ''));

        // === URL (авто, но редактируемый) ===
        const defaultSlug = existing ? existing.slug : '';
        form.appendChild(createField('text', 'p-slug', 'URL', defaultSlug, 'Очистите чтобы сгенерировать из названия'));

        // === Тип ===
        const pageType = existing ? existing.type || 'faction' : 'faction';
        form.appendChild(createSelect('p-type', 'Тип страницы', pageType, [
            { value: 'general', text: 'Общая' },
            { value: 'faction', text: 'Фракционная' }
        ]));

        // === Теги доступа ===
        const tagLabel = createElement('label', { className: 'page-edit-page__label', text: 'Теги доступа' });
        form.appendChild(tagLabel);

        const tagToolbar = createElement('div', { className: 'page-edit-page__tag-toolbar' });
        const selectAllBtn = createElement('button', { className: 'page-edit-page__tag-select-all', text: 'Выбрать все', attributes: { type: 'button' } });
        const deselectAllBtn = createElement('button', { className: 'page-edit-page__tag-select-all', text: 'Сбросить', attributes: { type: 'button' } });
        tagToolbar.appendChild(selectAllBtn);
        tagToolbar.appendChild(deselectAllBtn);
        form.appendChild(tagToolbar);

        const existingTags = [...(existing ? existing.tags || [] : [])];
        const pageTagContainer = createElement('div', { className: 'page-edit-page__tags' });
        allTags.forEach(tag => {
            const checked = existingTags.includes(tag.name);
            const label = createElement('label', { className: 'page-edit-page__tag-label' });
            label.appendChild(createElement('input', { attributes: { type: 'checkbox', value: tag.name, checked } }));
            label.appendChild(createElement('span', { text: tag.name }));
            pageTagContainer.appendChild(label);
        });

        selectAllBtn.addEventListener('click', () => {
            pageTagContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
        });
        deselectAllBtn.addEventListener('click', () => {
            pageTagContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        });

        form.appendChild(pageTagContainer);

        // === Родитель ===
        form.appendChild(createSelect('p-parent', 'Родительская страница', existing ? existing.parentId || '' : '', [
            { value: '', text: '— Корневая страница —' },
            ...allPages.filter(p => p.id !== (existing ? existing.id : null)).map(p => ({ value: p.id, text: p.title }))
        ]));

        // === Зона контента ===
        const contentArea = createElement('div', { id: 'p-content-area' });
        form.appendChild(contentArea);

        /** Перерисовать зону контента под выбранный тип */
        function renderContentByType(typeVal) {
            contentArea.innerHTML = '';
            if (typeVal === 'faction') {
                renderFactionEditor(contentArea, existing);
            } else {
                renderGeneralEditor(contentArea, existing);
            }
        }

        // Первичный рендер
        renderContentByType(pageType);

        // Смена типа
        const typeSelect = form.querySelector('#p-type');
        typeSelect.addEventListener('change', () => renderContentByType(typeSelect.value));

        // === Кнопки ===
        const actions = createElement('div', { className: 'page-edit-page__actions' });
        const saveBtn = createElement('button', { className: 'page-edit-page__save', text: isNew ? 'Создать' : 'Сохранить', attributes: { type: 'submit' } });
        const cancelBtn = createElement('a', { className: 'page-edit-page__cancel', text: 'Отмена', attributes: { href: existing ? `#/page/view?slug=${existing.slug}` : '#/pages' } });
        const msg = createElement('p', { className: 'page-edit-page__msg' });
        actions.appendChild(saveBtn);
        actions.appendChild(cancelBtn);
        form.appendChild(actions);
        form.appendChild(msg);
        container.appendChild(form);

        // === Удаление ===
        if (!isNew) {
            const deleteBtn = createElement('button', { className: 'page-edit-page__delete', text: 'Удалить страницу', attributes: { type: 'button' } });
            deleteBtn.addEventListener('click', async () => {
                if (!confirm('Удалить страницу навсегда?')) return;
                try { await deletePage(existing.id); window.location.hash = '#/pages'; }
                catch (err) { msg.textContent = 'Ошибка: ' + translateError(err); msg.className = 'page-edit-page__msg page-edit-page__msg--err'; }
            });
            container.appendChild(deleteBtn);
        }

        // === Сохранение ===
        form.addEventListener('submit', async () => {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Сохранение...';
            msg.style.display = 'none';

            try {
                const title = form.querySelector('#p-title').value.trim();
                if (!title) throw new Error('Название обязательно');

                let slugVal = form.querySelector('#p-slug').value.trim();
                if (!slugVal) {
                    slugVal = slugify(title);
                }
                if (!slugVal) throw new Error('Не удалось сгенерировать URL');

                const type = form.querySelector('#p-type').value;
                const pageTags = [];
                pageTagContainer.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => pageTags.push(cb.value));

                const data = { title, slug: slugVal, type, tags: pageTags, parentId: form.querySelector('#p-parent').value || null, createdBy: user.uid };

                if (type === 'general') {
                    data.content = form.querySelector('#p-content')?.value || '';
                    data.images = [];
                    const imgInputs = contentArea.querySelectorAll('.page-edit__img-input');
                    imgInputs.forEach(inp => { if (inp.value.trim()) data.images.push(inp.value.trim()); });
                } else {
                    const matrix = {};
                    for (const f of ['red', 'blue', 'purple']) {
                        const fGroup = {};
                        for (const row of ['info', 'propaganda', 'hard-propaganda']) {
                            const content = form.querySelector(`#cell-${f}-${row}`)?.value || '';
                            const images = [];
                            form.querySelectorAll(`#cell-img-${f}-${row}`).forEach(inp => { if (inp.value.trim()) images.push(inp.value.trim()); });
                            fGroup[row] = { content, images };
                        }
                        matrix[f] = fGroup;
                    }
                    data.matrix = matrix;
                }

                await savePage(existing ? existing.id : null, data);

                // Авто-создание субтегов для фракционной страницы
                if (type === 'faction' && pageTags.length > 0) {
                    ensureFactionSubTags(pageTags).catch(() => {});
                }

                msg.textContent = 'Сохранено!';
                msg.className = 'page-edit-page__msg page-edit-page__msg--ok';
                msg.style.display = 'block';
                setTimeout(() => window.location.hash = `#/page/view?slug=${slugVal}`, 800);
            } catch (err) {
                msg.textContent = 'Ошибка: ' + translateError(err);
                msg.className = 'page-edit-page__msg page-edit-page__msg--err';
                msg.style.display = 'block';
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = isNew ? 'Создать' : 'Сохранить';
            }
        });

        section.appendChild(container);
    } catch (err) {
        section.appendChild(createElement('p', { className: 'page-edit-page__error', text: 'Ошибка: ' + translateError(err) }));
    }

    return section;
}

/* ========================================
   Общая страница — 1 зона редактирования
   ======================================== */

function renderGeneralEditor(area, existing) {
    area.appendChild(createElement('label', { className: 'page-edit-page__label', text: 'Содержимое', attributes: { for: 'p-content' } }));
    area.appendChild(createElement('textarea', { className: 'page-edit-page__textarea', text: existing ? existing.content || '' : '', attributes: { id: 'p-content', rows: 10, placeholder: '{{img:https://...}}' } }));

    area.appendChild(createElement('label', { className: 'page-edit-page__label', text: 'Изображения', attributes: { style: 'margin-top:var(--space-md);display:block' } }));
    const imgList = createElement('div', { className: 'page-edit__img-list' });
    const urls = existing && existing.images?.length ? existing.images : [''];
    urls.forEach(url => imgList.appendChild(createElement('input', { className: 'page-edit-page__input page-edit__img-input', attributes: { type: 'url', value: url || '', placeholder: 'https://...' } })));
    const addBtn = createElement('button', { className: 'page-edit-page__add-img', text: '+ Ещё', attributes: { type: 'button' } });
    addBtn.addEventListener('click', () => {
        imgList.insertBefore(createElement('input', { className: 'page-edit-page__input page-edit__img-input', attributes: { type: 'url', placeholder: 'https://...' } }), addBtn);
    });
    imgList.appendChild(addBtn);
    area.appendChild(imgList);
}

/* ========================================
   Фракционная страница — 3 секции × 3 колонки
   ======================================== */

function renderFactionEditor(area, existing) {
    const matrix = existing?.matrix ? existing.matrix : createEmptyMatrix();

    for (const row of ['info', 'propaganda', 'hard-propaganda']) {
        const section = createElement('div', { className: 'page-edit__faction-section' });
        section.appendChild(createElement('h3', { className: 'page-edit__faction-section-title', text: MATRIX_ROW_LABELS[row] }));

        const cols = createElement('div', { className: 'page-edit__faction-cols' });

        for (const f of ['red', 'blue', 'purple']) {
            const cell = matrix[f]?.[row] || { content: '', images: [] };
            const col = createElement('div', { className: `page-edit__faction-col page-edit__faction-col--${f}` });

            col.appendChild(createElement('div', { className: 'page-edit__faction-col-label', text: FACTION_LABELS[f] }));
            col.appendChild(createElement('textarea', {
                className: 'page-edit-page__textarea',
                text: cell.content || '',
                attributes: { id: `cell-${f}-${row}`, rows: 4, placeholder: '{{img:https://...}}' }
            }));

            const imgs = cell.images?.length ? cell.images : [''];
            imgs.forEach(url => col.appendChild(createElement('input', { className: 'page-edit-page__input page-edit__faction-img', attributes: { type: 'url', id: `cell-img-${f}-${row}`, value: url || '', placeholder: 'URL картинки' } })));

            cols.appendChild(col);
        }

        section.appendChild(cols);
        area.appendChild(section);
    }
}

/* ========================================
   Утилиты
   ======================================== */

function createField(type, id, label, value, placeholder) {
    const group = createElement('div', { className: 'page-edit-page__field' });
    group.appendChild(createElement('label', { className: 'page-edit-page__label', text: label, attributes: { for: id } }));
    const attrs = { type, id, value };
    if (placeholder) attrs.placeholder = placeholder;
    group.appendChild(createElement('input', { className: 'page-edit-page__input', attributes: attrs }));
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
