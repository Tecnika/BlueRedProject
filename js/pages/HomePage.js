/**
 * HomePage — главная страница.
 *
 * Содержит hero-блок с приветствием и сетку карточек-возможностей.
 * Не требует авторизации.
 */

import { createElement } from '../utils/dom.js?v=2';

export function HomePage() {
    const main = createElement('main', { className: 'main' });

    const hero = createHero();
    const features = createFeatures();

    main.appendChild(hero);
    main.appendChild(features);

    return main;
}

/** Герой-секция с заголовком и подзаголовком */
function createHero() {
    const section = createElement('section', { className: 'hero' });

    const title = createElement('h1', {
        className: 'hero__title',
        text: 'Добро пожаловать на BlueRed'
    });

    const text = createElement('p', {
        className: 'hero__text',
        text: 'Информационный портал с системой управления доступом'
    });

    section.appendChild(title);
    section.appendChild(text);

    return section;
}

/** Сетка карточек с описанием возможностей */
function createFeatures() {
    const section = createElement('section', { className: 'features' });

    const title = createElement('h2', {
        className: 'features__title',
        text: 'Возможности'
    });

    const grid = createElement('div', { className: 'features__grid' });

    const cards = [
        { title: 'Управление доступом', text: 'Гибкая система прав для разных пользователей' },
        { title: 'Редактор страниц', text: 'Создавайте и редактируйте страницы в удобном редакторе' },
        { title: 'База знаний', text: 'Структурированное хранение информации' }
    ];

    for (const card of cards) {
        grid.appendChild(createFeatureCard(card.title, card.text));
    }

    section.appendChild(title);
    section.appendChild(grid);

    return section;
}

/** Одна карточка-возможность */
function createFeatureCard(title, text) {
    const card = createElement('article', { className: 'feature-card' });

    const cardTitle = createElement('h3', {
        className: 'feature-card__title',
        text: title
    });

    const cardText = createElement('p', {
        className: 'feature-card__text',
        text: text
    });

    card.appendChild(cardTitle);
    card.appendChild(cardText);

    return card;
}
