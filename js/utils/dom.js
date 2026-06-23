export function createElement(tag, options = {}) {
    const element = document.createElement(tag);

    if (options.className) {
        element.className = options.className;
    }

    if (options.id) {
        element.id = options.id;
    }

    if (options.text) {
        element.textContent = options.text;
    }

    if (options.html) {
        element.innerHTML = options.html;
    }

    if (options.attributes) {
        for (const [key, value] of Object.entries(options.attributes)) {
            element.setAttribute(key, value);
        }
    }

    if (options.children) {
        for (const child of options.children) {
            if (child instanceof Node) {
                element.appendChild(child);
            }
        }
    }

    if (options.events) {
        for (const [event, handler] of Object.entries(options.events)) {
            element.addEventListener(event, handler);
        }
    }

    if (options.dataset) {
        for (const [key, value] of Object.entries(options.dataset)) {
            element.dataset[key] = value;
        }
    }

    return element;
}

export function render(container, content) {
    container.innerHTML = '';

    if (content instanceof Node) {
        container.appendChild(content);
        return;
    }

    if (Array.isArray(content)) {
        for (const node of content) {
            if (node instanceof Node) {
                container.appendChild(node);
            }
        }
        return;
    }
}

export function clearContainer(container) {
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
}
