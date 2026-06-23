/**
 * TagInput — поле ввода тегов с автокомплитом.
 *
 * Особенности:
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

import { createElement } from '../utils/dom.js';
import { searchTags, addTag } from '../firebase/tagsService.js';

export async function TagInput({ initialTags = [], onChange, placeholder = 'Добавить тег...' }) {
    const container = createElement('div', { className: 'tag-input' });

    // Контейнер для чипсов
    const chipsContainer = createElement('div', { className: 'tag-input__chips' });
    const selectedTags = [...initialTags];

    // Поле ввода
    const input = createElement('input', {
        className: 'tag-input__field',
        attributes: { type: 'text', placeholder, autocomplete: 'off' }
    });

    // Выпадающий список
    const dropdown = createElement('ul', { className: 'tag-input__dropdown' });

    container.appendChild(chipsContainer);
    container.appendChild(input);
    container.appendChild(dropdown);

    let currentSuggestions = [];

    /** Перерисовать чипсы */
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

    /** Показать выпадающий список */
    function showDropdown(suggestions) {
        dropdown.innerHTML = '';
        currentSuggestions = suggestions;

        if (suggestions.length === 0) {
            const value = input.value.trim();
            if (value) {
                const li = createElement('li', {
                    className: 'tag-input__option tag-input__option--new',
                    text: `Добавить «${value}»`,
                    events: {
                        click: async () => {
                            await addTag(value);
                            selectedTags.push(value);
                            renderChips();
                            input.value = '';
                            dropdown.innerHTML = '';
                            if (onChange) onChange([...selectedTags]);
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

    // Обработка ввода
    let debounceTimer = null;
    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            const value = input.value.trim();
            if (!value) {
                const all = await searchTags('');
                showDropdown(all.filter(t => !selectedTags.includes(t.name)));
            } else {
                const results = await searchTags(value);
                showDropdown(results.filter(t => !selectedTags.includes(t.name)));
            }
        }, 150);
    });

    // Enter — если нет совпадений, создаём новый тег
    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const value = input.value.trim();
            if (!value) return;

            // Если есть видимые варианты — берём первый
            const visibleOptions = dropdown.querySelectorAll('.tag-input__option:not(.tag-input__option--new)');
            if (visibleOptions.length > 0) {
                const first = visibleOptions[0];
                selectedTags.push(first.textContent);
            } else {
                // Создаём новый
                await addTag(value);
                selectedTags.push(value);
            }

            renderChips();
            input.value = '';
            dropdown.innerHTML = '';
            if (onChange) onChange([...selectedTags]);
        }

        // Escape — закрыть dropdown
        if (e.key === 'Escape') {
            dropdown.innerHTML = '';
        }
    });

    // Закрыть dropdown при клике вне контейнера
    const closeOnOutsideClick = (e) => {
        if (!container.contains(e.target)) {
            dropdown.innerHTML = '';
        }
    };
    document.addEventListener('click', closeOnOutsideClick);

    renderChips();

    // Загружаем начальные варианты
    const all = await searchTags('');
    showDropdown(all.filter(t => !selectedTags.includes(t.name)));

    return container;
}
