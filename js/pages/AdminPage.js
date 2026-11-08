import { store } from '../core/Store.js?v=28';
import { getAllTags, addTag, removeTag } from '../firebase/tagsService.js?v=28';
import { getAllSubTags, addSubTag, removeSubTag } from '../firebase/subtagsService.js?v=28';
import { getAllProfessions, addProfession, removeProfession } from '../firebase/professionsService.js?v=28';
import { getRecentLogs } from '../firebase/chatService.js?v=28';
import { getTechAccounts } from '../firebase/techAccountsService.js?v=28';
import { getAllPublicPlayers } from '../firebase/publicPlayersService.js?v=28';
import { setDesign } from '../firebase/settingsService.js?v=28';
import { createElement } from '../utils/dom.js?v=28';
import { translateError } from '../utils/translateError.js?v=28';
import { Button } from '../components/Button.js?v=28';
import { StatusMessage, showMessage } from '../components/StatusMessage.js?v=28';
import { Icon } from '../components/Icon.js?v=28';
import { FactionBadge } from '../components/FactionBadge.js?v=28';
import { createAvatar } from '../core/Avatar.js?v=28';
import { encryptToFaction, decryptFromFaction, getAlphabetPairs, LANGUAGE_LABELS } from '../utils/cipher.js?v=28';
import { FACTION_LABELS } from '../utils/profile.js?v=28';

const ADMIN_SECTIONS = [
    { id: 'game', label: 'Игра', icon: 'sports_esports' },
    { id: 'tech', label: 'Технические учётки', icon: 'badge' },
    { id: 'tests', label: 'Коды шифрования', icon: 'key' },
    { id: 'catalogs', label: 'Каталоги', icon: 'category' },
    { id: 'logs', label: 'Логи', icon: 'receipt_long' },
    { id: 'design', label: 'Оформление', icon: 'palette' }
];

const GAME_STATUS_LABELS = { draft: 'черновик', active: 'активна', finished: 'завершена' };

export function AdminPage() {
    const section = createElement('section', { className: 'admin-page' });
    const user = store.get('user');

    if (!user || user.role !== 'master') {
        section.appendChild(StatusMessage({ type: 'err', text: 'Доступ запрещён' }));
        return section;
    }

    const initialTab = readAdminTab();
    const container = createElement('div', { className: 'admin-page__container' });
    container.appendChild(buildAdminHeader(user));

    const layout = createElement('div', { className: 'admin-page__layout' });
    const content = createElement('div', { className: 'admin-content' });

    const sections = {
        game: renderGameSection(),
        tech: renderTechAccountsSection(),
        tests: renderTestsSection(),
        catalogs: renderCatalogsSection(),
        logs: renderLogsSection(),
        design: renderDesignSection()
    };

    for (const def of ADMIN_SECTIONS) {
        const panel = sections[def.id];
        panel.hidden = def.id !== initialTab;
        content.appendChild(panel);
    }

    layout.appendChild(buildAdminNav(initialTab, selectAdminTab));
    layout.appendChild(content);
    container.appendChild(layout);
    section.appendChild(container);

    function selectAdminTab(id) {
        if (!sections[id]) return;
        for (const def of ADMIN_SECTIONS) {
            sections[def.id].hidden = def.id !== id;
        }
        layout.querySelectorAll('.admin-nav__item').forEach(btn => {
            const active = btn.dataset.adminTab === id;
            btn.classList.toggle('admin-nav__item--active', active);
            btn.setAttribute('aria-selected', String(active));
        });
        const url = id === 'game' ? '#/admin' : '#/admin?tab=' + id;
        history.replaceState(null, '', url);
    }

    return section;
}

function readAdminTab() {
    const query = window.location.hash.split('?')[1] || '';
    const tab = new URLSearchParams(query).get('tab');
    return ADMIN_SECTIONS.some(s => s.id === tab) ? tab : 'game';
}

function buildAdminHeader(user) {
    const header = createElement('header', { className: 'admin-page__header' });

    const text = createElement('div', { className: 'admin-page__head-text' });
    text.appendChild(createElement('p', { className: 'admin-page__eyebrow', text: 'Сектор BlueRed · мастерская' }));
    text.appendChild(createElement('h1', { className: 'admin-page__title', text: 'Мастерская' }));
    text.appendChild(createElement('p', {
        className: 'admin-page__subtitle',
        text: 'Игры, персонажи, доступы, материалы и журнал событий — в одном месте.'
    }));
    header.appendChild(text);

    const meta = createElement('div', { className: 'admin-page__meta' });

    const game = store.get('activeGame');
    const gameChip = createElement('span', {
        className: 'admin-page__chip' + (game ? ' admin-page__chip--active' : '')
    });
    gameChip.appendChild(createElement('span', { className: 'admin-page__chip-dot' }));
    gameChip.appendChild(createElement('span', {
        text: game
            ? `Игра: ${game.name} · ${GAME_STATUS_LABELS[game.status] || game.status}`
            : 'Нет активной игры'
    }));
    meta.appendChild(gameChip);

    const userChip = createElement('span', { className: 'admin-page__chip' });
    userChip.appendChild(Icon({ name: 'shield_person', size: 'sm' }));
    userChip.appendChild(createElement('span', { text: 'Мастер · ' + (user.username || '') }));
    meta.appendChild(userChip);

    header.appendChild(meta);
    return header;
}

function buildAdminNav(activeId, onSelect) {
    const aside = createElement('aside', { className: 'admin-nav' });
    const list = createElement('nav', {
        className: 'admin-nav__list',
        attributes: { 'aria-label': 'Разделы мастерской' }
    });

    for (const def of ADMIN_SECTIONS) {
        const active = def.id === activeId;
        const btn = createElement('button', {
            className: 'admin-nav__item' + (active ? ' admin-nav__item--active' : ''),
            attributes: {
                type: 'button',
                role: 'tab',
                'data-admin-tab': def.id,
                'aria-selected': String(active),
                'aria-controls': 'admin-panel-' + def.id
            }
        });
        btn.appendChild(Icon({ name: def.icon, size: 'sm' }));
        btn.appendChild(createElement('span', { text: def.label }));
        btn.addEventListener('click', () => onSelect(def.id));
        list.appendChild(btn);
    }

    aside.appendChild(list);

    const hint = createElement('div', { className: 'admin-nav__hint' });
    hint.appendChild(Icon({ name: 'info', size: 'sm' }));
    hint.appendChild(createElement('p', {
        text: 'Логи фиксируют сообщения чатов, открытие радиоканалов и действия хакеров.'
    }));
    aside.appendChild(hint);

    return aside;
}

/* ============================================================
   Игра и персонажи
   ============================================================ */

function renderGameSection() {
    const section = adminSection('Игра', 'Активная игра, персонажи и реальные данные игроков.', 'game');

    const game = store.get('activeGame');
    const status = createElement('div', {
        className: 'admin-game-status' + (game ? '' : ' admin-game-status--empty')
    });
    status.appendChild(Icon({ name: game ? 'sports_esports' : 'info', size: 'md' }));
    const statusInfo = createElement('div', { className: 'admin-game-status__info' });
    statusInfo.appendChild(createElement('div', {
        className: 'admin-game-status__name',
        text: game ? game.name : 'Активная игра не выбрана'
    }));
    statusInfo.appendChild(createElement('div', {
        className: 'admin-game-status__meta',
        text: game
            ? `Статус: ${GAME_STATUS_LABELS[game.status] || game.status}${game.startDate ? ' · старт ' + game.startDate : ''}`
            : 'Создайте игру во вкладке «Игры и персонажи», чтобы открыть эфир и фракции.'
    }));
    status.appendChild(statusInfo);
    section.appendChild(status);

    const grid = createElement('div', { className: 'admin-action-grid' });
    grid.appendChild(actionTile({
        href: '#/admin/games',
        icon: 'sports_esports',
        title: 'Игры и персонажи',
        desc: 'Создание, активация, состав и фракции'
    }));
    grid.appendChild(actionTile({
        href: '#/admin/users',
        icon: 'badge',
        title: 'Игроки и роли',
        desc: 'Реальные данные, игротехники, радиорубки'
    }));
    grid.appendChild(actionTile({
        href: '#/rules',
        icon: 'menu_book',
        title: 'Правила',
        desc: 'Статьи, механики и скрытые разделы'
    }));
    section.appendChild(grid);

    return section;
}

function actionTile({ href, icon, title, desc }) {
    const link = createElement('a', { className: 'admin-action', attributes: { href } });
    const iconBox = createElement('span', { className: 'admin-action__icon' });
    iconBox.appendChild(Icon({ name: icon, size: 'md' }));
    link.appendChild(iconBox);

    const body = createElement('span', { className: 'admin-action__body' });
    body.appendChild(createElement('span', { className: 'admin-action__title', text: title }));
    body.appendChild(createElement('span', { className: 'admin-action__desc', text: desc }));
    link.appendChild(body);
    link.appendChild(Icon({ name: 'arrow_forward', size: 'sm' }));

    return link;
}

/* ============================================================
   Тесты: расшифратор и таблицы ключей
   ============================================================ */

function renderTechAccountsSection() {
    const section = adminSection(
        'Технические учётки',
        'Логины и пароли аккаунтов радиорубок. Видны только мастерам — не передавайте их игрокам.',
        'tech'
    );

    const refreshBtn = Button({
        text: 'Обновить',
        icon: 'refresh',
        variant: 'secondary',
        size: 'sm'
    });

    const copyAllBtn = Button({
        text: 'Скопировать все',
        icon: 'content_copy',
        variant: 'secondary',
        size: 'sm'
    });

    const countEl = createElement('span', { className: 'admin-toolbar__count', text: '' });
    const toolbar = createElement('div', { className: 'admin-toolbar' });
    toolbar.appendChild(refreshBtn);
    toolbar.appendChild(copyAllBtn);
    toolbar.appendChild(countEl);

    const listEl = createElement('div', { className: 'admin-tech', text: 'Загрузка...' });
    const msg = StatusMessage({ type: 'ok', text: '', hidden: true });

    section.appendChild(toolbar);
    section.appendChild(listEl);
    section.appendChild(msg);

    let accountsCache = [];

    async function copyAllCredentials() {
        if (accountsCache.length === 0) {
            showMessage(msg, 'Список учёток пуст', 'err');
            return;
        }
        const text = accountsCache.map(account =>
            `${account.label || account.faction}\nПозывной: ${account.username}\nПароль: ${account.password}`
        ).join('\n\n');
        try {
            await navigator.clipboard.writeText(text);
            showMessage(msg, `Скопировано учёток: ${accountsCache.length}`, 'ok');
        } catch (e) {
            showMessage(msg, 'Браузер не дал скопировать. Выделите данные вручную.', 'err');
        }
    }

    async function copyCredentials(account) {
        const text = `Фракция: ${account.label || account.faction}\nПозывной: ${account.username}\nПароль: ${account.password}`;
        try {
            await navigator.clipboard.writeText(text);
            showMessage(msg, `Скопировано: ${account.username}`, 'ok');
        } catch (e) {
            showMessage(msg, 'Браузер не дал скопировать. Выделите данные вручную.', 'err');
        }
    }

    async function refresh() {
        try {
            const accounts = await getTechAccounts();
            const players = await getAllPublicPlayers();
            const photoMap = {};
            for (const player of players) photoMap[player.uid] = player.photo || null;
            accountsCache = accounts;
            countEl.textContent = accounts.length ? `${accounts.length} учётки` : '';
            listEl.innerHTML = '';
            if (accounts.length === 0) {
                listEl.textContent = 'Технические учётки ещё не созданы';
                return;
            }

            for (const account of accounts) {
                const card = createElement('div', { className: 'admin-tech__card' });

                const head = createElement('div', { className: 'admin-tech__head' });
                head.appendChild(createAvatar(
                    account.username || 'radio',
                    account.faction,
                    'admin-tech__avatar',
                    null,
                    photoMap[account.uid] || null
                ));
                head.appendChild(FactionBadge({ faction: account.faction, size: 'sm' }));
                head.appendChild(createElement('span', {
                    className: 'admin-tech__label',
                    text: account.label || account.faction
                }));
                card.appendChild(head);

                const creds = createElement('div', { className: 'admin-tech__creds' });
                const login = createElement('div', { className: 'admin-tech__cred' });
                login.appendChild(createElement('span', { className: 'admin-tech__key', text: 'Позывной' }));
                login.appendChild(createElement('code', { className: 'admin-tech__value', text: account.username || '—' }));
                creds.appendChild(login);

                const password = createElement('div', { className: 'admin-tech__cred' });
                password.appendChild(createElement('span', { className: 'admin-tech__key', text: 'Пароль' }));
                password.appendChild(createElement('code', {
                    className: 'admin-tech__value admin-tech__value--password',
                    text: account.password || '—'
                }));
                creds.appendChild(password);
                card.appendChild(creds);

                card.appendChild(Button({
                    text: 'Скопировать',
                    icon: 'content_copy',
                    variant: 'secondary',
                    size: 'sm',
                    onClick: () => copyCredentials(account)
                }));

                listEl.appendChild(card);
            }
        } catch (err) {
            listEl.textContent = 'Ошибка загрузки: ' + translateError(err);
        }
    }

    refreshBtn.addEventListener('click', refresh);
    copyAllBtn.addEventListener('click', copyAllCredentials);
    refresh();
    return section;
}

function renderTestsSection() {
    const section = adminSection('Коды шифрования', 'Расшифровка, шифрование и таблицы ключей фракций.', 'tests');

    const decrypt = collapse('Расшифровка текстов', buildDecryptor(), true);
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
    const section = adminSection('Каталоги', 'Справочники для страниц, персонажей и технических меток.', 'catalogs');

    section.appendChild(collapse('Грифы', buildCatalog({
        load: getAllTags,
        add: addTag,
        remove: removeTag,
        placeholder: 'Название нового грифа',
        empty: 'Нет грифов',
        desc: 'Темы и допуски страниц Эфира. По этим меткам настраивается видимость материалов.'
    }), false));

    section.appendChild(collapse('Профессии', buildCatalog({
        load: getAllProfessions,
        add: addProfession,
        remove: removeProfession,
        placeholder: 'Название профессии',
        empty: 'Нет профессий',
        desc: 'Должности персонажей. Инженер, Связист, Дипломат и Хакер влияют на механику радиорубки.'
    }), false));

    section.appendChild(collapse('Технические теги', buildCatalog({
        load: getAllSubTags,
        add: addSubTag,
        remove: removeSubTag,
        placeholder: 'Название тега',
        empty: 'Нет тегов',
        desc: 'Составные метки ячеек фракционных страниц: гриф_фракция_уровень. Создаются автоматически.'
    }), false));

    return section;
}

function buildCatalog({ load, add, remove, placeholder, empty, desc }) {
    const box = createElement('div', { className: 'admin-catalog' });
    if (desc) {
        box.appendChild(createElement('p', { className: 'admin-catalog__desc', text: desc }));
    }
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

function renderLogsSection() {
    const section = adminSection(
        'Логи',
        'Кто, кому, что и когда: сообщения чатов, радиорубки и действия хакеров.',
        'logs'
    );

    let allLogs = [];
    let logPhotos = {};

    const search = createElement('input', {
        className: 'admin-log-toolbar__search',
        attributes: {
            type: 'search',
            placeholder: 'Поиск по автору, каналу или тексту',
            'aria-label': 'Поиск по логам'
        }
    });

    const filter = createElement('select', {
        className: 'admin-log-toolbar__filter',
        attributes: { 'aria-label': 'Фильтр по типу события' }
    });
    for (const [value, label] of [
        ['all', 'Все события'],
        ['chat', 'Чаты'],
        ['radio', 'Радиорубка'],
        ['hack', 'Взломы']
    ]) {
        filter.appendChild(createElement('option', { text: label, attributes: { value } }));
    }

    const refreshBtn = Button({
        text: 'Обновить',
        icon: 'refresh',
        variant: 'secondary',
        size: 'sm'
    });

    const countEl = createElement('span', { className: 'admin-log-toolbar__count', text: '' });
    const toolbar = createElement('div', { className: 'admin-log-toolbar' });
    toolbar.appendChild(search);
    toolbar.appendChild(filter);
    toolbar.appendChild(refreshBtn);
    toolbar.appendChild(countEl);

    const table = createElement('div', { className: 'admin-logs' });
    const head = createElement('div', { className: 'admin-logs__head' });
    for (const label of ['Время', 'Автор', 'Канал', 'Текст']) {
        head.appendChild(createElement('span', { text: label }));
    }
    const body = createElement('div', { className: 'admin-logs__body', text: 'Загрузка...' });
    table.appendChild(head);
    table.appendChild(body);

    section.appendChild(toolbar);
    section.appendChild(table);

    function renderRows() {
        const query = search.value.trim().toLowerCase();
        const category = filter.value;
        const filtered = allLogs.filter(log => {
            if (category !== 'all' && logCategory(log) !== category) return false;
            if (!query) return true;
            return `${log.authorName || ''} ${log.chatTitle || ''} ${log.text || ''}`
                .toLowerCase()
                .includes(query);
        });

        countEl.textContent = `${filtered.length} из ${allLogs.length}`;
        body.innerHTML = '';

        if (filtered.length === 0) {
            body.appendChild(createElement('div', {
                className: 'admin-logs__empty',
                text: allLogs.length === 0 ? 'Пока пусто' : 'Ничего не найдено'
            }));
            return;
        }

        for (const log of filtered) {
            const categoryName = logCategory(log);
            const row = createElement('div', {
                className: `admin-logs__item admin-logs__item--${categoryName}`
            });
            row.appendChild(createElement('span', {
                className: 'admin-logs__time',
                text: formatLogTime(log.createdAt)
            }));

            const authorCell = createElement('span', { className: 'admin-logs__author' });
            authorCell.appendChild(createAvatar(
                log.authorName || 'user',
                log.faction || null,
                'admin-logs__avatar',
                null,
                logPhotos[log.authorId] || null
            ));
            if (log.authorId) {
                authorCell.appendChild(createElement('a', {
                    className: 'admin-logs__author-link',
                    text: log.authorName || '—',
                    attributes: { href: '#/profile?uid=' + log.authorId }
                }));
            } else {
                authorCell.appendChild(createElement('span', { text: log.authorName || '—' }));
            }
            row.appendChild(authorCell);

            const href = logChatHref(log);
            const chatEl = createElement(href ? 'a' : 'span', {
                className: 'admin-logs__chat',
                attributes: href ? { href, title: 'Открыть источник' } : {}
            });
            chatEl.appendChild(Icon({ name: logIconName(log), size: 'sm' }));
            chatEl.appendChild(createElement('span', { text: log.chatTitle || log.chatType || '—' }));
            row.appendChild(chatEl);

            const textEl = createElement('span', {
                className: 'admin-logs__text',
                text: log.text || '',
                attributes: { title: log.text || '' }
            });
            row.appendChild(textEl);
            body.appendChild(row);
        }
    }

    async function refresh() {
        body.textContent = 'Загрузка...';
        try {
            allLogs = await getRecentLogs(200);
            const players = await getAllPublicPlayers();
            logPhotos = {};
            for (const player of players) logPhotos[player.uid] = player.photo || null;
            renderRows();
        } catch (err) {
            body.textContent = 'Ошибка загрузки: ' + translateError(err);
        }
    }

    search.addEventListener('input', renderRows);
    filter.addEventListener('change', renderRows);
    refreshBtn.addEventListener('click', refresh);
    refresh();
    return section;
}

function formatLogTime(iso) {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });
}

function logCategory(log) {
    const source = `${log.chatTitle || ''} ${log.chatType || ''}`.toLowerCase();
    if (source.includes('взлом')) return 'hack';
    if (source.includes('радиорубка') || source.includes('связь:')) return 'radio';
    return 'chat';
}

function logIconName(log) {
    const type = (log.chatType || '').toLowerCase();
    if (type === 'faction') return 'groups';
    if (type === 'master') return 'admin_panel_settings';
    if (type === 'dm') return 'person';
    if (type === 'cross') return 'settings_input_antenna';
    const category = logCategory(log);
    if (category === 'hack') return 'warning';
    if (category === 'radio') return 'settings_input_antenna';
    return 'chat_bubble';
}

function logChatHref(log) {
    const type = (log.chatType || '').toLowerCase();
    if (type === 'faction' || type === 'cross') return '#/faction';

    if (type === 'master') {
        const uid = String(log.chatId || '').replace(/^master_/, '');
        if (uid) return '#/profile?uid=' + uid;
    }

    if (type === 'dm') {
        const ids = String(log.chatId || '').replace(/^dm_/, '').split('_');
        const other = ids.find(id => id && id !== log.authorId);
        if (other) return '#/profile?uid=' + other;
    }

    const category = logCategory(log);
    if (category === 'hack') return '#/admin?tab=tech';
    if (category === 'radio') return '#/faction';
    return '';
}

function renderDesignSection() {
    const section = adminSection(
        'Оформление',
        'Тема интерфейса для всех агентов сектора.',
        'design'
    );

    const current = store.get('design') || localStorage.getItem('bluered_design') || 'v2';
    const wrap = createElement('div', { className: 'admin-design' });
    const msg = StatusMessage({ type: 'ok', text: '', hidden: true });
    const cards = {};

    function buildCard(version, title, desc) {
        const card = createElement('button', {
            className: 'admin-design-card' + (version === current ? ' admin-design-card--active' : ''),
            attributes: { type: 'button', 'data-version': version }
        });

        const preview = createElement('span', {
            className: `admin-design-card__preview admin-design-card__preview--${version}`
        });
        preview.appendChild(createElement('span', { className: 'admin-design-card__side' }));
        const body = createElement('span', { className: 'admin-design-card__body' });
        body.appendChild(createElement('span', { className: 'admin-design-card__line admin-design-card__line--head' }));
        body.appendChild(createElement('span', { className: 'admin-design-card__line' }));
        body.appendChild(createElement('span', { className: 'admin-design-card__line admin-design-card__line--short' }));
        preview.appendChild(body);
        card.appendChild(preview);

        card.appendChild(createElement('span', { className: 'admin-design-card__title', text: title }));
        card.appendChild(createElement('span', { className: 'admin-design-card__desc', text: desc }));
        card.addEventListener('click', () => switchDesign(version));
        return card;
    }

    cards.v1 = buildCard('v1', 'Версия 1', 'Светлая тема');
    cards.v2 = buildCard('v2', 'Версия 2', 'Тёмный неон');
    wrap.appendChild(cards.v1);
    wrap.appendChild(cards.v2);

    function switchDesign(version) {
        setDesign(version).then(() => {
            for (const key of Object.keys(cards)) {
                cards[key].classList.toggle('admin-design-card--active', key === version);
            }
            showMessage(msg, `Дизайн «${version}» применён`, 'ok');
        }).catch(err => {
            showMessage(msg, 'Ошибка: ' + translateError(err), 'err');
        });
    }

    section.appendChild(wrap);
    section.appendChild(msg);
    return section;
}

/* ============================================================
   Помощники
   ============================================================ */

function adminSection(title, desc, id) {
    const section = createElement('div', {
        className: 'admin-section',
        attributes: {
            id: 'admin-panel-' + id,
            role: 'tabpanel',
            'data-admin-section': id
        }
    });

    const head = createElement('div', { className: 'admin-section__head' });
    const text = createElement('div', { className: 'admin-section__head-text' });
    text.appendChild(createElement('h2', { className: 'admin-section__title', text: title }));
    if (desc) text.appendChild(createElement('p', { className: 'admin-section__desc', text: desc }));
    head.appendChild(text);
    section.appendChild(head);

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
