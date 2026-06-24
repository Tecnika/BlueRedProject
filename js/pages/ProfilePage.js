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

import { createElement } from '../utils/dom.js?v=3';
import { store } from '../core/Store.js?v=3';
import { createAvatar } from '../core/Avatar.js?v=3';
import { getUserProfile, updateUserProfile } from '../firebase/authService.js?v=3';
import { getNote, saveNote } from '../firebase/notesService.js?v=3';
import { TagInput } from '../components/TagInput.js?v=3';
import { searchTags } from '../firebase/tagsService.js?v=3';
import { translateError } from '../utils/translateError.js?v=3';

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
                text: 'Требуется идентификация'
            }));
            return section;
        }

        const uid = targetUid || currentUser.uid;
        const profile = await getUserProfile(uid);

        if (!profile) {
            section.appendChild(createElement('p', {
                className: 'profile-page__error',
                text: 'Агент не найден в базе'
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
            text: 'Ошибка: ' + translateError(err)
        }));
    }

    return section;
}

/** Собирает карточку с аватаром, именем, ролью, фракцией, тегами */
function createProfileCard(profile, isOwner, isAdmin) {
    const card = createElement('div', { className: 'profile-card' });

    const avatar = createAvatar(profile.username, profile.faction, 'profile-card__avatar');

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
        info.appendChild(createTagRow('Грифы доступа', profile.accessTags));
    }

    // Скрытые теги видны только владельцу и мастеру
    if ((isOwner || isAdmin) && profile.hiddenTags && profile.hiddenTags.length) {
        info.appendChild(createTagRow('Секретные грифы', profile.hiddenTags));
    }

    info.appendChild(createFieldRow('Личное дело', profile.about || '—'));

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
    const title = createElement('h3', { className: 'profile-edit__title', text: 'Редактировать досье' });

    const form = createElement('form', {
        className: 'profile-edit__form',
        events: { submit: (e) => e.preventDefault() }
    });

    const aboutGroup = createEditField('textarea', 'about', 'Личное дело', profile.about || '');
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
        saveBtn.textContent = 'Запись...';
        msg.style.display = 'none';

        try {
            const data = {
                about: form.querySelector('#about').value.trim()
            };

            await updateUserProfile(store.get('user').uid, data);
            store.set('user', { ...store.get('user'), ...data });
            msg.textContent = 'Данные записаны';
            msg.style.display = 'block';
        } catch (err) {
            msg.textContent = 'Ошибка: ' + translateError(err);
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
        text: 'Панель управления (Мастер)'
    });

    const form = createElement('form', {
        className: 'profile-edit__form',
        events: { submit: (e) => e.preventDefault() }
    });

    const factionGroup = createAdminSelect('admin-faction', 'Фракция', profile.faction || '', [
        { value: '', text: 'Не назначена' },
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
            text: 'Грифы доступа'
        });
        form.appendChild(accessLabel);
        const accessTagInput = await TagInput({
            initialTags: currentAccess,
            onChange: (tags) => { currentAccess.length = 0; currentAccess.push(...tags); },
            placeholder: 'Добавить гриф...'
        });
        form.appendChild(accessTagInput);
    } catch (e) {
        form.appendChild(createAdminInput('admin-tags', 'Грифы доступа (через запятую)', currentAccess.join(', ')));
    }

    try {
        const hiddenLabel = createElement('label', {
            className: 'profile-edit__label',
            text: 'Секретные грифы'
        });
        form.appendChild(hiddenLabel);
        const hiddenTagInput = await TagInput({
            initialTags: currentHidden,
            onChange: (tags) => { currentHidden.length = 0; currentHidden.push(...tags); },
            placeholder: 'Добавить секретный гриф...'
        });
        form.appendChild(hiddenTagInput);
    } catch (e) {
        form.appendChild(createAdminInput('admin-hidden', 'Секретные грифы (через запятую)', currentHidden.join(', ')));
    }

    // Субтеги фракционных страниц (только мастера)
    const currentFactionTags = [...(profile.factionAccessTags || [])];
    const subLabel = createElement('label', { className: 'profile-edit__label', text: 'Доступ к ячейкам' });
    form.appendChild(subLabel);

    const subChips = createElement('div', { className: 'tag-input__chips', id: 'admin-faction-tags-chips' });
    form.appendChild(subChips);

    function renderSubChips() {
        subChips.innerHTML = '';
        for (const tag of currentFactionTags) {
            const chip = createElement('span', { className: 'tag-input__chip', text: tag });
            const removeBtn = createElement('button', {
                className: 'tag-input__chip-remove', text: '✕',
                attributes: { type: 'button' },
                events: { click: () => { currentFactionTags.splice(currentFactionTags.indexOf(tag), 1); renderSubChips(); } }
            });
            chip.appendChild(removeBtn);
            subChips.appendChild(chip);
        }
    }
    renderSubChips();

    // Строитель субтега: тег + фракция + уровень
    const builder = createElement('div', { className: 'profile-edit__subtag-builder' });

    const inputWrap = createElement('div', { className: 'profile-edit__subtag-input-wrap' });
    const baseInput = createElement('input', {
        className: 'profile-edit__input',
        attributes: { type: 'text', id: 'subtag-base', placeholder: 'Гриф (техник)', autocomplete: 'off' }
    });
    inputWrap.appendChild(baseInput);
    const suggestions = createElement('ul', { className: 'tag-input__dropdown' });
    inputWrap.appendChild(suggestions);
    builder.appendChild(inputWrap);

    baseInput.addEventListener('input', () => {
        const q = baseInput.value.trim();
        if (!q) { suggestions.innerHTML = ''; return; }
        searchTags(q).then(results => {
            suggestions.innerHTML = '';
            for (const t of results) {
                const li = createElement('li', {
                    className: 'tag-input__option',
                    text: t.name,
                    events: { click: () => { baseInput.value = t.name; suggestions.innerHTML = ''; } }
                });
                suggestions.appendChild(li);
            }
        }).catch(() => { suggestions.innerHTML = ''; });
    });

    let selFaction = '';
    let selLevel = '';

    const FACTION_MAP = { к: 'Красные', с: 'Синие', ф: 'Фиолетовые' };
    const LEVEL_MAP = { '0': 'Инфо', '1': 'Пропаганда', '2': 'Жёсткая' };

    const fGroup = createElement('div', { className: 'profile-edit__subtag-group' });
    for (const [k, label] of Object.entries(FACTION_MAP)) {
        const btn = createElement('button', {
            className: 'profile-edit__subtag-btn', text: label,
            attributes: { type: 'button', 'data-value': k },
            events: { click: () => { selFaction = k; fGroup.querySelectorAll('.profile-edit__subtag-btn').forEach(b => b.classList.toggle('active', b.dataset.value === k)); } }
        });
        fGroup.appendChild(btn);
    }
    builder.appendChild(fGroup);

    const lGroup = createElement('div', { className: 'profile-edit__subtag-group' });
    for (const [k, label] of Object.entries(LEVEL_MAP)) {
        const btn = createElement('button', {
            className: 'profile-edit__subtag-btn', text: label,
            attributes: { type: 'button', 'data-value': k },
            events: { click: () => { selLevel = k; lGroup.querySelectorAll('.profile-edit__subtag-btn').forEach(b => b.classList.toggle('active', b.dataset.value === k)); } }
        });
        lGroup.appendChild(btn);
    }
    builder.appendChild(lGroup);

    const addBtn = createElement('button', {
        className: 'profile-edit__subtag-add', text: '+',
        attributes: { type: 'button', title: 'Добавить субтег' },
        events: {
            click: () => {
                const base = baseInput.value.trim();
                if (!base || !selFaction || selLevel === '') return;
                const tag = `${base}_${selFaction}_${selLevel}`;
                if (!currentFactionTags.includes(tag)) {
                    currentFactionTags.push(tag);
                    renderSubChips();
                }
                baseInput.value = '';
                selFaction = ''; selLevel = '';
                suggestions.innerHTML = '';
                fGroup.querySelectorAll('.profile-edit__subtag-btn').forEach(b => b.classList.remove('active'));
                lGroup.querySelectorAll('.profile-edit__subtag-btn').forEach(b => b.classList.remove('active'));
            }
        }
    });
    builder.appendChild(addBtn);
    form.appendChild(builder);

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
        saveBtn.textContent = 'Запись...';
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
                hiddenTags: [...currentHidden],
                factionAccessTags: [...currentFactionTags]
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

            msg.textContent = 'Данные записаны';
            msg.style.display = 'block';
        } catch (err) {
            msg.textContent = 'Ошибка: ' + translateError(err);
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
        text: 'Оперативное досье'
    });

    // Загружаем существующую заметку, если есть
    const existing = await getNote(authorId, targetId);

    const textarea = createElement('textarea', {
        className: 'profile-notes__textarea',
        text: existing ? existing.content : '',
        attributes: { rows: 4, placeholder: 'Оперативные заметки...' }
    });

    const saveBtn = createElement('button', {
        className: 'profile-notes__save',
        text: 'Записать в досье',
        attributes: { type: 'button' }
    });

    const msg = createElement('p', { className: 'profile-notes__msg' });

    saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Запись...';
        msg.style.display = 'none';

        try {
            await saveNote(authorId, targetId, textarea.value);
            msg.textContent = 'Досье обновлено';
            msg.style.display = 'block';
        } catch (err) {
            msg.textContent = 'Ошибка: ' + translateError(err);
            msg.style.display = 'block';
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Записать в досье';
        }
    });

    section.appendChild(title);
    section.appendChild(textarea);
    section.appendChild(saveBtn);
    section.appendChild(msg);

    return section;
}
