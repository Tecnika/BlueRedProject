import { createElement } from '../utils/dom.js';
import { store } from '../core/Store.js';
import { getPageBySlug, savePage, deletePage, getAllPages, slugify } from '../firebase/pagesService.js';
import { getAllTags } from '../firebase/tagsService.js';

export async function PageEditPage(slug) {
    const section = createElement('section', { className: 'page-edit-page' });
    const user = store.get('user');

    if (!user || user.role !== 'master') {
        section.appendChild(createElement('p', {
            className: 'page-edit-page__error',
            text: 'Доступно только мастеру'
        }));
        return section;
    }

    try {
        const existing = slug ? await getPageBySlug(slug) : null;
        const isNew = !existing;
        const allPages = await getAllPages();
        const allTags = await getAllTags();

        const container = createElement('div', { className: 'page-edit-page__container' });

        container.appendChild(createElement('h1', {
            className: 'page-edit-page__title',
            text: isNew ? 'Создать страницу' : `Редактировать: ${existing.title}`
        }));

        const form = createElement('form', {
            className: 'page-edit-page__form',
            events: { submit: (e) => e.preventDefault() }
        });

        // Заголовок
        form.appendChild(createField('text', 'p-title', 'Заголовок', existing ? existing.title : ''));

        // Slug (только для чтения)
        form.appendChild(createFieldReadonly('p-slug', 'URL (генерируется автоматически)', existing ? existing.slug : ''));

        // Фракция
        form.appendChild(createSelect('p-faction', 'Фракция', existing ? existing.faction || '' : '', [
            { value: '', text: 'Без фракции (доступно всем)' },
            { value: 'red', text: 'Красные' },
            { value: 'blue', text: 'Синие' },
            { value: 'purple', text: 'Фиолетовые' }
        ]));

        // Теги (уровень страницы — для видимости в дереве)
        const tagLabel = createElement('label', { className: 'page-edit-page__label', text: 'Теги видимости (страница показывается тем, у кого есть хотя бы один)' });
        form.appendChild(tagLabel);
        const existingTags = [...(existing ? existing.tags || [] : [])];
        const tagContainer = createElement('div', { className: 'page-edit-page__tags' });
        for (const tag of allTags) {
            const checked = existingTags.includes(tag.name);
            const label = createElement('label', { className: 'page-edit-page__tag-label' });
            const cb = createElement('input', {
                attributes: { type: 'checkbox', value: tag.name, checked }
            });
            label.appendChild(cb);
            label.appendChild(createElement('span', { text: tag.name }));
            tagContainer.appendChild(label);
        }
        form.appendChild(tagContainer);

        // Родительская страница
        const parentOptions = [
            { value: '', text: '— Корневая страница —' },
            ...allPages.filter(p => p.id !== (existing ? existing.id : null)).map(p => ({
                value: p.id,
                text: p.title
            }))
        ];
        form.appendChild(createSelect('p-parent', 'Родительская страница', existing ? existing.parentId || '' : '', parentOptions));

        // Слоты контента
        const slotsBlock = createElement('div', { className: 'page-edit-page__versions' });
        slotsBlock.appendChild(createElement('h3', {
            className: 'page-edit-page__versions-title',
            text: 'Слоты контента'
        }));
        slotsBlock.appendChild(createElement('p', {
            className: 'page-edit-page__versions-desc',
            text: 'Каждый слот — кусок контента. Слот без тегов видят все. С тегами — только те, у кого они есть. Если у пользователя нет доступа ни к одному слоту, он видит пустую страницу.'
        }));

        const existingSlots = existing ? existing.slots || [] : [];
        // По умолчанию — один пустой слот для новой страницы
        if (existingSlots.length === 0 && isNew) existingSlots.push({ content: '', tags: [] });

        const slotsContainer = createElement('div', { id: 'p-slots' });
        existingSlots.forEach((slot, i) => {
            slotsContainer.appendChild(createSlotEditor(slot, i, allTags));
        });
        slotsBlock.appendChild(slotsContainer);

        const addSlotBtn = createElement('button', {
            className: 'page-edit-page__add-slot',
            text: '+ Добавить слот',
            attributes: { type: 'button' }
        });
        addSlotBtn.addEventListener('click', () => {
            const i = slotsContainer.children.length;
            slotsContainer.appendChild(createSlotEditor({ content: '', tags: [] }, i, allTags));
        });
        slotsBlock.appendChild(addSlotBtn);

        form.appendChild(slotsBlock);

        // Кнопки
        const actions = createElement('div', { className: 'page-edit-page__actions' });

        const saveBtn = createElement('button', {
            className: 'page-edit-page__save',
            text: isNew ? 'Создать' : 'Сохранить',
            attributes: { type: 'submit' }
        });

        const cancelBtn = createElement('a', {
            className: 'page-edit-page__cancel',
            text: 'Отмена',
            attributes: { href: existing ? `#/page/view?slug=${existing.slug}` : '#/pages' }
        });

        const msg = createElement('p', { className: 'page-edit-page__msg' });

        actions.appendChild(saveBtn);
        actions.appendChild(cancelBtn);
        form.appendChild(actions);
        form.appendChild(msg);
        container.appendChild(form);

        // Кнопка удаления
        if (!isNew) {
            const deleteBtn = createElement('button', {
                className: 'page-edit-page__delete',
                text: 'Удалить страницу',
                attributes: { type: 'button' }
            });
            deleteBtn.addEventListener('click', async () => {
                if (!confirm('Удалить страницу навсегда?')) return;
                try {
                    await deletePage(existing.id);
                    window.location.hash = '#/pages';
                } catch (err) {
                    msg.textContent = 'Ошибка: ' + err.message;
                    msg.className = 'page-edit-page__msg page-edit-page__msg--err';
                }
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
                if (!title) {
                    throw new Error('Заголовок обязателен');
                }

                // Собираем слоты
                const slots = [];
                const slotEls = form.querySelectorAll('.page-edit-page__slot');
                slotEls.forEach(slotEl => {
                    const content = slotEl.querySelector('.page-edit__slot-content').value;
                    const tagChecks = slotEl.querySelectorAll('.page-edit__slot-tags input[type="checkbox"]:checked');
                    const tags = [];
                    tagChecks.forEach(cb => tags.push(cb.value));
                    if (content.trim()) {
                        slots.push({ content, tags });
                    }
                });

                if (slots.length === 0) {
                    throw new Error('Добавьте хотя бы один слот с содержимым');
                }

                // Собираем теги страницы
                const pageTagEls = tagContainer.querySelectorAll('input[type="checkbox"]:checked');
                const pageTags = [];
                pageTagEls.forEach(cb => pageTags.push(cb.value));

                const slugValue = isNew ? slugify(title) + '-' + Date.now().toString(36) : existing.slug;

                const formData = {
                    slug: slugValue,
                    title,
                    faction: form.querySelector('#p-faction').value,
                    parentId: form.querySelector('#p-parent').value || null,
                    tags: pageTags,
                    slots,
                    createdBy: user.uid
                };

                const pageId = existing ? existing.id : null;
                await savePage(pageId, formData);

                msg.textContent = 'Сохранено!';
                msg.className = 'page-edit-page__msg page-edit-page__msg--ok';
                msg.style.display = 'block';

                setTimeout(() => {
                    window.location.hash = `#/page/view?slug=${formData.slug}`;
                }, 800);
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
        section.appendChild(createElement('p', {
            className: 'page-edit-page__error',
            text: 'Ошибка: ' + err.message
        }));
    }

    return section;
}

/** Создаёт редактор одного слота */
function createSlotEditor(slot, index, allTags) {
    const group = createElement('div', { className: 'page-edit-page__slot' });

    const header = createElement('div', { className: 'page-edit-page__slot-header' });
    header.appendChild(createElement('span', {
        className: 'page-edit-page__slot-number',
        text: `Слот ${index + 1}`
    }));

    if (index > 0) {
        const removeBtn = createElement('button', {
            className: 'page-edit-page__slot-remove',
            text: '✕',
            attributes: { type: 'button', title: 'Удалить слот' }
        });
        removeBtn.addEventListener('click', () => group.remove());
        header.appendChild(removeBtn);
    }

    group.appendChild(header);

    // Текстовое поле контента
    const textarea = createElement('textarea', {
        className: 'page-edit__slot-content page-edit-page__textarea',
        text: slot.content || '',
        attributes: { rows: 4, placeholder: 'Содержимое слота...' }
    });
    group.appendChild(textarea);

    // Теги слота
    const tagLabel = createElement('label', {
        className: 'page-edit-page__slot-tag-label',
        text: 'Теги доступа (пусто — видно всем):'
    });
    group.appendChild(tagLabel);

    const tagContainer = createElement('div', { className: 'page-edit__slot-tags' });
    for (const tag of allTags) {
        const checked = slot.tags && slot.tags.includes(tag.name);
        const label = createElement('label', { className: 'page-edit-page__tag-label' });
        const cb = createElement('input', {
            attributes: { type: 'checkbox', value: tag.name, checked }
        });
        label.appendChild(cb);
        label.appendChild(createElement('span', { text: tag.name }));
        tagContainer.appendChild(label);
    }
    group.appendChild(tagContainer);

    return group;
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
    for (const opt of options) {
        const option = createElement('option', { text: opt.text, attributes: { value: opt.value } });
        if (opt.value === value) option.selected = true;
        select.appendChild(option);
    }
    group.appendChild(select);
    return group;
}
