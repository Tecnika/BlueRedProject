import { createElement } from '../utils/dom.js?v=14';
import { store } from '../core/Store.js?v=14';
import { Button } from '../components/Button.js?v=14';
import { Icon } from '../components/Icon.js?v=14';

const LORE_ITEMS = [
    { icon: 'diversity_3', title: 'Три расы', text: 'Красные, Синие и Фиолетовые ведут бесконечную информационную войну в секторе BlueRed. Каждая фракция имеет свою идеологию, язык и цели.' },
    { icon: 'rocket_launch', title: 'Дрейфующий шаттл', text: 'Станция «BlueRed» — последний оплот цивилизации на границе известного сектора. Здесь пересекаются пути разведчиков, дипломатов и шпионов.' },
    { icon: 'bolt', title: 'Война данных', text: 'Файлы, шифры, оперативные досье — информация — главное оружие. Доступ к данным определяет исход противостояния.' }
];

const MODULES = [
    { icon: 'gavel', title: 'Правила', desc: 'Свод законов сектора', href: '#/rules' },
    { icon: 'menu_book', title: 'Эфир', desc: 'Досье и сводки', href: '#/pages' },
    { icon: 'description', title: 'Файлы', desc: 'Секретные файлы', href: '#/documents' },
    { icon: 'groups', title: 'Фракции', desc: 'Личный состав', href: '#/faction' },
    { icon: 'assignment', title: 'Досье', desc: 'Личное дело', href: '#/profile' }
];

export function HomePage() {
    const main = createElement('main', { className: 'main' });
    const user = store.get('user');

    main.appendChild(renderHero(user));
    main.appendChild(renderLore());
    main.appendChild(renderModules(user));

    return main;
}

function renderHero(user) {
    const section = createElement('section', { className: 'hero' });

    const badge = createElement('div', { className: 'hero__badge', text: 'СЕКТОР BLUERED' });
    section.appendChild(badge);

    const greeting = user ? (user.player?.firstName || user.firstName || user.username) : 'агент';
    const title = createElement('h1', { className: 'hero__title', html: `Добро пожаловать, <span class="hero__title-name">${greeting}</span>` });
    section.appendChild(title);

    const roleText = user
        ? 'Ваш профиль активирован. Доступ к ресурсам сектора открыт.'
        : 'Авторизуйтесь для получения доступа к эфирам сектора BlueRed.';
    section.appendChild(createElement('p', { className: 'hero__text', text: roleText }));

    const cta = createElement('div', { className: 'hero__cta' });
    if (user) {
        cta.appendChild(Button({ text: 'Моё досье', variant: 'primary', href: '#/profile' }));
        cta.appendChild(Button({ text: 'Файлы', variant: 'secondary', href: '#/documents' }));
    } else {
        cta.appendChild(Button({ text: 'Войти в систему', variant: 'primary', href: '#/auth' }));
        cta.appendChild(Button({ text: 'Изучить правила', variant: 'secondary', href: '#/rules' }));
    }
    section.appendChild(cta);

    return section;
}

function renderLore() {
    const section = createElement('section', { className: 'lore' });
    const container = createElement('div', { className: 'lore__container' });

    container.appendChild(createElement('h2', { className: 'lore__title', text: 'Вселенная BlueRed' }));

    const cards = createElement('div', { className: 'lore__cards' });
    for (const item of LORE_ITEMS) {
        const card = createElement('article', { className: 'lore-card' });
        const loreIcon = createElement('div', { className: 'lore-card__icon' });
        loreIcon.appendChild(Icon({ name: item.icon, size: 'sm' }));
        card.appendChild(loreIcon);
        card.appendChild(createElement('h3', { className: 'lore-card__title', text: item.title }));
        card.appendChild(createElement('p', { className: 'lore-card__text', text: item.text }));
        cards.appendChild(card);
    }
    container.appendChild(cards);
    section.appendChild(container);

    return section;
}

function renderModules(user) {
    const section = createElement('section', { className: 'modules' });
    const container = createElement('div', { className: 'modules__container' });

    container.appendChild(createElement('h2', { className: 'modules__title', text: 'Модули системы' }));

    const grid = createElement('div', { className: 'modules__grid' });

    const modules = [...MODULES];
    if (user && user.role === 'master') {
        modules.push({ icon: 'settings', title: 'Мастерская', desc: 'Панель управления', href: '#/admin' });
    }

    for (const mod of modules) {
        const card = createElement('a', {
            className: 'modules__card',
            attributes: { href: mod.href }
        });
        const modIcon = createElement('div', { className: 'modules__card-icon' });
        modIcon.appendChild(Icon({ name: mod.icon, size: 'sm' }));
        card.appendChild(modIcon);
        card.appendChild(createElement('h3', { className: 'modules__card-title', text: mod.title }));
        card.appendChild(createElement('p', { className: 'modules__card-desc', text: mod.desc }));
        grid.appendChild(card);
    }
    container.appendChild(grid);
    section.appendChild(container);

    return section;
}
