import { createElement } from '../utils/dom.js?v=9';
import { store } from '../core/Store.js?v=9';
import { translateError } from '../utils/translateError.js?v=9';
import { getRule, createRule, updateRule } from '../firebase/rulesService.js?v=9';
import { Button } from '../components/Button.js?v=9';
import { FormField } from '../components/FormField.js?v=9';
import { StatusMessage } from '../components/StatusMessage.js?v=9';

export async function RulesEditPage() {
    const section = createElement('section', { className: 'rules-edit-page' });
    const user = store.get('user');

    if (!user || (user.role !== 'master' && user.role !== 'igrotech')) {
        section.appendChild(StatusMessage({ type: 'err', text: 'Только для мастера и игротехников' }));
        return section;
    }

    const TYPE_OPTIONS = [
        { value: 'general', text: 'Основные' },
        { value: 'site', text: 'Правила сайта' }
    ];
    if (user.role === 'master') {
        TYPE_OPTIONS.push({ value: 'hidden', text: 'Скрытые механики' });
    }

    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const editId = params.get('id');
    let ruleData = { type: 'general', title: '', content: '', order: 0 };

    if (editId) {
        try {
            const existing = await getRule(editId);
            if (!existing) {
                section.appendChild(StatusMessage({ type: 'err', text: 'Правило не найдено' }));
                return section;
            }
            if (user.role === 'igrotech' && existing.type === 'hidden') {
                section.appendChild(StatusMessage({ type: 'err', text: 'Игротехники не могут редактировать скрытые механики' }));
                return section;
            }
            ruleData = existing;
        } catch (err) {
            section.appendChild(StatusMessage({ type: 'err', text: 'Ошибка: ' + translateError(err) }));
            return section;
        }
    }

    const container = createElement('div', { className: 'rules-edit-page__container' });

    const titleEl = editId ? 'Редактировать правило' : 'Создать правило';
    container.appendChild(createElement('h1', { className: 'rules-edit-page__title', text: titleEl }));

    const form = createElement('div', { className: 'rules-edit-page__form' });

    form.appendChild(FormField({ type: 'select', id: 'rule-type', label: 'Тип', value: ruleData.type, options: TYPE_OPTIONS }));
    form.appendChild(FormField({ type: 'input', id: 'rule-title', label: 'Заголовок', value: ruleData.title || '', placeholder: 'Название правила' }));
    form.appendChild(FormField({ type: 'input', id: 'rule-order', label: 'Порядок', value: ruleData.order ?? 0, placeholder: '0' }));
    form.appendChild(FormField({ type: 'textarea', id: 'rule-content', label: 'Содержание', value: ruleData.content || '', rows: 15, placeholder: 'Текст правила...' }));

    const btnGroup = createElement('div', { className: 'rules-edit-page__actions' });

    const saveBtn = Button({ text: 'Сохранить', onClick: async () => {
        const typeSelect = form.querySelector('#rule-type');
        const titleInput = form.querySelector('#rule-title');
        const orderInput = form.querySelector('#rule-order');
        const contentArea = form.querySelector('#rule-content');

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
    }});
    btnGroup.appendChild(saveBtn);

    const cancelBtn = Button({ text: 'Отмена', variant: 'secondary', onClick: () => { window.location.hash = '#/rules'; } });
    btnGroup.appendChild(cancelBtn);

    form.appendChild(btnGroup);
    container.appendChild(form);

    if (!editId) {
        const shortcuts = createElement('div', { className: 'rules-edit-page__shortcuts' });
        shortcuts.appendChild(createElement('p', { className: 'rules-edit-page__shortcuts-label', text: 'Быстрая вставка контента:' }));
        const addBtnsContainer = createElement('div', { className: 'rules-edit-page__shortcuts-actions' });

        addBtnsContainer.appendChild(Button({ text: 'Основные', icon: 'add', variant: 'secondary', size: 'sm', href: '#/rules/create?type=general' }));
        addBtnsContainer.appendChild(Button({ text: 'Правила сайта', icon: 'add', variant: 'secondary', size: 'sm', href: '#/rules/create?type=site' }));

        if (user.role === 'master') {
            addBtnsContainer.appendChild(Button({ text: 'Скрытые механики', icon: 'add', variant: 'secondary', size: 'sm', href: '#/rules/create?type=hidden' }));
        }

        shortcuts.appendChild(addBtnsContainer);
        container.appendChild(shortcuts);
    }

    section.appendChild(container);
    return section;
}
