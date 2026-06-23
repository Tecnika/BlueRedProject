/**
 * PageEditPage — создание / редактирование страницы (только мастер).
 *
 * Поля: заголовок, slug, контент, фракция, теги, родительская страница.
 * Версии: red, blue, pro-red-for-blue, pro-blue-for-red.
 */

import { createElement } from '../utils/dom.js';
import { store } from '../core/Store.js';
import { getPageBySlug, savePage, deletePage, getAllPages } from '../firebase/pagesService.js';
import { getAllTags } from '../firebase/tagsService.js';

const VERSION_KEYS = ['red', 'blue', 'pro-red-for-blue', 'pro-blue-for-red'];
const VERSION_LABELS = {
    'red': 'Для красных',
    'blue': 'Для синих',
    'pro-red-for-blue': 'ПРО красных для синих',
    'pro-blue-for-red': 'ПРО синих для красных'
};

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

        const title = createElement('h1', {
            className: 'page-edit-page__title',
            text: isNew ? 'Создать страницу' : `Редактировать: ${existing.title}`
        });
        container.appendChild(title);

        const form = createElement('form', {
            className: 'page-edit-page__form',
            events: { submit: (e) => e.preventDefault() }
        });

        // Заголовок
        form.appendChild(createField('text', 'p-title', 'Заголовок', existing ? existing.title : ''));

        // Slug
        form.appendChild(createField('text', 'p-slug', 'URL (slug)', existing ? existing.slug : ''));

        // Фракция
        const factionGroup = createSelect('p-faction', 'Фракция', existing ? existing.faction || '' : '', [
            { value: '', text: 'Без фракции (доступно всем)' },
            { value: 'red', text: 'Красные' },
            { value: 'blue', text: 'Синие' },
            { value: 'purple', text: 'Фиолетовые' }
        ]);
        form.appendChild(factionGroup);

        // Теги
        const tagLabel = createElement('label', { className: 'page-edit-page__label', text: 'Теги (выберите нужные)' });
        form.appendChild(tagLabel);
        const selectedTags = [...(existing ? existing.tags || [] : [])];
        const tagContainer = createElement('div', { className: 'page-edit-page__tags' });
        for (const tag of allTags) {
            const checked = selectedTags.includes(tag.name);
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

        // Контент
        form.appendChild(createTextarea('p-content', 'Содержимое (основная версия)', existing ? existing.content || '' : ''));

        // Версии
        const versionsBlock = createElement('div', { className: 'page-edit-page__versions' });
        versionsBlock.appendChild(createElement('h3', {
            className: 'page-edit-page__versions-title',
            text: 'Версии (заполнять по необходимости)'
        }));

        const existingVersions = existing ? existing.versions || {} : {};
        for (const key of VERSION_KEYS) {
            const v = existingVersions[key];
            const vContent = typeof v === 'string' ? v : (v ? v.content : '');
            const vTitle = typeof v === 'object' && v ? v.title : '';
            const group = createElement('div', { className: 'page-edit-page__version-group' });
            group.appendChild(createElement('label', {
                className: 'page-edit-page__version-label',
                text: VERSION_LABELS[key]
            }));
            if (['pro-red-for-blue', 'pro-blue-for-red'].includes(key)) {
                group.appendChild(createField('text', `p-ver-title-${key}`, 'Заголовок версии', vTitle));
            }
            group.appendChild(createTextarea(`p-ver-${key}`, 'Содержимое версии', vContent));
            versionsBlock.appendChild(group);
        }
        form.appendChild(versionsBlock);

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

        // Кнопка удаления для существующей страницы
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
                const formData = {
                    title: form.querySelector('#p-title').value.trim(),
                    slug: form.querySelector('#p-slug').value.trim(),
                    faction: form.querySelector('#p-faction').value,
                    parentId: form.querySelector('#p-parent').value || null,
                    content: form.querySelector('#p-content').value,
                    tags: [],
                    createdBy: user.uid
                };

                // Собираем выбранные теги
                const checkboxes = tagContainer.querySelectorAll('input[type="checkbox"]:checked');
                checkboxes.forEach(cb => formData.tags.push(cb.value));

                // Версии
                const versions = {};
                for (const key of VERSION_KEYS) {
                    const verContent = form.querySelector(`#p-ver-${key}`)?.value;
                    if (verContent && verContent.trim()) {
                        if (['pro-red-for-blue', 'pro-blue-for-red'].includes(key)) {
                            const verTitle = form.querySelector(`#p-ver-title-${key}`)?.value?.trim();
                            versions[key] = { content: verContent, title: verTitle || formData.title };
                        } else {
                            versions[key] = verContent;
                        }
                    }
                }
                if (Object.keys(versions).length > 0) {
                    formData.versions = versions;
                }

                const pageId = existing ? existing.id : null;
                await savePage(pageId, formData);

                msg.textContent = 'Сохранено!';
                msg.className = 'page-edit-page__msg page-edit-page__msg--ok';

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

function createField(type, id, label, value) {
    const group = createElement('div', { className: 'page-edit-page__field' });
    const labelEl = createElement('label', {
        className: 'page-edit-page__label',
        text: label,
        attributes: { for: id }
    });
    const input = createElement('input', {
        className: 'page-edit-page__input',
        attributes: { type, id, value }
    });
    group.appendChild(labelEl);
    group.appendChild(input);
    return group;
}

function createTextarea(id, label, value) {
    const group = createElement('div', { className: 'page-edit-page__field' });
    const labelEl = createElement('label', {
        className: 'page-edit-page__label',
        text: label,
        attributes: { for: id }
    });
    const input = createElement('textarea', {
        className: 'page-edit-page__textarea',
        text: value || '',
        attributes: { id, rows: 6 }
    });
    group.appendChild(labelEl);
    group.appendChild(input);
    return group;
}

function createSelect(id, label, value, options) {
    const group = createElement('div', { className: 'page-edit-page__field' });
    const labelEl = createElement('label', {
        className: 'page-edit-page__label',
        text: label,
        attributes: { for: id }
    });
    const select = createElement('select', { className: 'page-edit-page__input', attributes: { id } });
    for (const opt of options) {
        const option = createElement('option', {
            text: opt.text,
            attributes: { value: opt.value }
        });
        if (opt.value === value) option.selected = true;
        select.appendChild(option);
    }
    group.appendChild(labelEl);
    group.appendChild(select);
    return group;
}
