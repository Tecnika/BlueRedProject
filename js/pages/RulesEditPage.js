import { createElement } from '../utils/dom.js?v=3';
import { store } from '../core/Store.js?v=3';
import { translateError } from '../utils/translateError.js?v=3';
import { getRule, createRule, updateRule } from '../firebase/rulesService.js?v=3';

const TYPE_OPTIONS = [
    { value: 'general', label: 'Основные' },
    { value: 'site', label: 'Правила сайта' },
    { value: 'hidden', label: 'Скрытые механики' }
];

export async function RulesEditPage() {
    const section = createElement('section', { className: 'rules-edit-page' });
    const user = store.get('user');

    if (!user || (user.role !== 'master' && user.role !== 'igrotech')) {
        section.appendChild(createElement('p', { className: 'rules-edit-page__error', text: 'Только для мастера и игротехников' }));
        return section;
    }

    const TYPE_OPTIONS = [
        { value: 'general', label: 'Основные' },
        { value: 'site', label: 'Правила сайта' }
    ];
    if (user.role === 'master') {
        TYPE_OPTIONS.push({ value: 'hidden', label: 'Скрытые механики' });
    }

    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const editId = params.get('id');
    let ruleData = { type: 'general', title: '', content: '', order: 0 };

    if (editId) {
        try {
            const existing = await getRule(editId);
            if (!existing) {
                section.appendChild(createElement('p', { className: 'rules-edit-page__error', text: 'Правило не найдено' }));
                return section;
            }
            if (user.role === 'igrotech' && existing.type === 'hidden') {
                section.appendChild(createElement('p', { className: 'rules-edit-page__error', text: 'Игротехники не могут редактировать скрытые механики' }));
                return section;
            }
            ruleData = existing;
        } catch (err) {
            section.appendChild(createElement('p', { className: 'rules-edit-page__error', text: 'Ошибка: ' + translateError(err) }));
            return section;
        }
    }

    const container = createElement('div', { className: 'rules-edit-page__container' });

    const title = editId ? 'Редактировать правило' : 'Создать правило';
    container.appendChild(createElement('h1', { className: 'rules-edit-page__title', text: title }));

    const form = createElement('div', { className: 'rules-edit-page__form' });

    // Type selector
    const typeGroup = createElement('div', { className: 'rules-edit-page__field' });
    typeGroup.appendChild(createElement('label', { className: 'rules-edit-page__label', text: 'Тип' }));
    const typeSelect = createElement('select', { className: 'rules-edit-page__input rules-edit-page__select' });
    for (const opt of TYPE_OPTIONS) {
        const option = createElement('option', { text: opt.label, attributes: { value: opt.value } });
        if (opt.value === ruleData.type) option.selected = true;
        typeSelect.appendChild(option);
    }
    typeGroup.appendChild(typeSelect);
    form.appendChild(typeGroup);

    // Title
    const titleGroup = createElement('div', { className: 'rules-edit-page__field' });
    titleGroup.appendChild(createElement('label', { className: 'rules-edit-page__label', text: 'Заголовок' }));
    const titleInput = createElement('input', {
        className: 'rules-edit-page__input',
        attributes: { type: 'text', value: ruleData.title || '', placeholder: 'Название правила' }
    });
    titleGroup.appendChild(titleInput);
    form.appendChild(titleGroup);

    // Order
    const orderGroup = createElement('div', { className: 'rules-edit-page__field' });
    orderGroup.appendChild(createElement('label', { className: 'rules-edit-page__label', text: 'Порядок' }));
    const orderInput = createElement('input', {
        className: 'rules-edit-page__input rules-edit-page__input--short',
        attributes: { type: 'number', value: ruleData.order ?? 0, min: '0' }
    });
    orderGroup.appendChild(orderInput);
    form.appendChild(orderGroup);

    // Content
    const contentGroup = createElement('div', { className: 'rules-edit-page__field' });
    contentGroup.appendChild(createElement('label', { className: 'rules-edit-page__label', text: 'Содержание' }));
    const contentArea = createElement('textarea', {
        className: 'rules-edit-page__textarea',
        text: ruleData.content || '',
        attributes: { rows: '15', placeholder: 'Текст правила...' }
    });
    contentGroup.appendChild(contentArea);
    form.appendChild(contentGroup);

    // Buttons
    const btnGroup = createElement('div', { className: 'rules-edit-page__actions' });

    const saveBtn = createElement('button', {
        className: 'rules-edit-page__save-btn',
        text: 'Сохранить',
        attributes: { type: 'button' }
    });
    saveBtn.addEventListener('click', async () => {
        const payload = {
            type: typeSelect.value,
            title: titleInput.value,
            content: contentArea.value,
            order: parseInt(orderInput.value, 10) || 0
        };
        if (!payload.title.trim()) { alert('Заголовок не может быть пустым'); return; }
        if (!payload.content.trim()) { alert('Содержание не может быть пустым'); return; }
        if (user.role === 'igrotech' && payload.type === 'hidden') {
            alert('Игротехники не могут создавать скрытые механики');
            return;
        }

        try {
            if (editId) {
                await updateRule(editId, payload);
            } else {
                await createRule(payload);
            }
            window.location.hash = '#/rules';
        } catch (err) {
            alert('Ошибка: ' + translateError(err));
        }
    });
    btnGroup.appendChild(saveBtn);

    const cancelBtn = createElement('button', {
        className: 'rules-edit-page__cancel-btn',
        text: 'Отмена',
        attributes: { type: 'button' }
    });
    cancelBtn.addEventListener('click', () => {
        window.location.hash = '#/rules';
    });
    btnGroup.appendChild(cancelBtn);

    form.appendChild(btnGroup);

    container.appendChild(form);

    // Add quick-create buttons for master in sidebar of edit page
    if (!editId) {
        const shortcuts = createElement('div', { className: 'rules-edit-page__shortcuts' });
        shortcuts.appendChild(createElement('p', { className: 'rules-edit-page__shortcuts-label', text: 'Быстрая вставка контента:' }));
        const addBtnsContainer = createElement('div', { className: 'rules-edit-page__shortcuts-actions' });

        const openGeneralBtn = createElement('a', {
            className: 'rules-edit-page__shortcut-btn',
            text: '+ Основные',
            attributes: { href: '#/rules/create?type=general' }
        });
        addBtnsContainer.appendChild(openGeneralBtn);

        const openSiteBtn = createElement('a', {
            className: 'rules-edit-page__shortcut-btn',
            text: '+ Правила сайта',
            attributes: { href: '#/rules/create?type=site' }
        });
        addBtnsContainer.appendChild(openSiteBtn);

        if (user.role === 'master') {
            const openHiddenBtn = createElement('a', {
                className: 'rules-edit-page__shortcut-btn',
                text: '+ Скрытые механики',
                attributes: { href: '#/rules/create?type=hidden' }
            });
            addBtnsContainer.appendChild(openHiddenBtn);
        }

        shortcuts.appendChild(addBtnsContainer);
        container.appendChild(shortcuts);
    }

    section.appendChild(container);
    return section;
}
