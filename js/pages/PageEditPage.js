import { createElement } from '../utils/dom.js?v=10';
import { store } from '../core/Store.js?v=10';
import { getPageBySlug, savePage, deletePage, getAllPages, slugify, createEmptyMatrix, MATRIX_ROW_LABELS, ensureFactionSubTags } from '../firebase/pagesService.js?v=10';
import { getAllTags } from '../firebase/tagsService.js?v=10';
import { translateError } from '../utils/translateError.js?v=10';
import { Button } from '../components/Button.js?v=10';
import { FormField } from '../components/FormField.js?v=10';
import { Icon } from '../components/Icon.js?v=10';
import { StatusMessage, showMessage, hideMessage } from '../components/StatusMessage.js?v=10';
import { FACTIONS, FACTION_LABELS } from '../utils/profile.js?v=10';


export async function PageEditPage(slug) {
    const section = createElement('section', { className: 'page-edit-page' });
    const user = store.get('user');

    if (!user || user.role !== 'master') {
        section.appendChild(StatusMessage({ type: 'err', text: 'Только для мастерской' }));
        return section;
    }

    try {
        const existing = slug ? await getPageBySlug(slug) : null;
        const isNew = !existing;
        const allPages = await getAllPages();
        const allTags = await getAllTags();

        const container = createElement('div', { className: 'page-edit-page__container' });
        container.appendChild(createElement('h1', { className: 'page-edit-page__title', text: isNew ? 'Новое досье' : `Редактирование: ${existing.title}` }));

        const form = createElement('form', { className: 'page-edit-page__form', events: { submit: (e) => e.preventDefault() } });

        form.appendChild(FormField({ type: 'input', id: 'p-title', label: 'Кодовое название', value: existing ? existing.title : '' }));
        form.appendChild(FormField({ type: 'input', id: 'p-slug', label: 'Идентификатор', value: existing ? existing.slug : '', placeholder: 'Очистите чтобы сгенерировать из названия' }));

        const pageType = existing ? existing.type || 'faction' : 'faction';
        form.appendChild(FormField({
            type: 'select', id: 'p-type', label: 'Категория досье', value: pageType,
            options: [
                { value: 'general', text: 'Общего доступа' },
                { value: 'faction', text: 'Фракционное' }
            ]
        }));

        const tagLabel = createElement('label', { className: 'page-edit-page__label', text: 'Гриф доступа' });
        form.appendChild(tagLabel);

        const tagToolbar = createElement('div', { className: 'page-edit-page__tag-toolbar' });
        tagToolbar.appendChild(Button({ text: 'Выбрать всё', variant: 'secondary', size: 'sm', attributes: { type: 'button' }, onClick: () => {
            pageTagContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
        }}));
        tagToolbar.appendChild(Button({ text: 'Сброс', variant: 'secondary', size: 'sm', attributes: { type: 'button' }, onClick: () => {
            pageTagContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        }}));
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
        form.appendChild(pageTagContainer);

        form.appendChild(FormField({
            type: 'select', id: 'p-parent', label: 'Вышестоящее досье', value: existing ? existing.parentId || '' : '',
            options: [
                { value: '', text: '— Корневой узел —' },
                ...allPages.filter(p => p.id !== (existing ? existing.id : null)).map(p => ({ value: p.id, text: p.title }))
            ]
        }));

        const contentArea = createElement('div', { id: 'p-content-area' });
        form.appendChild(contentArea);

        function renderContentByType(typeVal) {
            contentArea.innerHTML = '';
            if (typeVal === 'faction') {
                renderFactionEditor(contentArea, existing);
            } else {
                renderGeneralEditor(contentArea, existing);
            }
        }

        renderContentByType(pageType);

        const typeSelect = form.querySelector('#p-type');
        typeSelect.addEventListener('change', () => renderContentByType(typeSelect.value));

        const actions = createElement('div', { className: 'page-edit-page__actions' });
        const saveBtn = Button({ text: isNew ? 'Создать' : 'Сохранить', attributes: { type: 'submit' } });
        const cancelHref = existing ? `#/page/view?slug=${existing.slug}` : '#/pages';
        const cancelBtn = Button({ text: 'Назад', variant: 'secondary', href: cancelHref });
        const msg = StatusMessage({ type: 'ok', text: '', hidden: true });
        actions.appendChild(saveBtn);
        actions.appendChild(cancelBtn);
        form.appendChild(actions);
        form.appendChild(msg);
        container.appendChild(form);

        if (!isNew) {
            container.appendChild(Button({
                text: 'Стереть досье',
                variant: 'danger',
                onClick: async () => {
                    if (!confirm('Досье будет стёрто. Продолжить?')) return;
                    try { await deletePage(existing.id); window.location.hash = '#/pages'; }
                    catch (err) { showMessage(msg, 'Ошибка: ' + translateError(err), 'err'); }
                }
            }));
        }

        form.addEventListener('submit', async () => {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Запись...';
            hideMessage(msg);

            try {
                const title = form.querySelector('#p-title').value.trim();
                if (!title) throw new Error('Кодовое название обязательно');

                let slugVal = form.querySelector('#p-slug').value.trim();
                if (!slugVal) slugVal = slugify(title);
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
                    for (const f of FACTIONS) {
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

                if (type === 'faction' && pageTags.length > 0) {
                    ensureFactionSubTags(pageTags).catch(() => {});
                }

                showMessage(msg, 'Данные записаны!', 'ok');
                setTimeout(() => window.location.hash = `#/page/view?slug=${slugVal}`, 800);
            } catch (err) {
                showMessage(msg, 'Ошибка: ' + translateError(err), 'err');
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = isNew ? 'Создать' : 'Сохранить';
            }
        });

        section.appendChild(container);
    } catch (err) {
        section.appendChild(StatusMessage({ type: 'err', text: 'Ошибка: ' + translateError(err) }));
    }

    return section;
}

function renderGeneralEditor(area, existing) {
    area.appendChild(createElement('label', { className: 'page-edit-page__label', text: 'Содержимое сводки', attributes: { for: 'p-content' } }));
    area.appendChild(createElement('textarea', { className: 'page-edit-page__textarea', text: existing ? existing.content || '' : '', attributes: { id: 'p-content', rows: 10, placeholder: '{{img:https://...}}' } }));

    area.appendChild(createElement('label', { className: 'page-edit-page__label', text: 'Визуальные данные', attributes: { style: 'margin-top:var(--space-md);display:block' } }));
    const imgList = createElement('div', { className: 'page-edit__img-list' });
    const urls = existing && existing.images?.length ? existing.images : [''];
    urls.forEach(url => imgList.appendChild(createElement('input', { className: 'page-edit-page__input page-edit__img-input', attributes: { type: 'url', value: url || '', placeholder: 'https://...' } })));
    const addBtn = createElement('button', { className: 'page-edit-page__add-img', attributes: { type: 'button' } });
    addBtn.appendChild(Icon({ name: 'add', size: 'sm' }));
    addBtn.appendChild(createElement('span', { text: 'Добавить' }));
    addBtn.addEventListener('click', () => {
        imgList.insertBefore(createElement('input', { className: 'page-edit-page__input page-edit__img-input', attributes: { type: 'url', placeholder: 'https://...' } }), addBtn);
    });
    imgList.appendChild(addBtn);
    area.appendChild(imgList);
}

function renderFactionEditor(area, existing) {
    const matrix = existing?.matrix ? existing.matrix : createEmptyMatrix();

    for (const row of ['info', 'propaganda', 'hard-propaganda']) {
        const section = createElement('div', { className: 'page-edit__faction-section' });
        section.appendChild(createElement('h3', { className: 'page-edit__faction-section-title', text: MATRIX_ROW_LABELS[row] }));

        const cols = createElement('div', { className: 'page-edit__faction-cols' });

        for (const f of FACTIONS) {
            const cell = matrix[f]?.[row] || { content: '', images: [] };
            const col = createElement('div', { className: `page-edit__faction-col page-edit__faction-col--${f}` });

            col.appendChild(createElement('div', { className: 'page-edit__faction-col-label', text: FACTION_LABELS[f] }));
            col.appendChild(createElement('textarea', {
                className: 'page-edit-page__textarea',
                text: cell.content || '',
                attributes: { id: `cell-${f}-${row}`, rows: 4, placeholder: '{{img:https://...}}' }
            }));

            const imgs = cell.images?.length ? cell.images : [''];
            imgs.forEach(url => col.appendChild(createElement('input', { className: 'page-edit-page__input page-edit__faction-img', attributes: { type: 'url', id: `cell-img-${f}-${row}`, value: url || '', placeholder: 'URL изображения' } })));

            cols.appendChild(col);
        }

        section.appendChild(cols);
        area.appendChild(section);
    }
}
