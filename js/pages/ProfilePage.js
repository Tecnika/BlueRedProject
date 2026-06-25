import { createElement } from '../utils/dom.js?v=3';
import { store } from '../core/Store.js?v=3';
import { createAvatar } from '../core/Avatar.js?v=3';
import { getUserProfile, updateUserProfile } from '../firebase/authService.js?v=3';
import { getNote, saveNote } from '../firebase/notesService.js?v=3';
import { TagInput } from '../components/TagInput.js?v=3';
import { searchTags } from '../firebase/tagsService.js?v=3';
import { getAllDocuments } from '../firebase/documentsService.js?v=3';
import { translateError } from '../utils/translateError.js?v=3';

const FACTION_MAP = { red: 'Красные', blue: 'Синие', purple: 'Фиолетовые' };
const ROLE_ICONS = { master: '👑', igrotech: '⚙️', player: '🎲' };
const ROLE_LABELS = { master: 'Мастер', igrotech: 'Игротех', player: 'Игрок' };

export async function ProfilePage(targetUid, themeManager) {
    const section = createElement('section', { className: 'profile-page' });

    try {
        const currentUser = store.get('user');
        if (!currentUser) {
            section.appendChild(createElement('p', { className: 'profile-page__error', text: 'Требуется идентификация' }));
            return section;
        }

        const uid = targetUid || currentUser.uid;
        const profile = await getUserProfile(uid);
        if (!profile) {
            section.appendChild(createElement('p', { className: 'profile-page__error', text: 'Агент не найден в базе' }));
            return section;
        }

        const isOwner = uid === currentUser.uid;
        const isAdmin = currentUser.role === 'master' || currentUser.role === 'igrotech';
        const sameFaction = currentUser.faction && profile.faction && currentUser.faction === profile.faction;

        const layout = createElement('div', { className: 'profile-layout' });

        layout.appendChild(createSidebar(profile));

        const content = createElement('div', { className: 'profile-content' });

        content.appendChild(createAboutBlock(profile, isOwner));

        if ((isOwner || isAdmin) && profile.accessTags && profile.accessTags.length) {
            content.appendChild(createTagBlock('Грифы доступа', profile.accessTags));
        }
        if ((isOwner || isAdmin) && profile.hiddenTags && profile.hiddenTags.length) {
            content.appendChild(createTagBlock('Секретные грифы', profile.hiddenTags));
        }

        if (isAdmin) {
            content.appendChild(await createAdminSection(profile, uid, themeManager));
        }

        if (isOwner || isAdmin) {
            content.appendChild(await createDocumentsSection(profile, isOwner));
        }

        if (!isOwner && (sameFaction || isAdmin)) {
            content.appendChild(await createNotesSection(currentUser.uid, uid));
        }

        layout.appendChild(content);
        section.appendChild(layout);
    } catch (err) {
        section.appendChild(createElement('p', { className: 'profile-page__error', text: 'Ошибка: ' + translateError(err) }));
    }

    return section;
}

function createSidebar(profile) {
    const sidebar = createElement('aside', { className: 'profile-sidebar' });

    const avatar = createAvatar(profile.username, profile.faction, 'profile-sidebar__avatar');
    sidebar.appendChild(avatar);

    const username = createElement('h1', { className: 'profile-sidebar__username', text: profile.username });
    sidebar.appendChild(username);

    const roleIcon = ROLE_ICONS[profile.role] || '🎲';
    const roleName = ROLE_LABELS[profile.role] || profile.role;
    const roleEl = createElement('div', { className: 'profile-sidebar__role', html: `${roleIcon} ${roleName}` });
    sidebar.appendChild(roleEl);

    const factionName = FACTION_MAP[profile.faction] || 'Фракция не назначена';
    const factionEl = createElement('div', {
        className: `profile-sidebar__faction profile-sidebar__faction--${profile.faction || 'none'}`,
        text: factionName
    });
    sidebar.appendChild(factionEl);

    if (profile.createdAt) {
        const date = new Date(profile.createdAt);
        const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
        sidebar.appendChild(createElement('div', { className: 'profile-sidebar__date', html: `Зарегистрирован: ${dateStr}` }));
    }

    sidebar.appendChild(createField('Мировоззрение', profile.worldview || 'Не определено'));

    return sidebar;
}

function createField(label, value) {
    const row = createElement('div', { className: 'profile-sidebar__field' });
    row.appendChild(createElement('span', { className: 'profile-sidebar__field-label', text: label }));
    row.appendChild(createElement('span', { className: 'profile-sidebar__field-value', text: value }));
    return row;
}

function createAboutBlock(profile, isOwner) {
    const block = createElement('div', { className: 'profile-about' });

    const label = createElement('div', { className: 'profile-about__label', text: 'Личное дело' });
    block.appendChild(label);

    if (isOwner) {
        const textarea = createElement('textarea', {
            className: 'profile-about__textarea',
            text: profile.about || '',
            attributes: { rows: 3, placeholder: 'Расскажите о себе...' }
        });
        block.appendChild(textarea);

        const btnGroup = createElement('div', { className: 'profile-about__actions' });
        const saveBtn = createElement('button', {
            className: 'profile-about__save',
            text: 'Сохранить',
            attributes: { type: 'button' }
        });
        const msg = createElement('p', { className: 'profile-about__msg' });

        saveBtn.addEventListener('click', async () => {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Запись...';
            msg.style.display = 'none';
            try {
                await updateUserProfile(store.get('user').uid, { about: textarea.value.trim() });
                store.set('user', { ...store.get('user'), about: textarea.value.trim() });
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

        btnGroup.appendChild(saveBtn);
        btnGroup.appendChild(msg);
        block.appendChild(btnGroup);
    } else {
        const text = profile.about || 'Здесь могла быть информация об агенте, но досье пусто.';
        const quoteText = createElement('div', { className: 'profile-about__quote', text: text });
        block.appendChild(quoteText);
    }

    return block;
}

function createTagBlock(label, tags) {
    const block = createElement('div', { className: 'profile-tags' });
    block.appendChild(createElement('h3', { className: 'profile-tags__title', text: label }));
    const list = createElement('div', { className: 'profile-tags__list' });
    for (const tag of tags) {
        list.appendChild(createElement('span', { className: 'profile-tags__tag', text: tag }));
    }
    block.appendChild(list);
    return block;
}

async function createAdminSection(profile, targetUid, themeManager) {
    const section = createElement('div', { className: 'profile-admin' });
    section.appendChild(createElement('h3', { className: 'profile-admin__title', text: 'Панель управления' }));

    const form = createElement('form', {
        className: 'profile-admin__form',
        events: { submit: (e) => e.preventDefault() }
    });

    form.appendChild(createAdminField('Фракция', () => {
        const select = createElement('select', { className: 'profile-admin__select', attributes: { id: 'admin-faction' } });
        const opts = [
            { value: '', text: 'Не назначена' },
            { value: 'red', text: 'Красные' },
            { value: 'blue', text: 'Синие' },
            { value: 'purple', text: 'Фиолетовые' }
        ];
        for (const o of opts) {
            const opt = createElement('option', { text: o.text, attributes: { value: o.value } });
            if (o.value === (profile.faction || '')) opt.selected = true;
            select.appendChild(opt);
        }
        return select;
    }));

    form.appendChild(createAdminField('Мировоззрение', () => {
        return createElement('input', {
            className: 'profile-admin__input',
            attributes: { type: 'text', id: 'admin-worldview', value: profile.worldview || '' }
        });
    }));

    const currentAccess = [...(profile.accessTags || [])];
    const currentHidden = [...(profile.hiddenTags || [])];

    try {
        const accessLabel = createElement('label', { className: 'profile-admin__label', text: 'Грифы доступа' });
        form.appendChild(accessLabel);
        const accessTagInput = await TagInput({
            initialTags: currentAccess,
            onChange: (tags) => { currentAccess.length = 0; currentAccess.push(...tags); },
            placeholder: 'Добавить гриф...'
        });
        form.appendChild(accessTagInput);
    } catch (e) {
        form.appendChild(createAdminField('Грифы доступа (через запятую)', () => {
            return createElement('input', {
                className: 'profile-admin__input',
                attributes: { type: 'text', id: 'admin-tags', value: currentAccess.join(', ') }
            });
        }));
    }

    try {
        const hiddenLabel = createElement('label', { className: 'profile-admin__label', text: 'Секретные грифы' });
        form.appendChild(hiddenLabel);
        const hiddenTagInput = await TagInput({
            initialTags: currentHidden,
            onChange: (tags) => { currentHidden.length = 0; currentHidden.push(...tags); },
            placeholder: 'Добавить секретный гриф...'
        });
        form.appendChild(hiddenTagInput);
    } catch (e) {
        form.appendChild(createAdminField('Секретные грифы (через запятую)', () => {
            return createElement('input', {
                className: 'profile-admin__input',
                attributes: { type: 'text', id: 'admin-hidden', value: currentHidden.join(', ') }
            });
        }));
    }

    const currentFactionTags = [...(profile.factionAccessTags || [])];
    const subLabel = createElement('label', { className: 'profile-admin__label', text: 'Доступ к ячейкам' });
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

    const builder = createElement('div', { className: 'profile-admin__subtag-builder' });
    const inputWrap = createElement('div', { className: 'profile-admin__subtag-input-wrap' });
    const baseInput = createElement('input', {
        className: 'profile-admin__input',
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

    const FACTION_MAP_SHORT = { к: 'Красные', с: 'Синие', ф: 'Фиолетовые' };
    const LEVEL_MAP_SHORT = { '0': 'Инфо', '1': 'Пропаганда', '2': 'Жёсткая' };

    const fGroup = createElement('div', { className: 'profile-admin__subtag-group' });
    for (const [k, lab] of Object.entries(FACTION_MAP_SHORT)) {
        const btn = createElement('button', {
            className: 'profile-admin__subtag-btn', text: lab,
            attributes: { type: 'button', 'data-value': k },
            events: { click: () => { selFaction = k; fGroup.querySelectorAll('.profile-admin__subtag-btn').forEach(b => b.classList.toggle('active', b.dataset.value === k)); } }
        });
        fGroup.appendChild(btn);
    }
    builder.appendChild(fGroup);

    const lGroup = createElement('div', { className: 'profile-admin__subtag-group' });
    for (const [k, lab] of Object.entries(LEVEL_MAP_SHORT)) {
        const btn = createElement('button', {
            className: 'profile-admin__subtag-btn', text: lab,
            attributes: { type: 'button', 'data-value': k },
            events: { click: () => { selLevel = k; lGroup.querySelectorAll('.profile-admin__subtag-btn').forEach(b => b.classList.toggle('active', b.dataset.value === k)); } }
        });
        lGroup.appendChild(btn);
    }
    builder.appendChild(lGroup);

    const addBtn = createElement('button', {
        className: 'profile-admin__subtag-add', text: '+',
        attributes: { type: 'button', title: 'Добавить субтег' },
        events: {
            click: () => {
                const base = baseInput.value.trim();
                if (!base || !selFaction || selLevel === '') return;
                const tag = `${base}_${selFaction}_${selLevel}`;
                if (!currentFactionTags.includes(tag)) { currentFactionTags.push(tag); renderSubChips(); }
                baseInput.value = '';
                selFaction = ''; selLevel = '';
                suggestions.innerHTML = '';
                fGroup.querySelectorAll('.profile-admin__subtag-btn').forEach(b => b.classList.remove('active'));
                lGroup.querySelectorAll('.profile-admin__subtag-btn').forEach(b => b.classList.remove('active'));
            }
        }
    });
    builder.appendChild(addBtn);
    form.appendChild(builder);

    const saveBtn = createElement('button', {
        className: 'profile-admin__save', text: 'Сохранить', attributes: { type: 'submit' }
    });
    const msg = createElement('p', { className: 'profile-admin__msg' });
    form.appendChild(saveBtn);
    form.appendChild(msg);

    form.addEventListener('submit', async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Запись...';
        msg.style.display = 'none';

        try {
            const fallbackAccess = form.querySelector('#admin-tags');
            const fallbackHidden = form.querySelector('#admin-hidden');
            if (fallbackAccess) {
                currentAccess.length = 0;
                currentAccess.push(...(fallbackAccess.value ? fallbackAccess.value.split(',').map(t => t.trim()).filter(Boolean) : []));
            }
            if (fallbackHidden) {
                currentHidden.length = 0;
                currentHidden.push(...(fallbackHidden.value ? fallbackHidden.value.split(',').map(t => t.trim()).filter(Boolean) : []));
            }

            const data = {
                faction: form.querySelector('#admin-faction').value,
                worldview: form.querySelector('#admin-worldview').value.trim(),
                accessTags: [...currentAccess],
                hiddenTags: [...currentHidden],
                factionAccessTags: [...currentFactionTags]
            };

            await updateUserProfile(targetUid, data);

            const currentUser = store.get('user');
            if (currentUser && targetUid === currentUser.uid) {
                store.set('user', { ...currentUser, ...data });
                if (themeManager && data.faction) themeManager.setThemeByFaction(data.faction);
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

    section.appendChild(form);
    return section;
}

function createAdminField(label, inputFn) {
    const group = createElement('div', { className: 'profile-admin__field' });
    group.appendChild(createElement('label', { className: 'profile-admin__label', text: label }));
    group.appendChild(inputFn());
    return group;
}

async function createDocumentsSection(profile, isOwner) {
    const section = createElement('div', { className: 'profile-documents' });
    section.appendChild(createElement('h3', { className: 'profile-documents__title', text: 'Документы' }));

    const docIds = profile.documents || [];
    if (docIds.length === 0) {
        section.appendChild(createElement('p', { className: 'profile-documents__empty', text: 'Нет документов.' }));
        if (isOwner) {
            section.appendChild(createElement('a', {
                className: 'profile-documents__add-link',
                text: 'Добавить документ',
                attributes: { href: '#/documents/add' }
            }));
        }
        return section;
    }

    try {
        const allDocs = await getAllDocuments();
        const myDocs = allDocs.filter(d => docIds.includes(d.id));
        const list = createElement('div', { className: 'profile-documents__list' });
        for (const doc of myDocs) {
            const link = createElement('a', {
                className: 'profile-documents__item',
                attributes: { href: `#/documents/view?id=${doc.id}` }
            });
            link.appendChild(createElement('span', { className: 'profile-documents__number', text: `№ ${doc.number}` }));
            link.appendChild(createElement('span', {
                className: `profile-documents__badge profile-documents__badge--${doc.faction}`,
                text: doc.faction || '—'
            }));
            list.appendChild(link);
        }
        section.appendChild(list);
        if (isOwner) {
            section.appendChild(createElement('a', {
                className: 'profile-documents__add-link',
                text: '+ Добавить документ',
                attributes: { href: '#/documents/add' }
            }));
        }
    } catch (_) {
        section.appendChild(createElement('p', { className: 'profile-documents__empty', text: 'Ошибка загрузки документов.' }));
    }

    return section;
}

async function createNotesSection(authorId, targetId) {
    const section = createElement('div', { className: 'profile-notes' });
    section.appendChild(createElement('h3', { className: 'profile-notes__title', text: 'Оперативное досье' }));

    const existing = await getNote(authorId, targetId);
    const textarea = createElement('textarea', {
        className: 'profile-notes__textarea',
        text: existing ? existing.content : '',
        attributes: { rows: 4, placeholder: 'Оперативные заметки...' }
    });
    section.appendChild(textarea);

    const saveBtn = createElement('button', {
        className: 'profile-notes__save', text: 'Записать в досье', attributes: { type: 'button' }
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

    section.appendChild(saveBtn);
    section.appendChild(msg);
    return section;
}
