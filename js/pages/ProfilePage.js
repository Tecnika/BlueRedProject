import { createElement } from '../utils/dom.js';
import { store } from '../core/Store.js';
import { generateAvatarSVG } from '../core/Avatar.js';
import { getUserProfile, updateUserProfile } from '../firebase/authService.js';
import { getNote, saveNote } from '../firebase/notesService.js';

const FACTION_LABELS = {
    red: 'Красные',
    blue: 'Синие',
    purple: 'Фиолетовые'
};

const ROLE_LABELS = {
    master: 'Мастер',
    igrotech: 'Игротех',
    player: 'Игрок'
};

export async function ProfilePage(targetUid) {
    const currentUser = store.get('user');
    const section = createElement('section', { className: 'profile-page' });

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

    const card = createProfileCard(profile, isOwner);
    container.appendChild(card);

    if (isOwner) {
        const editSection = createEditSection(profile);
        container.appendChild(editSection);
    }

    if (!isOwner && (sameFaction || isAdmin)) {
        const notesSection = await createNotesSection(currentUser.uid, uid);
        container.appendChild(notesSection);
    }

    section.appendChild(container);
    return section;
}

function createProfileCard(profile, isOwner) {
    const card = createElement('div', { className: 'profile-card' });

    const avatarUrl = generateAvatarSVG(profile.username, profile.faction);

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

    if (profile.worldview) {
        info.appendChild(createFieldRow('Мировоззрение', profile.worldview));
    }

    if (isOwner && profile.accessTags && profile.accessTags.length) {
        info.appendChild(createTagRow('Теги доступа', profile.accessTags));
    }

    if (isOwner && profile.hiddenTags && profile.hiddenTags.length) {
        info.appendChild(createTagRow('Скрытые теги', profile.hiddenTags));
    }

    if (profile.about) {
        info.appendChild(createFieldRow('О себе', profile.about));
    }

    card.appendChild(avatar);
    card.appendChild(info);

    return card;
}

function createFieldRow(label, value) {
    const row = createElement('div', { className: 'profile-card__field' });
    const labelEl = createElement('span', { className: 'profile-card__field-label', text: label });
    const valueEl = createElement('span', { className: 'profile-card__field-value', text: value });
    row.appendChild(labelEl);
    row.appendChild(valueEl);
    return row;
}

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

function createEditSection(profile) {
    const section = createElement('div', { className: 'profile-edit' });
    const title = createElement('h3', { className: 'profile-edit__title', text: 'Редактировать профиль' });

    const form = createElement('form', {
        className: 'profile-edit__form',
        events: { submit: (e) => e.preventDefault() }
    });

    const fields = [
        { id: 'faction', label: 'Фракция', type: 'select', value: profile.faction || '',
          options: [
            { value: '', text: 'Не выбрана' },
            { value: 'red', text: 'Красные' },
            { value: 'blue', text: 'Синие' },
            { value: 'purple', text: 'Фиолетовые' }
          ] },
        { id: 'worldview', label: 'Мировоззрение', type: 'text', value: profile.worldview || '' },
        { id: 'about', label: 'О себе', type: 'textarea', value: profile.about || '' }
    ];

    for (const f of fields) {
        const group = createElement('div', { className: 'profile-edit__field' });
        const label = createElement('label', {
            className: 'profile-edit__label',
            text: f.label,
            attributes: { for: f.id }
        });

        let input;
        if (f.type === 'select') {
            input = createElement('select', {
                className: 'profile-edit__input',
                attributes: { id: f.id }
            });
            for (const opt of f.options) {
                const option = createElement('option', {
                    text: opt.text,
                    attributes: { value: opt.value }
                });
                if (opt.value === f.value) option.selected = true;
                input.appendChild(option);
            }
        } else if (f.type === 'textarea') {
            input = createElement('textarea', {
                className: 'profile-edit__input profile-edit__textarea',
                text: f.value,
                attributes: { id: f.id, rows: 3 }
            });
        } else {
            input = createElement('input', {
                className: 'profile-edit__input',
                attributes: { type: 'text', id: f.id, value: f.value }
            });
        }

        group.appendChild(label);
        group.appendChild(input);
        form.appendChild(group);
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
            const data = {
                faction: form.querySelector('#faction').value,
                worldview: form.querySelector('#worldview').value.trim(),
                about: form.querySelector('#about').value.trim()
            };

            await updateUserProfile(profile.uid || store.get('user').uid, data);
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

async function createNotesSection(authorId, targetId) {
    const section = createElement('div', { className: 'profile-notes' });

    const title = createElement('h3', {
        className: 'profile-notes__title',
        text: 'Заметки об игроке'
    });

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
