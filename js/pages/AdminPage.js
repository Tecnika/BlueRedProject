import { store } from '../core/Store.js?v=4';
import { getAllTags, addTag, removeTag } from '../firebase/tagsService.js?v=4';
import { getAllSubTags, addSubTag, removeSubTag } from '../firebase/subtagsService.js?v=4';
import { getAllPages, buildPageTree } from '../firebase/pagesService.js?v=4';
import { getAllDocuments, getDocumentReaders } from '../firebase/documentsService.js?v=4';
import { getDesign, setDesign } from '../firebase/settingsService.js?v=4';
import { createElement } from '../utils/dom.js?v=4';
import { translateError } from '../utils/translateError.js?v=4';
import { Button } from '../components/Button.js?v=4';
import { StatusMessage, showMessage } from '../components/StatusMessage.js?v=4';
import { FactionBadge } from '../components/FactionBadge.js?v=4';

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

    container.appendChild(renderDesignSection());
    container.appendChild(renderTagsSection());
    container.appendChild(renderSubTagsSection());
    container.appendChild(renderPagesSection());
    container.appendChild(renderDocumentsSection());
    section.appendChild(container);

    return section;
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

    loadTagsList();

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
            const delBtn = Button({ text: '✕', variant: 'danger', size: 'sm', attributes: { 'data-id': tag.id, title: 'Удалить гриф' } });
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

    loadSubTagsList();

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
            const delBtn = Button({ text: '✕', variant: 'danger', size: 'sm', attributes: { 'data-id': tag.id, title: 'Удалить субтег' } });
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
    createBtnWrap.appendChild(Button({ text: '+ Новое досье', href: '#/page/create' }));
    container.appendChild(createBtnWrap);

    const tree = createElement('div', { className: 'admin-pages__tree', id: 'admin-pages-tree', text: 'Загрузка...' });
    container.appendChild(tree);

    loadPagesTree();

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
        actions.appendChild(createElement('a', { className: 'admin-tree__edit', attributes: { href: `#/page/edit?slug=${node.slug}` }, text: '✎' }));
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

    loadAdminDocuments();

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

        listEl.innerHTML = '';

        for (const doc of docs) {
            const item = createElement('div', { className: 'admin-documents__item' });

            const header = createElement('div', { className: 'admin-documents__header' });
            header.appendChild(createElement('a', { className: 'admin-documents__number', attributes: { href: `#/documents/view?id=${doc.id}` }, text: `№ ${doc.number}` }));
            header.appendChild(FactionBadge({ faction: doc.faction }));
            header.appendChild(createElement('span', { className: 'admin-documents__key', attributes: { title: 'Код доступа' }, text: doc.accessKey }));
            item.appendChild(header);

            try {
                const readers = await getDocumentReaders(doc.id);
                if (readers.length > 0) {
                    const readersList = createElement('div', { className: 'admin-documents__readers' });
                    readersList.appendChild(createElement('span', { className: 'admin-documents__readers-label', text: 'Читатели:' }));
                    for (const r of readers) {
                        readersList.appendChild(createElement('a', { className: 'admin-documents__reader', attributes: { href: `#/profile?uid=${r.uid}` }, text: r.displayName || r.username }));
                    }
                    item.appendChild(readersList);
                } else {
                    item.appendChild(createElement('span', { className: 'admin-documents__readers-empty', text: 'Нет читателей' }));
                }
            } catch (_) {
                item.appendChild(createElement('span', { className: 'admin-documents__readers-empty', text: 'Ошибка загрузки читателей' }));
            }

            listEl.appendChild(item);
        }
    } catch (err) {
        listEl.textContent = 'Ошибка загрузки: ' + translateError(err);
    }
}
