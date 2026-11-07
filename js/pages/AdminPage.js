import { store } from '../core/Store.js?v=8';
import { getAllTags, addTag, removeTag } from '../firebase/tagsService.js?v=8';
import { getAllSubTags, addSubTag, removeSubTag } from '../firebase/subtagsService.js?v=8';
import { getAllProfessions, addProfession, removeProfession } from '../firebase/professionsService.js?v=8';
import { setDesign } from '../firebase/settingsService.js?v=8';
import { createElement } from '../utils/dom.js?v=8';
import { translateError } from '../utils/translateError.js?v=8';
import { Button } from '../components/Button.js?v=8';
import { StatusMessage, showMessage } from '../components/StatusMessage.js?v=8';
import { Icon } from '../components/Icon.js?v=8';
import { encryptToFaction, decryptFromFaction, getAlphabetPairs, LANGUAGE_LABELS } from '../utils/cipher.js?v=8';
import { FACTION_LABELS } from '../utils/profile.js?v=8';

export function AdminPage() {
    const section = createElement('section', { className: 'admin-page' });
    const user = store.get('user');

    if (!user || user.role !== 'master') {
        section.appendChild(StatusMessage({ type: 'err', text: 'Доступ запрещён' }));
        return section;
    }

    const container = createElement('div', { className: 'admin-page__container' });
    container.appendChild(createElement('h1', { className: 'admin-page__title', text: 'Мастерская' }));

    container.appendChild(renderGameSection());
    container.appendChild(renderTestsSection());
    container.appendChild(renderCatalogsSection());
    container.appendChild(renderDesignSection());

    section.appendChild(container);
    return section;
}

/* ============================================================
   Игра и персонажи
   ============================================================ */

function renderGameSection() {
    const section = adminSection('Игра', 'Создание и активация игры, персонажи игроков.');

    const actions = createElement('div', { className: 'admin-section__actions' });
    actions.appendChild(Button({
        text: 'Создать / активировать игру',
        icon: 'sports_esports',
        href: '#/admin/games'
    }));
    actions.appendChild(Button({
        text: 'Управление персонажами',
        icon: 'groups',
        variant: 'secondary',
        href: '#/admin/games'
    }));
    actions.appendChild(Button({
        text: 'Игроки (реальные данные)',
        icon: 'badge',
        variant: 'secondary',
        href: '#/admin/users'
    }));
    section.appendChild(actions);

    return section;
}

/* ============================================================
   Тесты: расшифратор и таблицы ключей
   ============================================================ */

function renderTestsSection() {
    const section = adminSection('Тесты', 'Инструменты для работы с шифрами фракций.');

    const decrypt = collapse('Расшифровка текстов', buildDecryptor(), false);
    section.appendChild(decrypt);

    const keys = collapse('Таблицы ключей', buildKeyTables(), false);
    section.appendChild(keys);

    return section;
}

function buildDecryptor() {
    const box = createElement('div', { className: 'admin-cipher' });

    const controls = createElement('div', { className: 'admin-cipher__controls' });

    const langSelect = createElement('select', {
        className: 'admin-cipher__select',
        attributes: { 'aria-label': 'Язык шифра' }
    });
    for (const faction of ['red', 'blue', 'purple']) {
        langSelect.appendChild(createElement('option', {
            text: `${FACTION_LABELS[faction]} — ${LANGUAGE_LABELS[faction]}`,
            attributes: { value: faction }
        }));
    }

    const directionSelect = createElement('select', {
        className: 'admin-cipher__select',
        attributes: { 'aria-label': 'Направление' }
    });
    directionSelect.appendChild(createElement('option', { text: 'Расшифровать (из шифра в кириллицу)', attributes: { value: 'decode' } }));
    directionSelect.appendChild(createElement('option', { text: 'Зашифровать (из кириллицы в шифр)', attributes: { value: 'encode' } }));

    controls.appendChild(langSelect);
    controls.appendChild(directionSelect);
    box.appendChild(controls);

    const inputLabel = createElement('label', { className: 'admin-cipher__label', text: 'Исходный текст' });
    const input = createElement('textarea', {
        className: 'admin-cipher__textarea',
        attributes: { rows: 3, placeholder: 'Вставьте текст...', 'aria-label': 'Исходный текст' }
    });
    const outputLabel = createElement('label', { className: 'admin-cipher__label', text: 'Результат' });
    const output = createElement('textarea', {
        className: 'admin-cipher__textarea admin-cipher__textarea--output',
        attributes: { rows: 3, readonly: '', 'aria-label': 'Результат' }
    });

    box.appendChild(inputLabel);
    box.appendChild(input);
    box.appendChild(outputLabel);
    box.appendChild(output);

    function transform() {
        const faction = langSelect.value;
        const text = input.value || '';
        output.value = directionSelect.value === 'decode'
            ? decryptFromFaction(text, faction)
            : encryptToFaction(text, faction);
    }

    input.addEventListener('input', transform);
    langSelect.addEventListener('change', transform);
    directionSelect.addEventListener('change', () => {
        inputLabel.textContent = directionSelect.value === 'decode' ? 'Зашифрованный текст' : 'Текст на кириллице';
        outputLabel.textContent = directionSelect.value === 'decode' ? 'Расшифровка' : 'Шифр';
        transform();
    });
    transform();

    box.appendChild(Button({
        text: 'Очистить',
        variant: 'secondary',
        size: 'sm',
        onClick: () => { input.value = ''; transform(); }
    }));

    return box;
}

function buildKeyTables() {
    const box = createElement('div', { className: 'admin-keys' });

    for (const faction of ['red', 'blue', 'purple']) {
        const block = createElement('div', { className: 'admin-keys__block' });
        block.appendChild(createElement('h3', {
            className: 'admin-keys__title',
            text: `${FACTION_LABELS[faction]} — ${LANGUAGE_LABELS[faction]}`
        }));

        const grid = createElement('div', { className: 'admin-cipher__alphabet' });
        for (const pair of getAlphabetPairs(faction)) {
            const cell = createElement('span', { className: 'admin-cipher__pair' });
            cell.appendChild(createElement('b', { text: pair.letter }));
            cell.appendChild(createElement('span', { text: pair.symbol }));
            grid.appendChild(cell);
        }
        block.appendChild(grid);
        box.appendChild(block);
    }

    return box;
}

/* ============================================================
   Каталоги
   ============================================================ */

function renderCatalogsSection() {
    const section = adminSection('Каталоги', 'Грифы, профессии и теги.');

    section.appendChild(collapse('Грифы', buildCatalog({
        load: getAllTags,
        add: addTag,
        remove: removeTag,
        placeholder: 'Название нового грифа',
        empty: 'Нет грифов'
    }), false));

    section.appendChild(collapse('Профессии', buildCatalog({
        load: getAllProfessions,
        add: addProfession,
        remove: removeProfession,
        placeholder: 'Название профессии',
        empty: 'Нет профессий'
    }), false));

    section.appendChild(collapse('Теги', buildCatalog({
        load: getAllSubTags,
        add: addSubTag,
        remove: removeSubTag,
        placeholder: 'Название тега',
        empty: 'Нет тегов'
    }), false));

    return section;
}

function buildCatalog({ load, add, remove, placeholder, empty }) {
    const box = createElement('div', { className: 'admin-catalog' });
    const listEl = createElement('div', { className: 'admin-tags__list', text: 'Загрузка...' });
    box.appendChild(listEl);

    const form = createElement('form', { className: 'admin-tags__form' });
    const input = createElement('input', {
        className: 'admin-tags__input',
        attributes: { type: 'text', placeholder }
    });
    const submit = Button({ text: 'Добавить', icon: 'add', variant: 'primary', attributes: { type: 'submit' } });
    form.appendChild(input);
    form.appendChild(submit);
    box.appendChild(form);

    async function refresh() {
        try {
            const items = await load();
            listEl.innerHTML = '';
            if (!items || items.length === 0) {
                listEl.textContent = empty;
                return;
            }
            for (const item of items) {
                const row = createElement('div', { className: 'admin-tags__item' });
                row.appendChild(createElement('span', { className: 'admin-tags__name', text: item.name }));
                row.appendChild(Button({
                    icon: 'delete',
                    variant: 'danger',
                    size: 'sm',
                    attributes: { type: 'button', 'aria-label': 'Удалить ' + item.name },
                    onClick: async () => {
                        if (!confirm(`Удалить «${item.name}»?`)) return;
                        try { await remove(item.id); refresh(); }
                        catch (err) { alert('Ошибка: ' + translateError(err)); }
                    }
                }));
                listEl.appendChild(row);
            }
        } catch (err) {
            listEl.textContent = 'Ошибка загрузки: ' + translateError(err);
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = input.value.trim();
        if (!name) return;
        try {
            await add(name);
            input.value = '';
            refresh();
        } catch (err) {
            alert('Ошибка: ' + translateError(err));
        }
    });

    refresh();
    return box;
}

/* ============================================================
   Оформление
   ============================================================ */

function renderDesignSection() {
    const section = adminSection('Оформление', 'Тема для всех агентов.');

    const current = store.get('design') || 'v1';
    const wrap = createElement('div', { className: 'admin-design' });

    const btnV1 = Button({
        text: 'Версия 1',
        variant: current === 'v1' ? 'primary' : 'secondary',
        onClick: () => switchDesign('v1')
    });
    const btnV2 = Button({
        text: 'Версия 2',
        variant: current === 'v2' ? 'primary' : 'secondary',
        onClick: () => switchDesign('v2')
    });

    const msg = StatusMessage({ type: 'ok', text: '', hidden: true });

    function switchDesign(version) {
        setDesign(version).then(() => {
            btnV1.className = btnV1.className.replace(/btn--(primary|secondary)/g, version === 'v1' ? 'btn--primary' : 'btn--secondary');
            btnV2.className = btnV2.className.replace(/btn--(primary|secondary)/g, version === 'v2' ? 'btn--primary' : 'btn--secondary');
            showMessage(msg, `Дизайн «${version}» применён`, 'ok');
        }).catch(err => {
            showMessage(msg, 'Ошибка: ' + translateError(err), 'err');
        });
    }

    wrap.appendChild(btnV1);
    wrap.appendChild(btnV2);
    section.appendChild(wrap);
    section.appendChild(msg);

    return section;
}

/* ============================================================
   Помощники
   ============================================================ */

function adminSection(title, desc) {
    const section = createElement('div', { className: 'admin-section' });
    section.appendChild(createElement('h2', { className: 'admin-section__title', text: title }));
    if (desc) section.appendChild(createElement('p', { className: 'admin-section__desc', text: desc }));
    return section;
}

function collapse(title, content, open = false) {
    const details = createElement('details', { className: 'admin-collapse' });
    if (open) details.open = true;

    const summary = createElement('summary', { className: 'admin-collapse__summary' });
    summary.appendChild(Icon({ name: 'chevron_right', size: 'sm' }));
    summary.appendChild(createElement('span', { text: title }));
    details.appendChild(summary);

    const body = createElement('div', { className: 'admin-collapse__body' });
    body.appendChild(content);
    details.appendChild(body);

    return details;
}
