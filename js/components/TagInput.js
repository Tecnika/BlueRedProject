/**
 * TagInput — поле ввода тегов с автокомплитом.
 *
 * Особенности:
 *   - Список появляется только при фокусе / вводе
 *   - При вводе фильтрует существующие теги из каталога
 *   - Клик по варианту — добавляет тег
 *   - Enter при отсутствии совпадений — создаёт новый тег
 *   - Выбранные теги отображаются как чипсы (можно удалить)
 *
 * @param {Object} options
 * @param {string[]} options.initialTags — начальный список выбранных тегов
 * @param {Function} options.onChange — callback(updatedTags: string[])
 * @param {string} options.placeholder — placeholder поля ввода
 * @returns {HTMLElement}
 */

import { createElement } from '../utils/dom.js?v=2';
import { searchTags, addTag } from '../firebase/tagsService.js?v=2';

export async function TagInput({ initialTags = [], onChange, placeholder = 'Добавить тег...' }) {
    const container = createElement('div', { className: 'tag-input' });

    const chipsContainer = createElement('div', { className: 'tag-input__chips' });
    const selectedTags = [...initialTags];

    const input = createElement('input', {
        className: 'tag-input__field',
        attributes: { type: 'text', placeholder, autocomplete: 'off' }
    });

    const dropdown = createElement('ul', { className: 'tag-input__dropdown' });

    container.appendChild(chipsContainer);
    container.appendChild(input);
    container.appendChild(dropdown);

    let tagsLoaded = false;

    function renderChips() {
        chipsContainer.innerHTML = '';
        for (const tag of selectedTags) {
            const chip = createElement('span', { className: 'tag-input__chip', text: tag });
            const removeBtn = createElement('button', {
                className: 'tag-input__chip-remove',
                text: '✕',
                attributes: { type: 'button' },
                events: {
                    click: () => {
                        const idx = selectedTags.indexOf(tag);
                        if (idx >= 0) selectedTags.splice(idx, 1);
                        renderChips();
                        if (onChange) onChange([...selectedTags]);
                    }
                }
            });
            chip.appendChild(removeBtn);
            chipsContainer.appendChild(chip);
        }
    }

    function showDropdown(suggestions) {
        dropdown.innerHTML = '';

        if (suggestions.length === 0) {
            const value = input.value.trim();
            if (value) {
                const li = createElement('li', {
                    className: 'tag-input__option tag-input__option--new',
                    text: `Добавить «${value}»`,
                    events: {
                        click: async () => {
                            try {
                                await addTag(value);
                                selectedTags.push(value);
                                renderChips();
                                input.value = '';
                                dropdown.innerHTML = '';
                                if (onChange) onChange([...selectedTags]);
                            } catch (e) {
                                // Тег мог уже существовать — добавляем как есть
                                selectedTags.push(value);
                                renderChips();
                                input.value = '';
                                dropdown.innerHTML = '';
                                if (onChange) onChange([...selectedTags]);
                            }
                        }
                    }
                });
                dropdown.appendChild(li);
            }
            return;
        }

        for (const tag of suggestions) {
            if (selectedTags.includes(tag.name)) continue;
            const li = createElement('li', {
                className: 'tag-input__option',
                text: tag.name,
                events: {
                    click: () => {
                        selectedTags.push(tag.name);
                        renderChips();
                        input.value = '';
                        dropdown.innerHTML = '';
                        if (onChange) onChange([...selectedTags]);
                    }
                }
            });
            dropdown.appendChild(li);
        }
    }

    /** Загрузить теги и показать dropdown */
    async function openDropdown(query) {
        try {
            const results = await searchTags(query || input.value.trim());
            showDropdown(results.filter(t => !selectedTags.includes(t.name)));
        } catch (e) {
            // Если Firestore недоступен — ничего не показываем
            dropdown.innerHTML = '';
        }
    }

    // Показывать dropdown при фокусе
    input.addEventListener('focus', () => {
        openDropdown('');
    });

    // Фильтрация при вводе
    let debounceTimer = null;
    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            openDropdown(input.value.trim());
        }, 150);
    });

    // Enter — добавить первый вариант или создать новый
    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const value = input.value.trim();
            if (!value) return;

            const visibleOptions = dropdown.querySelectorAll('.tag-input__option:not(.tag-input__option--new)');
            if (visibleOptions.length > 0) {
                selectedTags.push(visibleOptions[0].textContent);
            } else {
                try {
                    await addTag(value);
                } catch (e) { /* игнорируем дубликаты */ }
                selectedTags.push(value);
            }

            renderChips();
            input.value = '';
            dropdown.innerHTML = '';
            if (onChange) onChange([...selectedTags]);
        }

        if (e.key === 'Escape') {
            dropdown.innerHTML = '';
        }
    });

    // Закрыть при клике вне
    const closeOnOutsideClick = (e) => {
        if (!container.contains(e.target)) {
            dropdown.innerHTML = '';
        }
    };
    document.addEventListener('click', closeOnOutsideClick);

    renderChips();
    return container;
}
