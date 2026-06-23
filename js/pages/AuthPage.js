import { createElement } from '../utils/dom.js';
import { signInWithUsername, signUpWithUsername } from '../firebase/authService.js';

export function AuthPage() {
    const section = createElement('section', { className: 'auth-page' });
    const container = createElement('div', { className: 'auth-page__container' });

    const form = buildForm('login');
    container.appendChild(form);
    section.appendChild(container);

    return section;
}

function buildForm(mode) {
    const isLogin = mode === 'login';

    const form = createElement('form', {
        className: 'auth-form',
        events: { submit: (e) => e.preventDefault() }
    });

    const title = createElement('h2', {
        className: 'auth-form__title',
        text: isLogin ? 'Вход' : 'Регистрация'
    });

    const errorEl = createElement('p', { className: 'auth-form__error' });

    const usernameGroup = createField('text', 'username', 'Имя пользователя');
    const passwordGroup = createField('password', 'password', 'Пароль');

    const groups = [usernameGroup, passwordGroup];

    if (!isLogin) {
        const confirmGroup = createField('password', 'confirm', 'Повторите пароль');
        groups.push(confirmGroup);
    }

    const submitBtn = createElement('button', {
        className: 'auth-form__button',
        text: isLogin ? 'Войти' : 'Зарегистрироваться',
        attributes: { type: 'submit' }
    });

    const toggle = createElement('p', { className: 'auth-form__toggle' });
    const toggleLink = createElement('a', {
        className: 'auth-form__toggle-link',
        text: isLogin ? 'Создать аккаунт' : 'Уже есть аккаунт? Войти',
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

    form.addEventListener('submit', async () => {
        errorEl.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.textContent = isLogin ? 'Вход...' : 'Регистрация...';

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

            window.location.hash = '#/';
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = isLogin ? 'Войти' : 'Зарегистрироваться';
        }
    });

    return form;
}

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
