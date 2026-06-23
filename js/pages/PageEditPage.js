import { createElement } from '../utils/dom.js';
import { store } from '../core/Store.js';
import { getPageBySlug, savePage, deletePage, getAllPages, slugify } from '../firebase/pagesService.js';
import { getAllTags } from '../firebase/tagsService.js';

const FACTION_OPTIONS = [
    { value: '', text: 'Общее (без фракции)' },
    { value: 'red', text: 'О красных' },
    { value: 'blue', text: 'О синих' },
    { value: 'purple', text: 'О фиолетовых' }
];

const TYPE_OPTIONS = [
    { value: 'info', text: 'Информация' },
    { value: 'propaganda', text: 'Пропаганда' },
    { value: 'hard-propaganda', text: 'Жёсткая пропаганда' }
];

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

        form.appendChild(createField('text', 'p-title', 'Заголовок', existing ? existing.title : ''));
        form.appendChild(createFieldReadonly('p-slug', 'URL (генерируется)', existing ? existing.slug : ''));

        // Теги видимости страницы (для дерева)
        const pageTagLabel = createElement('label', { className: 'page-edit-page__label', text: 'Теги видимости страницы' });
        form.appendChild(pageTagLabel);
        const existingTags = [...(existing ? existing.tags || [] : [])];
        const pageTagContainer = createElement('div', { className: 'page-edit-page__tags' });
        allTags.forEach(tag => {
            const checked = existingTags.includes(tag.name);
            const label = createElement('label', { className: 'page-edit-page__tag-label' });
            const cb = createElement('input', { attributes: { type: 'checkbox', value: tag.name, checked } });
            label.appendChild(cb);
            label.appendChild(createElement('span', { text: tag.name }));
            pageTagContainer.appendChild(label);
        });
        form.appendChild(pageTagContainer);

        // Родительская страница
        form.appendChild(createSelect('p-parent', 'Родительская страница', existing ? existing.parentId || '' : '', [
            { value: '', text: '— Корневая страница —' },
            ...allPages.filter(p => p.id !== (existing ? existing.id : null)).map(p => ({ value: p.id, text: p.title }))
        ]));

        // Блоки контента
        const blocksBlock = createElement('div', { className: 'page-edit-page__versions' });
        blocksBlock.appendChild(createElement('h3', {
            className: 'page-edit-page__versions-title',
            text: 'Блоки контента'
        }));
        blocksBlock.appendChild(createElement('p', {
            className: 'page-edit-page__versions-desc',
            text: 'Каждый блок — информация о фракции, пропаганда или жёсткая пропаганда. Без тегов — видят все. С тегами — только те, у кого они есть. Для вставки картинки используйте {{img:URL}} в тексте.'
        }));

        const existingBlocks = existing ? existing.blocks || [] : [];
        if (existingBlocks.length === 0 && isNew) existingBlocks.push({ content: '', tags: [], faction: '', type: 'info', images: [] });

        const blocksContainer = createElement('div', { id: 'p-blocks' });
        existingBlocks.forEach((block, i) => blocksContainer.appendChild(createBlockEditor(block, i, allTags)));
        blocksBlock.appendChild(blocksContainer);

        const addBlockBtn = createElement('button', {
            className: 'page-edit-page__add-slot',
            text: '+ Добавить блок',
            attributes: { type: 'button' }
        });
        addBlockBtn.addEventListener('click', () => {
            const i = blocksContainer.children.length;
            blocksContainer.appendChild(createBlockEditor({ content: '', tags: [], faction: '', type: 'info', images: [] }, i, allTags));
        });
        blocksBlock.appendChild(addBlockBtn);
        form.appendChild(blocksBlock);

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

        // Удаление
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
                if (!title) throw new Error('Заголовок обязателен');

                const blocks = [];
                const blockEls = form.querySelectorAll('.page-edit-page__block');
                blockEls.forEach(blockEl => {
                    const content = blockEl.querySelector('.page-edit__block-content').value;
                    if (!content.trim()) return;

                    const faction = blockEl.querySelector('.page-edit__block-faction').value;
                    const type = blockEl.querySelector('.page-edit__block-type').value;
                    const tagChecks = blockEl.querySelectorAll('.page-edit__block-tags input[type="checkbox"]:checked');
                    const tags = [];
                    tagChecks.forEach(cb => tags.push(cb.value));

                    const imageInputs = blockEl.querySelectorAll('.page-edit__block-image');
                    const images = [];
                    imageInputs.forEach(inp => { if (inp.value.trim()) images.push(inp.value.trim()); });

                    blocks.push({ content, faction, type, tags, images });
                });

                if (blocks.length === 0) throw new Error('Добавьте хотя бы один блок с содержимым');

                const pageTagEls = pageTagContainer.querySelectorAll('input[type="checkbox"]:checked');
                const pageTags = [];
                pageTagEls.forEach(cb => pageTags.push(cb.value));

                const slugValue = isNew ? slugify(title) + '-' + Date.now().toString(36) : existing.slug;

                await savePage(existing ? existing.id : null, {
                    slug: slugValue,
                    title,
                    faction: '',
                    parentId: form.querySelector('#p-parent').value || null,
                    tags: pageTags,
                    blocks,
                    createdBy: user.uid
                });

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
        section.appendChild(createElement('p', {
            className: 'page-edit-page__error',
            text: 'Ошибка: ' + err.message
        }));
    }

    return section;
}

function createBlockEditor(block, index, allTags) {
    const group = createElement('div', { className: 'page-edit-page__block' });

    const header = createElement('div', { className: 'page-edit-page__slot-header' });
    header.appendChild(createElement('span', {
        className: 'page-edit-page__slot-number',
        text: `Блок ${index + 1}`
    }));
    if (index > 0) {
        const removeBtn = createElement('button', {
            className: 'page-edit-page__slot-remove',
            text: '✕',
            attributes: { type: 'button', title: 'Удалить блок' }
        });
        removeBtn.addEventListener('click', () => group.remove());
        header.appendChild(removeBtn);
    }
    group.appendChild(header);

    // Фракция
    const factionSelect = createElement('select', {
        className: 'page-edit__block-faction page-edit-page__input',
        attributes: { style: 'margin-bottom:var(--space-sm)' }
    });
    FACTION_OPTIONS.forEach(opt => {
        const option = createElement('option', { text: opt.text, attributes: { value: opt.value } });
        if (opt.value === block.faction) option.selected = true;
        factionSelect.appendChild(option);
    });
    group.appendChild(factionSelect);

    // Тип
    const typeSelect = createElement('select', {
        className: 'page-edit__block-type page-edit-page__input',
        attributes: { style: 'margin-bottom:var(--space-sm)' }
    });
    TYPE_OPTIONS.forEach(opt => {
        const option = createElement('option', { text: opt.text, attributes: { value: opt.value } });
        if (opt.value === block.type) option.selected = true;
        typeSelect.appendChild(option);
    });
    group.appendChild(typeSelect);

    // Контент
    const textarea = createElement('textarea', {
        className: 'page-edit__block-content page-edit-page__textarea',
        text: block.content || '',
        attributes: { rows: 5, placeholder: 'Содержимое блока... Для картинки: {{img:https://example.com/image.jpg}}' }
    });
    group.appendChild(textarea);

    // Картинки
    const imgLabel = createElement('label', {
        className: 'page-edit-page__slot-tag-label',
        text: 'Ссылки на изображения (по одной на строку):'
    });
    group.appendChild(imgLabel);
    const imgContainer = createElement('div', { className: 'page-edit__block-images' });
    const imgUrls = (block.images && block.images.length) ? block.images : [''];
    imgUrls.forEach(url => {
        const inp = createElement('input', {
            className: 'page-edit__block-image page-edit-page__input',
            attributes: { type: 'url', value: url || '', placeholder: 'https://...' }
        });
        imgContainer.appendChild(inp);
    });
    const addImgBtn = createElement('button', {
        className: 'page-edit-page__add-img',
        text: '+ Ещё изображение',
        attributes: { type: 'button' }
    });
    addImgBtn.addEventListener('click', () => {
        imgContainer.insertBefore(
            createElement('input', { className: 'page-edit__block-image page-edit-page__input', attributes: { type: 'url', placeholder: 'https://...' } }),
            addImgBtn
        );
    });
    imgContainer.appendChild(addImgBtn);
    group.appendChild(imgContainer);

    // Теги доступа
    const tagLabel = createElement('label', {
        className: 'page-edit-page__slot-tag-label',
        text: 'Теги доступа (пусто — видно всем)'
    });
    group.appendChild(tagLabel);
    const tagContainer = createElement('div', { className: 'page-edit__block-tags' });
    allTags.forEach(tag => {
        const checked = block.tags && block.tags.includes(tag.name);
        const label = createElement('label', { className: 'page-edit-page__tag-label' });
        const cb = createElement('input', { attributes: { type: 'checkbox', value: tag.name, checked } });
        label.appendChild(cb);
        label.appendChild(createElement('span', { text: tag.name }));
        tagContainer.appendChild(label);
    });
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
    options.forEach(opt => {
        const option = createElement('option', { text: opt.text, attributes: { value: opt.value } });
        if (opt.value === value) option.selected = true;
        select.appendChild(option);
    });
    group.appendChild(select);
    return group;
}
