/**
 * ProfilePage — страница профиля игрока.
 *
 * Уровни доступа:
 *   - Владелец профиля: видит всё, может редактировать "О себе"
 *   - Мастер (role === 'master'): видит теги, управляет фракцией/тегами/мировоззрением
 *   - Своя фракция: видит профиль + может писать заметки
 *   - Остальные: видят только базовую информацию
 *
 * URL: #/profile?uid=xxx — профиль конкретного игрока
 *      #/profile          — свой профиль
 */

import { createElement } from '../utils/dom.js';
import { store } from '../core/Store.js';
import { getAvatarUrl } from '../core/Avatar.js';
import { getUserProfile, updateUserProfile } from '../firebase/authService.js';
import { getNote, saveNote } from '../firebase/notesService.js';
import { TagInput } from '../components/TagInput.js';

/** Человеческие названия фракций */
const FACTION_LABELS = {
    red: 'Красные',
    blue: 'Синие',
    purple: 'Фиолетовые'
};

/** Человеческие названия ролей */
const ROLE_LABELS = {
    master: 'Мастер',
    igrotech: 'Игротех',
    player: 'Игрок'
};

export async function ProfilePage(targetUid, themeManager) {
    const section = createElement('section', { className: 'profile-page' });

    try {
        const currentUser = store.get('user');

        if (!currentUser) {
            section.appendChild(createElement('p', {
                className: 'profile-page__error',
                text: 'Необходимо авторизоваться'
            }));
            return section;
        }

        const uid = targetUid || currentUser.uid;
        const profile = await getUserProfile(uid);

        if (!profile) {
            section.appendChild(createElement('p', {
                className: 'profile-page__error',
                text: 'Пользователь не найден'
            }));
            return section;
        }

        const isOwner = uid === currentUser.uid;
        const isAdmin = currentUser.role === 'master';
        const sameFaction = currentUser.faction && profile.faction && currentUser.faction === profile.faction;

        const container = createElement('div', { className: 'profile-page__container' });

        // Карточка профиля (видна всем)
        container.appendChild(createProfileCard(profile, isOwner, isAdmin));

        // Владелец может редактировать "О себе"
        if (isOwner) {
            container.appendChild(createEditSection(profile));
        }

        // Мастер видит панель управления игроком
        if (isAdmin) {
            container.appendChild(await createAdminSection(profile, uid, themeManager));
        }

        // Заметки видны софракционцам и мастеру
        if (!isOwner && (sameFaction || isAdmin)) {
            container.appendChild(await createNotesSection(currentUser.uid, uid));
        }

        section.appendChild(container);
    } catch (err) {
        section.appendChild(createElement('p', {
            className: 'profile-page__error',
            text: 'Ошибка: ' + err.message
        }));
    }

    return section;
}

/** Собирает карточку с аватаром, именем, ролью, фракцией, тегами */
function createProfileCard(profile, isOwner, isAdmin) {
    const card = createElement('div', { className: 'profile-card' });

    const avatarUrl = getAvatarUrl(profile.username, profile.faction);

    const avatar = createElement('img', {
        className: 'profile-card__avatar',
        attributes: { src: avatarUrl, alt: profile.username }
    });

    const info = createElement('div', { className: 'profile-card__info' });

    const name = createElement('h2', {
        className: 'profile-card__name',
        text: profile.username
    });

    const roleLabel = ROLE_LABELS[profile.role] || profile.role;
    const factionLabel = FACTION_LABELS[profile.faction] || profile.faction || 'Не выбрана';

    const meta = createElement('div', { className: 'profile-card__meta' });
    const roleEl = createElement('span', {
        className: 'profile-card__role',
        text: roleLabel
    });
    const factionEl = createElement('span', {
        className: `profile-card__faction profile-card__faction--${profile.faction || 'none'}`,
        text: factionLabel
    });
    meta.appendChild(roleEl);
    meta.appendChild(factionEl);

    info.appendChild(name);
    info.appendChild(meta);

    info.appendChild(createFieldRow('Мировоззрение', profile.worldview || '—'));

    // Теги доступа видны владельцу и мастеру
    if ((isOwner || isAdmin) && profile.accessTags && profile.accessTags.length) {
        info.appendChild(createTagRow('Теги доступа', profile.accessTags));
    }

    // Скрытые теги видны только владельцу и мастеру
    if ((isOwner || isAdmin) && profile.hiddenTags && profile.hiddenTags.length) {
        info.appendChild(createTagRow('Скрытые теги', profile.hiddenTags));
    }

    info.appendChild(createFieldRow('О себе', profile.about || '—'));

    card.appendChild(avatar);
    card.appendChild(info);

    return card;
}

/** Строка "метка: значение" */
function createFieldRow(label, value) {
    const row = createElement('div', { className: 'profile-card__field' });
    const labelEl = createElement('span', { className: 'profile-card__field-label', text: label });
    const valueEl = createElement('span', { className: 'profile-card__field-value', text: value });
    row.appendChild(labelEl);
    row.appendChild(valueEl);
    return row;
}

/** Строка с тегами */
function createTagRow(label, tags) {
    const row = createElement('div', { className: 'profile-card__field' });
    const labelEl = createElement('span', { className: 'profile-card__field-label', text: label });
    const tagList = createElement('div', { className: 'profile-card__tags' });
    for (const tag of tags) {
        tagList.appendChild(createElement('span', { className: 'profile-card__tag', text: tag }));
    }
    row.appendChild(labelEl);
    row.appendChild(tagList);
    return row;
}

/** Секция редактирования профиля (для владельца) */
function createEditSection(profile) {
    const section = createElement('div', { className: 'profile-edit' });
    const title = createElement('h3', { className: 'profile-edit__title', text: 'Редактировать профиль' });

    const form = createElement('form', {
        className: 'profile-edit__form',
        events: { submit: (e) => e.preventDefault() }
    });

    const aboutGroup = createEditField('textarea', 'about', 'О себе', profile.about || '');
    form.appendChild(aboutGroup);

    const saveBtn = createElement('button', {
        className: 'profile-edit__save',
        text: 'Сохранить',
        attributes: { type: 'submit' }
    });

    const msg = createElement('p', { className: 'profile-edit__msg' });

    form.appendChild(saveBtn);
    form.appendChild(msg);

    form.addEventListener('submit', async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Сохранение...';
        msg.style.display = 'none';

        try {
            const data = {
                about: form.querySelector('#about').value.trim()
            };

            await updateUserProfile(store.get('user').uid, data);
            store.set('user', { ...store.get('user'), ...data });
            msg.textContent = 'Сохранено';
            msg.style.display = 'block';
        } catch (err) {
            msg.textContent = 'Ошибка: ' + err.message;
            msg.style.display = 'block';
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Сохранить';
        }
    });

    section.appendChild(title);
    section.appendChild(form);

    return section;
}

/** Поле редактирования (input или textarea) */
function createEditField(type, id, label, value) {
    const group = createElement('div', { className: 'profile-edit__field' });
    const labelEl = createElement('label', {
        className: 'profile-edit__label',
        text: label,
        attributes: { for: id }
    });

    let input;
    if (type === 'textarea') {
        input = createElement('textarea', {
            className: 'profile-edit__input profile-edit__textarea',
            text: value,
            attributes: { id, rows: 3 }
        });
    } else {
        input = createElement('input', {
            className: 'profile-edit__input',
            attributes: { type: 'text', id, value }
        });
    }

    group.appendChild(labelEl);
    group.appendChild(input);
    return group;
}

/** Админ-панель: фракция, мировоззрение, теги (только для master) */
async function createAdminSection(profile, targetUid, themeManager) {
    const section = createElement('div', { className: 'profile-edit' });
    const title = createElement('h3', {
        className: 'profile-edit__title',
        text: 'Управление игроком (Мастер)'
    });

    const form = createElement('form', {
        className: 'profile-edit__form',
        events: { submit: (e) => e.preventDefault() }
    });

    const factionGroup = createAdminSelect('admin-faction', 'Фракция', profile.faction || '', [
        { value: '', text: 'Не выбрана' },
        { value: 'red', text: 'Красные' },
        { value: 'blue', text: 'Синие' },
        { value: 'purple', text: 'Фиолетовые' }
    ]);
    form.appendChild(factionGroup);

    form.appendChild(createAdminInput('admin-worldview', 'Мировоззрение', profile.worldview || ''));

    // Теги доступа — автокомплит из каталога (с fallback на текстовый ввод)
    const currentAccess = [...(profile.accessTags || [])];
    const currentHidden = [...(profile.hiddenTags || [])];

    try {
        const accessLabel = createElement('label', {
            className: 'profile-edit__label',
            text: 'Теги доступа'
        });
        form.appendChild(accessLabel);
        const accessTagInput = await TagInput({
            initialTags: currentAccess,
            onChange: (tags) => { currentAccess.length = 0; currentAccess.push(...tags); },
            placeholder: 'Добавить тег доступа...'
        });
        form.appendChild(accessTagInput);
    } catch (e) {
        form.appendChild(createAdminInput('admin-tags', 'Теги доступа (через запятую)', currentAccess.join(', ')));
    }

    try {
        const hiddenLabel = createElement('label', {
            className: 'profile-edit__label',
            text: 'Скрытые теги'
        });
        form.appendChild(hiddenLabel);
        const hiddenTagInput = await TagInput({
            initialTags: currentHidden,
            onChange: (tags) => { currentHidden.length = 0; currentHidden.push(...tags); },
            placeholder: 'Добавить скрытый тег...'
        });
        form.appendChild(hiddenTagInput);
    } catch (e) {
        form.appendChild(createAdminInput('admin-hidden', 'Скрытые теги (через запятую)', currentHidden.join(', ')));
    }

    const saveBtn = createElement('button', {
        className: 'profile-edit__save',
        text: 'Сохранить',
        attributes: { type: 'submit' }
    });

    const msg = createElement('p', { className: 'profile-edit__msg' });

    form.appendChild(saveBtn);
    form.appendChild(msg);

    form.addEventListener('submit', async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Сохранение...';
        msg.style.display = 'none';

        try {
            // Если есть fallback-поля — читаем из них
            const fallbackAccess = form.querySelector('#admin-tags');
            const fallbackHidden = form.querySelector('#admin-hidden');
            if (fallbackAccess) {
                const raw = fallbackAccess.value;
                currentAccess.length = 0;
                currentAccess.push(...(raw ? raw.split(',').map(t => t.trim()).filter(Boolean) : []));
            }
            if (fallbackHidden) {
                const raw = fallbackHidden.value;
                currentHidden.length = 0;
                currentHidden.push(...(raw ? raw.split(',').map(t => t.trim()).filter(Boolean) : []));
            }

            const data = {
                faction: form.querySelector('#admin-faction').value,
                worldview: form.querySelector('#admin-worldview').value.trim(),
                accessTags: [...currentAccess],
                hiddenTags: [...currentHidden]
            };

            await updateUserProfile(targetUid, data);

            // Если админ редактирует сам себя — обновляем store и тему
            const currentUser = store.get('user');
            if (currentUser && targetUid === currentUser.uid) {
                store.set('user', { ...currentUser, ...data });
                if (themeManager && data.faction) {
                    themeManager.setThemeByFaction(data.faction);
                }
            }

            msg.textContent = 'Сохранено';
            msg.style.display = 'block';
        } catch (err) {
            msg.textContent = 'Ошибка: ' + err.message;
            msg.style.display = 'block';
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Сохранить';
        }
    });

    section.appendChild(title);
    section.appendChild(form);

    return section;
}

/** Выпадающий список для админ-панели */
function createAdminSelect(id, label, value, options) {
    const group = createElement('div', { className: 'profile-edit__field' });
    const labelEl = createElement('label', {
        className: 'profile-edit__label',
        text: label,
        attributes: { for: id }
    });
    const select = createElement('select', { className: 'profile-edit__input', attributes: { id } });
    for (const opt of options) {
        const option = createElement('option', {
            text: opt.text,
            attributes: { value: opt.value }
        });
        if (opt.value === value) option.selected = true;
        select.appendChild(option);
    }
    group.appendChild(labelEl);
    group.appendChild(select);
    return group;
}

/** Текстовое поле для админ-панели */
function createAdminInput(id, label, value) {
    const group = createElement('div', { className: 'profile-edit__field' });
    const labelEl = createElement('label', {
        className: 'profile-edit__label',
        text: label,
        attributes: { for: id }
    });
    const input = createElement('input', {
        className: 'profile-edit__input',
        attributes: { type: 'text', id, value }
    });
    group.appendChild(labelEl);
    group.appendChild(input);
    return group;
}

/** Секция заметок об игроке (для софракционцев и мастера) */
async function createNotesSection(authorId, targetId) {
    const section = createElement('div', { className: 'profile-notes' });

    const title = createElement('h3', {
        className: 'profile-notes__title',
        text: 'Заметки об игроке'
    });

    // Загружаем существующую заметку, если есть
    const existing = await getNote(authorId, targetId);

    const textarea = createElement('textarea', {
        className: 'profile-notes__textarea',
        text: existing ? existing.content : '',
        attributes: { rows: 4, placeholder: 'Ваши заметки об этом игроке...' }
    });

    const saveBtn = createElement('button', {
        className: 'profile-notes__save',
        text: 'Сохранить заметку',
        attributes: { type: 'button' }
    });

    const msg = createElement('p', { className: 'profile-notes__msg' });

    saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Сохранение...';
        msg.style.display = 'none';

        try {
            await saveNote(authorId, targetId, textarea.value);
            msg.textContent = 'Заметка сохранена';
            msg.style.display = 'block';
        } catch (err) {
            msg.textContent = 'Ошибка: ' + err.message;
            msg.style.display = 'block';
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Сохранить заметку';
        }
    });

    section.appendChild(title);
    section.appendChild(textarea);
    section.appendChild(saveBtn);
    section.appendChild(msg);

    return section;
}
