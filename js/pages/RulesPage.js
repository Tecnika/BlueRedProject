import { createElement } from '../utils/dom.js?v=27';
import { store } from '../core/Store.js?v=27';
import { translateError } from '../utils/translateError.js?v=27';
import { getAllRules, deleteRule } from '../firebase/rulesService.js?v=27';
import { Button } from '../components/Button.js?v=27';
import { Icon } from '../components/Icon.js?v=27';
import { StatusMessage } from '../components/StatusMessage.js?v=27';
import { WikiComments } from '../components/WikiComments.js?v=27';

const TYPE_LABELS = { general: 'Основные', site: 'Правила сайта', hidden: 'Скрытые механики' };
const TYPE_ORDER = ['general', 'site', 'hidden'];

export async function RulesPage() {
    const section = createElement('section', { className: 'rules-page' });
    const user = store.get('user');
    if (!user) {
        section.appendChild(StatusMessage({ type: 'err', text: 'Требуется идентификация' }));
        return section;
    }

    try {
        const allRules = await getAllRules();
        const filtered = allRules.filter(r => {
            if (r.type === 'general') return true;
            if (r.type === 'site') return user.role === 'master' || user.role === 'igrotech';
            if (r.type === 'hidden') return user.role === 'master';
            return false;
        });

        if (filtered.length === 0) {
            section.appendChild(StatusMessage({ type: 'ok', text: 'Правила пока не добавлены' }));
            return section;
        }

        const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
        let activeId = params.get('id') || filtered[0].id;
        let activeRule = filtered.find(r => r.id === activeId);
        if (!activeRule) { activeRule = filtered[0]; activeId = filtered[0].id; }

        const container = createElement('div', { className: 'rules-page__layout' });

        container.appendChild(createSidebar(filtered, activeId, user, (id) => {
            window.location.hash = '#/rules/article?id=' + id;
        }));

        container.appendChild(await createContent(activeRule, user, section));

        section.appendChild(container);
    } catch (err) {
        section.appendChild(StatusMessage({ type: 'err', text: 'Ошибка: ' + translateError(err) }));
    }

    return section;
}

function createSidebar(rules, activeId, user, onNavigate) {
    const sidebar = createElement('aside', { className: 'rules-sidebar' });

    const drawerOverlay = createElement('div', { className: 'rules-sidebar__overlay' });
    const drawer = createElement('div', { className: 'rules-sidebar__drawer' });

    const closeBtn = createElement('button', {
        className: 'rules-sidebar__close',
        attributes: { type: 'button', 'aria-label': 'Закрыть' }
    });
    closeBtn.appendChild(Icon({ name: 'close' }));
    closeBtn.addEventListener('click', closeDrawer);
    drawer.appendChild(closeBtn);

    drawer.appendChild(buildNav(rules, activeId, user, onNavigate));
    drawerOverlay.appendChild(drawer);

    const staticNav = createElement('nav', { className: 'rules-sidebar__nav' });
    staticNav.appendChild(buildNav(rules, activeId, user, onNavigate));
    sidebar.appendChild(staticNav);

    const mobileToggle = Button({
        text: 'Содержание',
        icon: 'menu',
        variant: 'secondary',
        size: 'sm',
        onClick: openDrawer
    });
    mobileToggle.className = 'rules-sidebar__toggle';

    function openDrawer() {
        drawerOverlay.classList.add('rules-sidebar__overlay--open');
        document.body.style.overflow = 'hidden';
    }

    function closeDrawer() {
        drawerOverlay.classList.remove('rules-sidebar__overlay--open');
        document.body.style.overflow = '';
    }

    drawerOverlay.addEventListener('click', (e) => {
        if (e.target === drawerOverlay) closeDrawer();
    });

    sidebar.appendChild(drawerOverlay);
    sidebar.appendChild(mobileToggle);

    return sidebar;
}

function buildNav(rules, activeId, user, onNavigate) {
    const nav = createElement('div', { className: 'rules-sidebar__groups' });
    const grouped = {};
    for (const r of rules) {
        if (!grouped[r.type]) grouped[r.type] = [];
        grouped[r.type].push(r);
    }

    for (const type of TYPE_ORDER) {
        const list = grouped[type];
        if (!list || list.length === 0) continue;

        if (type === 'hidden' && user.role !== 'master') continue;
        if (type === 'site' && user.role !== 'master' && user.role !== 'igrotech') continue;

        const group = createElement('div', { className: 'rules-sidebar__group' });
        group.appendChild(createElement('div', { className: 'rules-sidebar__group-title', text: TYPE_LABELS[type] }));

        for (const rule of list) {
            const item = createElement('a', {
                className: 'rules-sidebar__item' + (rule.id === activeId ? ' rules-sidebar__item--active' : ''),
                text: rule.title,
                attributes: { href: '#/rules/article?id=' + rule.id }
            });
            item.addEventListener('click', (e) => {
                e.preventDefault();
                if (onNavigate) onNavigate(rule.id);
                const overlay = document.querySelector('.rules-sidebar__overlay');
                if (overlay) {
                    overlay.classList.remove('rules-sidebar__overlay--open');
                    document.body.style.overflow = '';
                }
            });
            group.appendChild(item);
        }

        nav.appendChild(group);
    }

    return nav;
}

async function createContent(rule, user, section) {
    const content = createElement('article', { className: 'rules-content wiki-article' });

    const tabs = createElement('div', { className: 'wiki-article__tabs' });
    tabs.appendChild(createElement('span', {
        className: 'wiki-article__tab wiki-article__tab--active',
        text: 'Статья'
    }));
    const talkTab = createElement('button', {
        className: 'wiki-article__tab',
        text: 'Обсуждение',
        attributes: { type: 'button' }
    });
    talkTab.addEventListener('click', () => {
        document.getElementById('wiki-comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    tabs.appendChild(talkTab);
    content.appendChild(tabs);

    const header = createElement('div', { className: 'rules-content__header' });
    header.appendChild(createElement('h1', { className: 'rules-content__title', text: rule.title }));

    if (user.role === 'master') {
        const actions = createElement('div', { className: 'rules-content__actions' });

        actions.appendChild(Button({ text: 'Редактировать', variant: 'secondary', size: 'sm', onClick: () => {
            window.location.hash = '#/rules/edit?id=' + rule.id;
        }}));

        actions.appendChild(Button({ text: 'Удалить', variant: 'danger', size: 'sm', onClick: async () => {
            if (!confirm('Удалить "' + rule.title + '"?')) return;
            try {
                await deleteRule(rule.id);
                window.location.hash = '#/rules';
            } catch (err) {
                alert('Ошибка: ' + translateError(err));
            }
        }}));

        header.appendChild(actions);
    }

    content.appendChild(header);

    const updated = rule.updatedAt || rule.createdAt;
    const updatedText = updated && !Number.isNaN(new Date(updated).getTime())
        ? new Date(updated).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '—';
    content.appendChild(createElement('div', {
        className: 'wiki-article__meta-line',
        text: `Материал из BlueRed · последняя правка: ${updatedText}`
    }));

    const body = createElement('div', { className: 'rules-content__body' });
    const lines = rule.content.split('\n');
    for (const line of lines) {
        if (line.trim() === '') {
            body.appendChild(createElement('br'));
        } else {
            body.appendChild(createElement('p', { className: 'rules-content__line', text: line }));
        }
    }
    content.appendChild(body);

    content.appendChild(await WikiComments({
        targetType: 'rule',
        targetId: rule.id,
        rulesWiki: true
    }));

    return content;
}
