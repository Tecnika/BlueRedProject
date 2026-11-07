import { createElement } from '../utils/dom.js?v=8';
import { signInWithUsername, signUpWithUsername } from '../firebase/authService.js?v=8';
import { translateError } from '../utils/translateError.js?v=8';
import { store } from '../core/Store.js?v=8';
import { Button } from '../components/Button.js?v=8';
import { FormField } from '../components/FormField.js?v=8';
import { StatusMessage, showMessage, hideMessage } from '../components/StatusMessage.js?v=8';

export function AuthPage() {
    const section = createElement('section', { className: 'auth-page' });
    const container = createElement('div', { className: 'auth-page__container' });
    const form = buildForm('login');
    container.appendChild(form);
    section.appendChild(container);
    return section;
}

function fieldValue(form, id) {
    const el = form.querySelector('#' + id);
    return el ? el.value.trim() : '';
}

function buildForm(mode) {
    const isLogin = mode === 'login';
    const form = createElement('form', {
        className: 'auth-form',
        events: { submit: (e) => e.preventDefault() }
    });

    form.appendChild(createElement('h2', {
        className: 'auth-form__title',
        text: isLogin ? 'Запрос доступа' : 'Регистрация в секторе'
    }));

    const usernameField = FormField({ type: 'text', id: 'username', placeholder: 'Позывной' });
    const passwordField = FormField({ type: 'password', id: 'password', placeholder: 'Код доступа' });
    form.appendChild(usernameField);
    form.appendChild(passwordField);

    if (!isLogin) {
        form.appendChild(FormField({ type: 'password', id: 'confirm', placeholder: 'Подтверждение кода' }));

        // --- Профиль игрока (реальные данные) ---
        form.appendChild(createElement('h3', {
            className: 'auth-form__subtitle',
            text: 'Данные игрока'
        }));
        form.appendChild(createElement('p', {
            className: 'auth-form__hint',
            text: 'Реальные данные видны только вам и администрации.'
        }));

        form.appendChild(FormField({ type: 'text', id: 'reg-lastname', label: 'Фамилия', placeholder: 'Реальная фамилия' }));
        form.appendChild(FormField({ type: 'text', id: 'reg-firstname', label: 'Имя', placeholder: 'Реальное имя' }));
        form.appendChild(FormField({ type: 'text', id: 'reg-contact', label: 'Контакт', placeholder: 'Телефон / Telegram' }));

        form.appendChild(createElement('h3', {
            className: 'auth-form__subtitle',
            text: 'Контактное лицо'
        }));
        form.appendChild(FormField({ type: 'text', id: 'reg-emergency-name', label: 'ФИ контактного лица', placeholder: 'Иван Иванов' }));
        form.appendChild(FormField({ type: 'text', id: 'reg-emergency-contact', label: 'Контакт', placeholder: 'Телефон / Telegram' }));
        form.appendChild(FormField({ type: 'text', id: 'reg-emergency-relation', label: 'Кем является', placeholder: 'Родственник, друг…' }));

        form.appendChild(createElement('h3', {
            className: 'auth-form__subtitle',
            text: 'Медицинская информация'
        }));
        form.appendChild(FormField({ type: 'textarea', id: 'reg-allergies', label: 'Аллергии', rows: 2, placeholder: 'На что есть аллергия' }));
        form.appendChild(FormField({ type: 'textarea', id: 'reg-medical', label: 'Медпоказания', rows: 2, placeholder: 'Хронические заболевания, ограничения, препараты' }));
    }

    const errorEl = StatusMessage({ type: 'err', text: '', hidden: true });
    form.appendChild(errorEl);

    const submitBtn = Button({
        text: isLogin ? 'Авторизоваться' : 'Подать заявку',
        variant: 'primary',
        attributes: { type: 'submit' }
    });
    form.appendChild(submitBtn);

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
    form.appendChild(toggle);

    form.addEventListener('submit', async () => {
        hideMessage(errorEl);
        submitBtn.disabled = true;
        submitBtn.textContent = isLogin ? 'Авторизация...' : 'Отправка запроса...';

        try {
            const username = usernameField.querySelector('input').value.trim();
            const password = passwordField.querySelector('input').value;

            if (!username || !password) {
                throw new Error('Заполните все поля');
            }

            if (isLogin) {
                await signInWithUsername(username, password);
            } else {
                const confirm = form.querySelector('#confirm').value;
                if (password !== confirm) {
                    throw new Error('Пароли не совпадают');
                }

                const lastName = fieldValue(form, 'reg-lastname');
                const firstName = fieldValue(form, 'reg-firstname');
                if (!firstName || !lastName) {
                    throw new Error('Укажите реальные имя и фамилию');
                }
                const contact = fieldValue(form, 'reg-contact');
                if (!contact) {
                    throw new Error('Укажите контакт');
                }

                await signUpWithUsername({
                    username,
                    password,
                    player: {
                        firstName,
                        lastName,
                        contact,
                        emergencyName: fieldValue(form, 'reg-emergency-name'),
                        emergencyContact: fieldValue(form, 'reg-emergency-contact'),
                        emergencyRelation: fieldValue(form, 'reg-emergency-relation'),
                        allergies: fieldValue(form, 'reg-allergies'),
                        medical: fieldValue(form, 'reg-medical')
                    }
                });
            }

            if (!store.get('user')) {
                await new Promise(resolve => {
                    const unsub = store.subscribe('user', (user) => {
                        if (user) { unsub(); resolve(); }
                    });
                });
            }

            window.location.hash = '#/';
        } catch (err) {
            showMessage(errorEl, translateError(err), 'err');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = isLogin ? 'Авторизоваться' : 'Подать заявку';
        }
    });

    return form;
}

export { buildForm };
