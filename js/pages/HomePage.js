import { createElement } from '../utils/dom.js?v=3';
import { store } from '../core/Store.js?v=3';

export function HomePage() {
    const main = createElement('main', { className: 'main' });
    const user = store.get('user');

    main.appendChild(createHero(user));
    main.appendChild(createLoreSection(user));
    main.appendChild(createModulesSection(user));

    return main;
}

function createHero(user) {
    const section = createElement('section', { className: 'hero' });

    const badge = createElement('div', { className: 'hero__badge', text: 'СЕКТОР BLUERED' });

    const title = createElement('h1', {
        className: 'hero__title',
        html: user
            ? getGreeting(user)
            : 'Добро пожаловать в <span class="hero__title-b">Сектор</span> <span class="hero__title-r">BlueRed</span>'
    });

    const text = createElement('p', {
        className: 'hero__text',
        text: user
            ? getRoleDescription(user)
            : 'Информационный портал с системой грифованного доступа'
    });

    const cta = createElement('div', { className: 'hero__cta' });

    if (!user) {
        const loginBtn = createElement('a', {
            className: 'hero__btn hero__btn--primary',
            text: 'Войти в систему',
            attributes: { href: '#/login' }
        });
        loginBtn.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = '#/login'; });
        cta.appendChild(loginBtn);

        const infoBtn = createElement('a', {
            className: 'hero__btn hero__btn--secondary',
            text: 'Изучить правила',
            attributes: { href: '#/rules' }
        });
        infoBtn.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = '#/rules'; });
        cta.appendChild(infoBtn);
    } else {
        const profileBtn = createElement('a', {
            className: 'hero__btn hero__btn--primary',
            text: 'Моё досье',
            attributes: { href: '#/profile' }
        });
        profileBtn.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = '#/profile'; });
        cta.appendChild(profileBtn);

        const docsBtn = createElement('a', {
            className: 'hero__btn hero__btn--secondary',
            text: 'Документы',
            attributes: { href: '#/documents' }
        });
        docsBtn.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = '#/documents'; });
        cta.appendChild(docsBtn);
    }

    section.appendChild(badge);
    section.appendChild(title);
    section.appendChild(text);
    section.appendChild(cta);

    return section;
}

function getGreeting(user) {
    const factionLabel = getFactionLabel(user.faction);
    const name = user.username || 'агент';
    if (user.role === 'master') return `Приветствую, <span class="hero__title-accent">Мастер</span> ${name}`;
    if (user.role === 'igrotech') return `На связи, <span class="hero__title-accent">игротехник</span> ${name}`;
    return `Привет, <span class="hero__title-accent">${factionLabel}</span> ${name}`;
}

function getRoleDescription(user) {
    const parts = [];
    if (user.faction === 'red') parts.push('Красная фракция — экспансия, наступление, активная разведка.');
    if (user.faction === 'blue') parts.push('Синяя фракция — оборона, аналитика, контрразведка.');
    if (user.faction === 'purple') parts.push('Фиолетовая фракция — гарант переговоров, нейтралитет.');
    if (user.role === 'igrotech') parts.push('Игротехник — помощник мастеров с расширенным доступом.');
    if (user.role === 'master') parts.push('Мастер — полный доступ ко всем системам сектора.');
    if (parts.length === 0) parts.push('Система грифованного доступа');
    return parts.join(' ');
}

function getFactionLabel(faction) {
    const labels = { red: 'Красный', blue: 'Синий', purple: 'Фиолетовый' };
    return labels[faction] || 'Агент';
}

function createLoreSection(user) {
    const section = createElement('section', { className: 'lore' });
    const container = createElement('div', { className: 'lore__container' });

    const title = createElement('h2', { className: 'lore__title', text: 'Вселенная BlueRed' });

    const cards = createElement('div', { className: 'lore__cards' });

    const loreItems = [
        {
            icon: '◆',
            title: 'Три расы',
            text: 'Красные, Синие и Фиолетовые — три человекоподобные расы в глубоком космосе. Красные и Синие находятся в состоянии информационного конфликта. Фиолетовые выступают гарантом переговоров.'
        },
        {
            icon: '◈',
            title: 'Дрейфующий шатл',
            text: 'Переговоры проходят на территории фиолетовых — дрейфующем в космосе шатле. Это нейтральная зона, где пересекаются интересы всех фракций.'
        },
        {
            icon: '◇',
            title: 'Информационная война',
            text: 'Пропаганда — ключевой инструмент фракций. Документы шифруются, информация искажается. Только подготовленный агент способен отличить правду от вымысла.'
        }
    ];

    for (const item of loreItems) {
        cards.appendChild(createLoreCard(item));
    }

    container.appendChild(title);
    container.appendChild(cards);
    section.appendChild(container);

    return section;
}

function createLoreCard(item) {
    const card = createElement('article', { className: 'lore-card' });
    card.appendChild(createElement('div', { className: 'lore-card__icon', text: item.icon }));
    card.appendChild(createElement('h3', { className: 'lore-card__title', text: item.title }));
    card.appendChild(createElement('p', { className: 'lore-card__text', text: item.text }));
    return card;
}

function createModulesSection(user) {
    const section = createElement('section', { className: 'modules' });
    const container = createElement('div', { className: 'modules__container' });

    const title = createElement('h2', { className: 'modules__title', text: 'Модули системы' });
    container.appendChild(title);

    const grid = createElement('div', { className: 'modules__grid' });

    const showFaction = user && user.faction;
    const showAdmin = user && (user.role === 'master' || user.role === 'igrotech');

    const modules = [
        {
            icon: '📜',
            title: 'Правила',
            desc: 'Основные механики игры, правила сайта и скрытые механики.',
            link: '#/rules',
            show: true
        },
        {
            icon: '📁',
            title: 'Архив страниц',
            desc: 'Матрица 3×3 с доступом по тегам. Общая информация и фракционный контент.',
            link: '#/pages',
            show: true
        },
        {
            icon: '🔐',
            title: 'Документы',
            desc: 'Зашифрованные записи с системой доступа. QR-коды, грифы, шифрование.',
            link: '#/documents',
            show: true
        },
        {
            icon: '🏛️',
            title: 'Фракция',
            desc: showFaction ? 'Информация о твоей фракции и её агентах.' : 'Информация о фракциях сектора.',
            link: '#/faction',
            show: true
        },
        {
            icon: '🪪',
            title: 'Досье',
            desc: 'Личный профиль, заметки, доступ к документам.',
            link: '#/profile',
            show: true
        },
        {
            icon: '⚙️',
            title: 'Администрирование',
            desc: 'Управление тегами, деревом страниц, глобальными настройками.',
            link: '#/admin',
            show: showAdmin
        }
    ];

    for (const mod of modules) {
        if (!mod.show) continue;
        const card = createElement('a', {
            className: 'modules__card',
            attributes: { href: mod.link }
        });
        card.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = mod.link; });
        card.appendChild(createElement('div', { className: 'modules__card-icon', text: mod.icon }));
        card.appendChild(createElement('h3', { className: 'modules__card-title', text: mod.title }));
        card.appendChild(createElement('p', { className: 'modules__card-desc', text: mod.desc }));
        grid.appendChild(card);
    }

    container.appendChild(grid);
    section.appendChild(container);

    return section;
}
