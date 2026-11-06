import { store } from '../core/Store.js?v=6';
import { getAllTags, addTag, removeTag } from '../firebase/tagsService.js?v=6';
import { getAllSubTags, addSubTag, removeSubTag } from '../firebase/subtagsService.js?v=6';
import { getAllPages, buildPageTree } from '../firebase/pagesService.js?v=6';
import { getAllDocuments, getAccessIndex } from '../firebase/documentsService.js?v=6';
import { groupByNumber, LEVEL_LABELS } from '../domain/documents.js?v=6';
import { setDesign } from '../firebase/settingsService.js?v=6';
import { createElement } from '../utils/dom.js?v=6';
import { translateError } from '../utils/translateError.js?v=6';
import { Button } from '../components/Button.js?v=6';
import { StatusMessage, showMessage } from '../components/StatusMessage.js?v=6';
import { FactionBadge } from '../components/FactionBadge.js?v=6';
import { encryptToFaction, decryptFromFaction, getAlphabetPairs, LANGUAGE_LABELS } from '../utils/cipher.js?v=6';
import { FACTION_LABELS } from '../utils/profile.js?v=6';
import { Icon } from '../components/Icon.js?v=6';

export function AdminPage() {
    const section = createElement('section', { className: 'admin-page' });
    const user = store.get('user');

    if (!user || user.role !== 'master') {
        section.appendChild(createElement('div', {
            className: 'admin-page__error',
            children: [
                createElement('h2', { text: 'Доступ запрещён' }),
                createElement('p', { text: 'Только для мастерской.' })
            ]
        }));
        return section;
    }

    const container = createElement('div', { className: 'admin-page__container' });
    container.appendChild(createElement('h1', { className: 'admin-page__title', text: 'Мастерская' }));

    const roleSection = createElement('div', { className: 'admin-section' });
    roleSection.appendChild(createElement('h2', { className: 'admin-section__title', text: 'Игры и игроки' }));
    roleSection.appendChild(createElement('p', { className: 'admin-section__desc', text: 'Создание игр, персонажи, выдача фракций и реальные данные игроков.' }));
    const roleActions = createElement('div', { className: 'admin-section__actions' });
    roleActions.appendChild(Button({ text: 'Игры', href: '#/admin/games' }));
    roleActions.appendChild(Button({ text: 'Игроки', variant: 'secondary', href: '#/admin/users' }));
    roleSection.appendChild(roleActions);
    container.appendChild(roleSection);
    container.appendChild(renderDecryptSection());

    container.appendChild(renderDesignSection());
    container.appendChild(renderTagsSection());
    container.appendChild(renderSubTagsSection());
    container.appendChild(renderPagesSection());
    container.appendChild(renderDocumentsSection());
    section.appendChild(container);

    return section;
}

function renderDecryptSection() {
    const container = createElement('div', { className: 'admin-section' });

    container.appendChild(createElement('h2', { className: 'admin-section__title', text: 'Расшифровка текстов' }));
    container.appendChild(createElement('p', {
        className: 'admin-section__desc',
        text: 'Перевод между шифром фракции и кириллицей. Работает в обе стороны.'
    }));

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
    container.appendChild(controls);

    const inputLabel = createElement('label', { className: 'admin-cipher__label', text: 'Исходный текст' });
    const input = createElement('textarea', {
        className: 'admin-cipher__textarea',
        attributes: { rows: 4, placeholder: 'Вставьте текст...', 'aria-label': 'Исходный текст' }
    });

    const outputLabel = createElement('label', { className: 'admin-cipher__label', text: 'Результат' });
    const output = createElement('textarea', {
        className: 'admin-cipher__textarea admin-cipher__textarea--output',
        attributes: { rows: 4, readonly: '', 'aria-label': 'Результат' }
    });

    container.appendChild(inputLabel);
    container.appendChild(input);
    container.appendChild(outputLabel);
    container.appendChild(output);

    const alphabet = createElement('div', { className: 'admin-cipher__alphabet' });
    container.appendChild(createElement('h3', { className: 'admin-section__title', text: 'Алфавит' }));
    container.appendChild(alphabet);

    function renderAlphabet(faction) {
        alphabet.innerHTML = '';
        for (const pair of getAlphabetPairs(faction)) {
            const cell = createElement('span', { className: 'admin-cipher__pair' });
            cell.appendChild(createElement('b', { text: pair.letter }));
            cell.appendChild(createElement('span', { text: pair.symbol }));
            alphabet.appendChild(cell);
        }
    }

    function transform() {
        const faction = langSelect.value;
        const text = input.value || '';
        output.value = directionSelect.value === 'decode'
            ? decryptFromFaction(text, faction)
            : encryptToFaction(text, faction);
    }

    input.addEventListener('input', transform);
    langSelect.addEventListener('change', () => {
        renderAlphabet(langSelect.value);
        transform();
    });
    directionSelect.addEventListener('change', () => {
        inputLabel.textContent = directionSelect.value === 'decode' ? 'Зашифрованный текст' : 'Текст на кириллице';
        outputLabel.textContent = directionSelect.value === 'decode' ? 'Расшифровка' : 'Шифр';
        transform();
    });

    renderAlphabet(langSelect.value);
    transform();

    container.appendChild(Button({
        text: 'Очистить',
        variant: 'secondary',
        size: 'sm',
        onClick: () => {
            input.value = '';
            transform();
        }
    }));

    return container;
}

function renderDesignSection() {
    const container = createElement('div', { className: 'admin-section' });

    container.appendChild(createElement('h2', { className: 'admin-section__title', text: 'Дизайн сектора' }));
    container.appendChild(createElement('p', { className: 'admin-section__desc', text: 'Выберите оформление для всех агентов.' }));

    const current = store.get('design') || 'v1';
    const wrap = createElement('div', { className: 'admin-design' });

    const btnV1 = Button({
        text: 'Версия 1',
        variant: current === 'v1' ? 'primary' : 'secondary',
        attributes: { 'data-version': 'v1' },
        onClick: () => switchDesign('v1')
    });

    const btnV2 = Button({
        text: 'Версия 2',
        variant: current === 'v2' ? 'primary' : 'secondary',
        attributes: { 'data-version': 'v2' },
        onClick: () => switchDesign('v2')
    });

    const msg = StatusMessage({ type: 'ok', text: '', hidden: true });

    function switchDesign(version) {
        setDesign(version).then(() => {
            btnV1.className = btnV1.className.replace(/btn--(primary|secondary)/g, version === 'v1' ? 'btn--primary' : 'btn--secondary');
            btnV2.className = btnV2.className.replace(/btn--(primary|secondary)/g, version === 'v2' ? 'btn--primary' : 'btn--secondary');
            showMessage(msg, `Дизайн "${version}" применён`, 'ok');
        }).catch(err => {
            showMessage(msg, 'Ошибка: ' + translateError(err), 'err');
        });
    }

    wrap.appendChild(btnV1);
    wrap.appendChild(btnV2);
    container.appendChild(wrap);
    container.appendChild(msg);

    return container;
}

function renderTagsSection() {
    const container = createElement('div', { className: 'admin-section' });

    container.appendChild(createElement('h2', { className: 'admin-section__title', text: 'Каталог грифов' }));
    container.appendChild(createElement('p', { className: 'admin-section__desc', text: 'Управление реестром грифов доступа.' }));

    const tagsWrap = createElement('div', { className: 'admin-tags' });

    const list = createElement('div', { className: 'admin-tags__list', id: 'admin-tags-list', text: 'Загрузка...' });
    tagsWrap.appendChild(list);

    const form = createElement('form', {
        className: 'admin-tags__form',
        id: 'admin-tags-form',
        children: [
            createElement('input', { type: 'text', id: 'admin-tags-input', className: 'admin-tags__input', placeholder: 'Название нового грифа' }),
            Button({ text: 'Добавить', variant: 'primary', attributes: { type: 'submit' } })
        ]
    });
    tagsWrap.appendChild(form);
    container.appendChild(tagsWrap);

    setTimeout(loadTagsList, 0);

    return container;
}

async function loadTagsList() {
    const listEl = document.getElementById('admin-tags-list');
    if (!listEl) return;

    try {
        const tags = await getAllTags();
        if (!tags || tags.length === 0) {
            listEl.textContent = 'Нет грифов';
            return;
        }
        listEl.innerHTML = '';
        const fragment = document.createDocumentFragment();
        tags.forEach(tag => {
            const item = createElement('div', { className: 'admin-tags__item' });
            item.appendChild(createElement('span', { className: 'admin-tags__name', text: tag.name }));
            const delBtn = Button({ icon: 'delete', variant: 'danger', size: 'sm', attributes: { 'data-id': tag.id, title: 'Удалить гриф', 'aria-label': 'Удалить гриф ' + tag.name } });
            item.appendChild(delBtn);
            fragment.appendChild(item);
        });
        listEl.appendChild(fragment);

        listEl.querySelectorAll('.btn--danger').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                if (!confirm('Удалить гриф?')) return;
                try { await removeTag(id); loadTagsList(); } catch (err) { alert('Ошибка удаления: ' + translateError(err)); }
            });
        });
    } catch (err) {
        listEl.textContent = 'Ошибка загрузки: ' + translateError(err);
    }
}

document.addEventListener('submit', async (e) => {
    if (e.target.id !== 'admin-tags-form') return;
    e.preventDefault();
    const input = document.getElementById('admin-tags-input');
    const name = input.value.trim();
    if (!name) return;
    try { await addTag(name); input.value = ''; loadTagsList(); } catch (err) { alert('Ошибка: ' + translateError(err)); }
});

function renderSubTagsSection() {
    const container = createElement('div', { className: 'admin-section' });

    container.appendChild(createElement('h2', { className: 'admin-section__title', text: 'Технические субтеги' }));
    container.appendChild(createElement('p', { className: 'admin-section__desc', text: 'Авто-создаются из грифов фракционных страниц.' }));

    const wrap = createElement('div', { className: 'admin-tags' });

    const list = createElement('div', { className: 'admin-tags__list', id: 'admin-subtags-list', text: 'Загрузка...' });
    wrap.appendChild(list);

    const form = createElement('form', {
        className: 'admin-tags__form',
        id: 'admin-subtags-form',
        children: [
            createElement('input', { type: 'text', id: 'admin-subtags-input', className: 'admin-tags__input', placeholder: 'Название субтега' }),
            Button({ text: 'Добавить', variant: 'primary', attributes: { type: 'submit' } })
        ]
    });
    wrap.appendChild(form);
    container.appendChild(wrap);

    setTimeout(loadSubTagsList, 0);

    return container;
}

async function loadSubTagsList() {
    const listEl = document.getElementById('admin-subtags-list');
    if (!listEl) return;

    try {
        const tags = await getAllSubTags();
        if (!tags || tags.length === 0) {
            listEl.textContent = 'Нет субтегов';
            return;
        }
        listEl.innerHTML = '';
        const fragment = document.createDocumentFragment();
        tags.forEach(tag => {
            const item = createElement('div', { className: 'admin-tags__item' });
            item.appendChild(createElement('span', { className: 'admin-tags__name', text: tag.name }));
            const delBtn = Button({ icon: 'delete', variant: 'danger', size: 'sm', attributes: { 'data-id': tag.id, title: 'Удалить субтег', 'aria-label': 'Удалить субтег ' + tag.name } });
            item.appendChild(delBtn);
            fragment.appendChild(item);
        });
        listEl.appendChild(fragment);

        listEl.querySelectorAll('.btn--danger').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                if (!confirm('Удалить субтег?')) return;
                try { await removeSubTag(id); loadSubTagsList(); } catch (err) { alert('Ошибка удаления: ' + translateError(err)); }
            });
        });
    } catch (err) {
        listEl.textContent = 'Ошибка загрузки: ' + translateError(err);
    }
}

document.addEventListener('submit', async (e) => {
    if (e.target.id !== 'admin-subtags-form') return;
    e.preventDefault();
    const input = document.getElementById('admin-subtags-input');
    const name = input.value.trim();
    if (!name) return;
    try { await addSubTag(name); input.value = ''; loadSubTagsList(); } catch (err) { alert('Ошибка: ' + translateError(err)); }
});

function renderPagesSection() {
    const container = createElement('div', { className: 'admin-section' });

    container.appendChild(createElement('h2', { className: 'admin-section__title', text: 'Архив досье' }));
    container.appendChild(createElement('p', { className: 'admin-section__desc', text: 'Управление архивом досье.' }));

    const createBtnWrap = createElement('div', { className: 'admin-pages__create-wrap' });
    createBtnWrap.appendChild(Button({ text: 'Новое досье', icon: 'add', href: '#/page/create' }));
    container.appendChild(createBtnWrap);

    const tree = createElement('div', { className: 'admin-pages__tree', id: 'admin-pages-tree', text: 'Загрузка...' });
    container.appendChild(tree);

    setTimeout(loadPagesTree, 0);

    return container;
}

async function loadPagesTree() {
    const treeEl = document.getElementById('admin-pages-tree');
    if (!treeEl) return;

    try {
        const pages = await getAllPages();
        if (!pages || pages.length === 0) {
            treeEl.textContent = 'Нет досье';
            return;
        }
        const tree = buildPageTree(pages);
        treeEl.innerHTML = '';
        treeEl.appendChild(renderAdminTree(tree));
    } catch (err) {
        treeEl.textContent = 'Ошибка загрузки: ' + translateError(err);
    }
}

function renderAdminTree(nodes) {
    if (!nodes || nodes.length === 0) return document.createTextNode('');

    const ul = createElement('ul', { className: 'admin-tree' });
    const fragment = document.createDocumentFragment();

    nodes.forEach(node => {
        const li = createElement('li', { className: 'admin-tree__item' });

        const header = createElement('div', { className: 'admin-tree__header' });
        header.appendChild(createElement('a', { className: 'admin-tree__link', attributes: { href: `#/page/view?slug=${node.slug}` }, text: node.title }));

        const actions = createElement('span', { className: 'admin-tree__actions' });
        const editLink = createElement('a', { className: 'admin-tree__edit', attributes: { href: `#/page/edit?slug=${node.slug}`, 'aria-label': 'Редактировать' } });
        editLink.appendChild(Icon({ name: 'edit', size: 'sm' }));
        actions.appendChild(editLink);
        header.appendChild(actions);
        li.appendChild(header);

        if (node.children && node.children.length > 0) {
            li.appendChild(renderAdminTree(node.children));
        }

        fragment.appendChild(li);
    });

    ul.appendChild(fragment);
    return ul;
}

function renderDocumentsSection() {
    const container = createElement('div', { className: 'admin-section' });

    container.appendChild(createElement('h2', { className: 'admin-section__title', text: 'Документы' }));
    container.appendChild(createElement('p', { className: 'admin-section__desc', text: 'Список документов с доступом.' }));

    const wrap = createElement('div', { className: 'admin-documents' });
    const list = createElement('div', { className: 'admin-documents__list', id: 'admin-documents-list', text: 'Загрузка...' });
    wrap.appendChild(list);
    container.appendChild(wrap);

    setTimeout(loadAdminDocuments, 0);

    return container;
}

async function loadAdminDocuments() {
    const listEl = document.getElementById('admin-documents-list');
    if (!listEl) return;

    try {
        const docs = await getAllDocuments();
        if (!docs || docs.length === 0) {
            listEl.textContent = 'Нет документов';
            return;
        }

        const accessIndex = await getAccessIndex();
        const groups = groupByNumber(docs);
        listEl.innerHTML = '';

        for (const number of [...groups.keys()].sort()) {
            const versions = groups.get(number);
            const item = createElement('div', { className: 'admin-documents__item' });

            const header = createElement('div', { className: 'admin-documents__header' });
            header.appendChild(createElement('a', {
                className: 'admin-documents__number',
                attributes: { href: `#/documents/view?id=${versions[0].id}` },
                text: `№ ${number}`
            }));
            item.appendChild(header);

            // Версии документа
            const versionsList = createElement('div', { className: 'admin-documents__versions' });
            for (const version of versions) {
                const versionRow = createElement('div', { className: 'admin-documents__version' });
                versionRow.appendChild(FactionBadge({ faction: version.faction }));
                versionRow.appendChild(createElement('span', {
                    className: 'admin-documents__version-level',
                    text: LEVEL_LABELS[version.level] || version.level
                }));
                versionRow.appendChild(createElement('span', {
                    className: 'admin-documents__key',
                    attributes: { title: 'Код доступа' },
                    text: version.accessKey
                }));
                versionsList.appendChild(versionRow);
            }
            item.appendChild(versionsList);

            // Читатели по всем версиям (запрос users уже сделан один раз)
            const ids = versions.map(v => v.id);
            const readers = accessIndex.filter(u => u.documents.some(id => ids.includes(id)));
            if (readers.length > 0) {
                const readersList = createElement('div', { className: 'admin-documents__readers' });
                readersList.appendChild(createElement('span', { className: 'admin-documents__readers-label', text: 'Читатели:' }));
                for (const r of readers) {
                    readersList.appendChild(createElement('a', {
                        className: 'admin-documents__reader',
                        attributes: { href: `#/profile?uid=${r.uid}` },
                        text: r.displayName || r.username
                    }));
                }
                item.appendChild(readersList);
            } else {
                item.appendChild(createElement('span', { className: 'admin-documents__readers-empty', text: 'Нет читателей' }));
            }

            listEl.appendChild(item);
        }
    } catch (err) {
        listEl.textContent = 'Ошибка загрузки: ' + translateError(err);
    }
}
