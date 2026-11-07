import { createElement } from '../utils/dom.js?v=10';
import { store } from '../core/Store.js?v=10';
import { StatusMessage } from './StatusMessage.js?v=10';

export function PageLayout({ className, title, actions, children }) {
    const section = createElement('section', { className });
    const container = createElement('div', { className: `${className}__container` });
    const header = createElement('div', { className: `${className}__header` });

    header.appendChild(createElement('h1', { className: `${className}__title`, text: title }));
    if (actions) {
        const actionsEl = createElement('div', { className: `${className}__actions` });
        for (const action of Array.isArray(actions) ? actions : [actions]) {
            actionsEl.appendChild(action);
        }
        header.appendChild(actionsEl);
    }

    container.appendChild(header);
    if (children) {
        for (const child of Array.isArray(children) ? children : [children]) {
            container.appendChild(child);
        }
    }
    section.appendChild(container);
    return section;
}

export function requireAuth(section, { requiredRole } = {}) {
    const user = store.get('user');
    if (!user) {
        section.appendChild(StatusMessage({ type: 'err', text: 'Требуется идентификация' }));
        return null;
    }
    if (requiredRole && user.role !== requiredRole) {
        section.appendChild(StatusMessage({ type: 'err', text: 'Недостаточно прав' }));
        return null;
    }
    return user;
}
