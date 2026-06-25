/**
 * AuthPage — страница входа и регистрации.
 *
 * Одна форма переключается между режимами "login" и "register".
 * Валидация: поля не пустые, пароли совпадают (при регистрации).
 * После успеха — редирект на главную (#/).
 *
 * buildForm экспортируется для возможного переиспользования.
 */

import { createElement } from '../utils/dom.js?v=3';
import { signInWithUsername, signUpWithUsername } from '../firebase/authService.js?v=3';
import { translateError } from '../utils/translateError.js?v=3';
import { store } from '../core/Store.js?v=3';

export function AuthPage() {
    const section = createElement('section', { className: 'auth-page' });
    const container = createElement('div', { className: 'auth-page__container' });

    const form = buildForm('login');
    container.appendChild(form);
    section.appendChild(container);

    return section;
}

/**
 * Строит форму авторизации.
 * @param {'login'|'register'} mode
 * @returns {HTMLFormElement}
 */
function buildForm(mode) {
    const isLogin = mode === 'login';

    const form = createElement('form', {
        className: 'auth-form',
        events: { submit: (e) => e.preventDefault() }
    });

    const title = createElement('h2', {
        className: 'auth-form__title',
        text: isLogin ? 'Запрос доступа' : 'Регистрация в секторе'
    });

    const errorEl = createElement('p', { className: 'auth-form__error' });

    const usernameGroup = createField('text', 'username', 'Позывной');
    const passwordGroup = createField('password', 'password', 'Код доступа');

    const groups = [usernameGroup, passwordGroup];

    // При регистрации добавляем поле подтверждения пароля
    if (!isLogin) {
            const confirmGroup = createField('password', 'confirm', 'Подтверждение кода');
        groups.push(confirmGroup);
    }

    const submitBtn = createElement('button', {
        className: 'auth-form__button',
        text: isLogin ? 'Авторизоваться' : 'Подать заявку',
        attributes: { type: 'submit' }
    });

    // Переключатель между входом и регистрацией
    const toggle = createElement('p', { className: 'auth-form__toggle' });
    const toggleLink = createElement('a', {
        className: 'auth-form__toggle-link',
        text: isLogin ? 'Запросить допуск' : 'Уже зарегистрированы? Авторизоваться',
        attributes: { href: '#' },
        events: {
            click: (e) => {
                e.preventDefault();
                const parent = form.parentNode;
                const newForm = buildForm(isLogin ? 'register' : 'login');
                parent.replaceChild(newForm, form);
            }
        }
    });
    toggle.appendChild(toggleLink);

    form.appendChild(title);
    for (const g of groups) form.appendChild(g);
    form.appendChild(errorEl);
    form.appendChild(submitBtn);
    form.appendChild(toggle);

    // Обработка отправки формы
    form.addEventListener('submit', async () => {
        errorEl.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.textContent = isLogin ? 'Авторизация...' : 'Отправка запроса...';

        try {
            const username = usernameGroup.querySelector('input').value.trim();
            const password = passwordGroup.querySelector('input').value;

            if (!username || !password) {
                throw new Error('Заполните все поля');
            }

            if (isLogin) {
                await signInWithUsername(username, password);
            } else {
                const confirm = groups[2].querySelector('input').value;

                if (password !== confirm) {
                    throw new Error('Пароли не совпадают');
                }

                await signUpWithUsername(username, password);
            }

            // Ждём, пока onAuthChange запишет пользователя в store,
            // чтобы HomePage отрендерилась уже с user !== null
            if (!store.get('user')) {
                await new Promise(resolve => {
                    const unsub = store.subscribe('user', (user) => {
                        if (user) { unsub(); resolve(); }
                    });
                });
            }

            window.location.hash = '#/';
        } catch (err) {
            errorEl.textContent = translateError(err);
            errorEl.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = isLogin ? 'Авторизоваться' : 'Подать заявку';
        }
    });

    return form;
}

/** Создаёт группу "лейбл + поле ввода" */
function createField(type, id, label) {
    const group = createElement('div', { className: 'auth-form__field' });

    const input = createElement('input', {
        className: 'auth-form__input',
        attributes: { type, id, placeholder: label, autocomplete: type === 'password' ? 'current-password' : 'username' }
    });

    group.appendChild(input);
    return group;
}

export { buildForm };
