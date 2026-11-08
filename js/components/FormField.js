import { createElement } from '../utils/dom.js?v=27';

export function FormField({ type = 'input', id, label, value = '', placeholder = '', options = [], rows = 4, required = false }) {
    const group = createElement('div', { className: 'field' });

    if (label) {
        group.appendChild(createElement('label', { className: 'field__label', text: label, attributes: { for: id } }));
    }

    if (type === 'textarea') {
        group.appendChild(createElement('textarea', {
            className: 'field__input field__textarea',
            text: value,
            attributes: { id, rows, placeholder, ...(required ? { required: '' } : {}) }
        }));
    } else if (type === 'select') {
        const select = createElement('select', {
            className: 'field__input field__select',
            attributes: { id, ...(required ? { required: '' } : {}) }
        });
        for (const opt of options) {
            const option = createElement('option', { text: opt.text, attributes: { value: opt.value } });
            if (opt.value === value) option.selected = true;
            select.appendChild(option);
        }
        group.appendChild(select);
    } else {
        group.appendChild(createElement('input', {
            className: 'field__input',
            attributes: { type, id, value, placeholder, ...(required ? { required: '' } : {}) }
        }));
    }

    return group;
}
