import { createElement } from '../utils/dom.js?v=28';
import { store } from '../core/Store.js?v=28';
import { createAvatar } from '../core/Avatar.js?v=28';
import { getUserProfile, updateUserProfile, syncPublicPlayer, getPlayerDisplayName } from '../firebase/authService.js?v=28';
import { getPublicPlayer } from '../firebase/publicPlayersService.js?v=28';
import { getCharacterForPlayer } from '../firebase/charactersService.js?v=28';
import { getNote, saveNote } from '../firebase/notesService.js?v=28';
import { saveUserPhoto, removeUserPhoto } from '../firebase/avatarService.js?v=28';
import { processAvatarFile } from '../utils/avatarPhoto.js?v=28';
import { getAllDocuments } from '../firebase/documentsService.js?v=28';
import { translateError } from '../utils/translateError.js?v=28';
import { Button } from '../components/Button.js?v=28';
import { Chip } from '../components/Chip.js?v=28';
import { FactionBadge } from '../components/FactionBadge.js?v=28';
import { StatusMessage, showMessage, hideMessage } from '../components/StatusMessage.js?v=28';
import { FormField } from '../components/FormField.js?v=28';
import { getActiveGame, getActiveFaction, FACTION_LABELS } from '../utils/profile.js?v=28';
import { ROLE_LABELS, LANGUAGE_LABELS } from '../utils/constants.js?v=28';
import { isAdminMode } from '../components/ViewModeToggle.js?v=28';

export async function ProfilePage(targetUid) {
    const section = createElement('section', { className: 'profile-page' });

    try {
        const currentUser = store.get('user');
        if (!currentUser) {
            section.appendChild(StatusMessage({ type: 'err', text: 'Требуется идентификация' }));
            return section;
        }

        const uid = targetUid || currentUser.uid;
        const isOwner = uid === currentUser.uid;
        const canSeePii = isOwner || (currentUser.role === 'master' && isAdminMode(currentUser));
        const isAdmin = canSeePii || currentUser.role === 'igrotech';

        let profile = null;
        let publicPlayer = null;

        if (canSeePii) {
            profile = await getUserProfile(uid);
        } else {
            publicPlayer = await getPublicPlayer(uid);
        }

        if (!profile && !publicPlayer) {
            section.appendChild(StatusMessage({ type: 'err', text: 'Агент не найден в базе' }));
            return section;
        }

        // Персонаж в активной игре
        let character = null;
        const game = getActiveGame();
        if (game) {
            try { character = await getCharacterForPlayer(game.id, uid); }
            catch (_) { character = null; }
        }

        const displayName = canSeePii
            ? (profile ? getPlayerDisplayName(profile) : (publicPlayer.displayName || publicPlayer.username))
            : (character?.name || publicPlayer.username);
        const username = profile ? profile.username : publicPlayer.username;
        const role = profile ? profile.role : publicPlayer.role;

        const layout = createElement('div', { className: 'profile-layout' });

        const photo = profile?.photo || publicPlayer?.photo || null;
        layout.appendChild(createSidebar({ displayName, username, role, character, isOwner, isAdmin, photo }));

        const content = createElement('div', { className: 'profile-content' });

        if (profile && canSeePii) {
            content.appendChild(createPlayerDataBlock(profile, isOwner));
        }

        if (character) {
            content.appendChild(createCharacterBlock(character, role));
        }

        if (profile && canSeePii) {
            content.appendChild(await createDocumentsSection(profile, isOwner));
        }

        // Заметки: софракционеры и админ
        const sameFaction = character && getActiveFaction() && character.faction === getActiveFaction();
        if (!isOwner && (sameFaction || isAdmin)) {
            content.appendChild(await createNotesSection(currentUser.uid, uid));
        }

        layout.appendChild(content);
        section.appendChild(layout);
    } catch (err) {
        section.appendChild(StatusMessage({ type: 'err', text: 'Ошибка: ' + translateError(err) }));
    }

    return section;
}

function createSidebar({ displayName, username, role, character, isOwner, isAdmin, photo }) {
    const sidebar = createElement('aside', { className: 'profile-sidebar' });
    // Мастера и игротехи — фиолетовые, даже если у персонажа старая фракция
    const faction = (role === 'master' || role === 'igrotech')
        ? 'purple'
        : (character?.faction || null);

    const avatar = createAvatar(username, faction, 'profile-sidebar__avatar', null, photo);
    sidebar.appendChild(avatar);

    if (isOwner) {
        const tools = createElement('div', { className: 'profile-avatar-tools' });
        const fileInput = createElement('input', {
            attributes: { type: 'file', accept: 'image/*', hidden: '' }
        });
        const msg = createElement('span', { className: 'profile-avatar-msg' });
        const uploadBtn = Button({
            text: 'Фото',
            icon: 'photo_camera',
            variant: 'secondary',
            size: 'sm',
            onClick: () => fileInput.click()
        });
        const removeBtn = Button({
            text: 'Убрать',
            variant: 'secondary',
            size: 'sm',
            disabled: !photo,
            onClick: async () => {
                try {
                    await removeUserPhoto(store.get('user').uid);
                    const user = store.get('user');
                    store.set('user', { ...user, photo: null });
                    const fallback = createAvatar(username, faction, 'profile-sidebar__avatar', null, null);
                    avatar.src = fallback.src;
                    avatar.classList.remove('avatar--photo');
                    removeBtn.disabled = true;
                    msg.textContent = 'Фото удалено';
                } catch (err) {
                    msg.textContent = 'Ошибка: ' + translateError(err);
                }
            }
        });

        fileInput.addEventListener('change', async () => {
            const file = fileInput.files && fileInput.files[0];
            if (!file) return;
            uploadBtn.disabled = true;
            msg.textContent = 'Обработка...';
            try {
                const dataUrl = await processAvatarFile(file);
                await saveUserPhoto(store.get('user').uid, dataUrl);
                const user = store.get('user');
                store.set('user', { ...user, photo: dataUrl });
                avatar.src = dataUrl;
                avatar.classList.add('avatar--photo');
                removeBtn.disabled = false;
                msg.textContent = 'Фото обновлено';
            } catch (err) {
                msg.textContent = 'Ошибка: ' + translateError(err);
            } finally {
                uploadBtn.disabled = false;
                fileInput.value = '';
            }
        });

        tools.appendChild(fileInput);
        tools.appendChild(uploadBtn);
        tools.appendChild(removeBtn);
        tools.appendChild(msg);
        sidebar.appendChild(tools);
    }

    sidebar.appendChild(createElement('h1', {
        className: 'profile-sidebar__username',
        text: displayName || username
    }));

    sidebar.appendChild(createElement('div', {
        className: 'profile-sidebar__role',
        text: ROLE_LABELS[role] || role
    }));

    if (isOwner || isAdmin) {
        sidebar.appendChild(createField('Позывной', username));
    }

    if (character) {
        if (faction) {
            sidebar.appendChild(createElement('div', {
                className: `profile-sidebar__faction profile-sidebar__faction--${faction}`,
                text: FACTION_LABELS[faction] || faction
            }));
        } else {
            sidebar.appendChild(createElement('div', {
                className: 'profile-sidebar__faction profile-sidebar__faction--none',
                text: 'Роль не выдана'
            }));
        }

        if (character.name) {
            sidebar.appendChild(createField('ФИ персонажа', character.name));
        }
        if (character.profession) {
            sidebar.appendChild(createField('Профессия', character.profession));
        }
        if (character.age) {
            sidebar.appendChild(createField('Возраст', character.age + ' лет'));
        }
        if (character.worldview) {
            sidebar.appendChild(createField('Мировоззрение', character.worldview));
        }
        if ((character.languages || []).length) {
            sidebar.appendChild(createLangRow(character.languages));
        }
    } else if (faction) {
        sidebar.appendChild(createElement('div', {
            className: `profile-sidebar__faction profile-sidebar__faction--${faction}`,
            text: FACTION_LABELS[faction] || faction
        }));
    } else {
        sidebar.appendChild(createElement('div', {
            className: 'profile-sidebar__faction profile-sidebar__faction--none',
            text: 'Нет персонажа в активной игре'
        }));
    }

    return sidebar;
}

function createField(label, value) {
    const row = createElement('div', { className: 'profile-sidebar__field' });
    row.appendChild(createElement('span', { className: 'profile-sidebar__field-label', text: label }));
    row.appendChild(createElement('span', { className: 'profile-sidebar__field-value', text: value }));
    return row;
}

function createLangRow(languages) {
    const row = createElement('div', { className: 'profile-sidebar__field' });
    row.appendChild(createElement('span', { className: 'profile-sidebar__field-label', text: 'Языки' }));
    const list = createElement('div', { className: 'profile-sidebar__langs' });
    for (const lang of languages) {
        list.appendChild(Chip({ text: LANGUAGE_LABELS[lang] || lang, variant: 'lang', color: lang }));
    }
    row.appendChild(list);
    return row;
}

/** Данные игрока (PII) — владельцу редактирование, админу просмотр */
function createPlayerDataBlock(profile, isOwner) {
    const block = createElement('div', { className: 'profile-about' });
    block.appendChild(createElement('div', { className: 'profile-about__label', text: 'Данные игрока' }));

    const p = profile.player || {};

    if (!isOwner) {
        block.appendChild(createField('ФИ', [p.firstName, p.lastName].filter(Boolean).join(' ') || '—'));
        block.appendChild(createField('Контакт', p.contact || '—'));
        block.appendChild(createField('Контактное лицо', [p.emergencyName, p.emergencyRelation, p.emergencyContact].filter(Boolean).join(' · ') || '—'));
        block.appendChild(createField('Аллергии', p.allergies || '—'));
        block.appendChild(createField('Медпоказания', p.medical || '—'));
        return block;
    }

    const form = createElement('form', {
        className: 'profile-admin__form',
        events: { submit: (e) => e.preventDefault() }
    });
    form.appendChild(FormField({ type: 'text', id: 'self-lastname', label: 'Фамилия', value: p.lastName || '' }));
    form.appendChild(FormField({ type: 'text', id: 'self-firstname', label: 'Имя', value: p.firstName || '' }));
    form.appendChild(FormField({ type: 'text', id: 'self-contact', label: 'Контакт', value: p.contact || '', placeholder: 'Телефон / Telegram' }));

    form.appendChild(createElement('h4', { className: 'profile-admin__subtitle', text: 'Контактное лицо' }));
    form.appendChild(FormField({ type: 'text', id: 'self-emergency-name', label: 'ФИ контактного лица', value: p.emergencyName || '' }));
    form.appendChild(FormField({ type: 'text', id: 'self-emergency-contact', label: 'Контакт', value: p.emergencyContact || '' }));
    form.appendChild(FormField({ type: 'text', id: 'self-emergency-relation', label: 'Кем является', value: p.emergencyRelation || '' }));

    form.appendChild(createElement('h4', { className: 'profile-admin__subtitle', text: 'Медицинская информация' }));
    form.appendChild(FormField({ type: 'textarea', id: 'self-allergies', label: 'Аллергии', value: p.allergies || '', rows: 2 }));
    form.appendChild(FormField({ type: 'textarea', id: 'self-medical', label: 'Медпоказания', value: p.medical || '', rows: 2 }));

    const msg = StatusMessage({ type: 'ok', text: '', hidden: true });
    const saveBtn = Button({ text: 'Сохранить данные', attributes: { type: 'submit' } });
    form.appendChild(saveBtn);
    form.appendChild(msg);

    form.addEventListener('submit', async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Запись...';
        hideMessage(msg);
        try {
            const data = {
                player: {
                    firstName: form.querySelector('#self-firstname').value.trim(),
                    lastName: form.querySelector('#self-lastname').value.trim(),
                    contact: form.querySelector('#self-contact').value.trim(),
                    emergencyName: form.querySelector('#self-emergency-name').value.trim(),
                    emergencyContact: form.querySelector('#self-emergency-contact').value.trim(),
                    emergencyRelation: form.querySelector('#self-emergency-relation').value.trim(),
                    allergies: form.querySelector('#self-allergies').value.trim(),
                    medical: form.querySelector('#self-medical').value.trim()
                }
            };
            await updateUserProfile(store.get('user').uid, data);
            store.set('user', { ...store.get('user'), ...data });
            // Обновляем публичное имя в проекции
            await syncPublicPlayer(store.get('user').uid, {
                displayName: [data.player.firstName, data.player.lastName].filter(Boolean).join(' ') || store.get('user').username
            }).catch(() => {});
            showMessage(msg, 'Данные записаны', 'ok');
        } catch (err) {
            showMessage(msg, 'Ошибка: ' + translateError(err), 'err');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Сохранить данные';
        }
    });

    block.appendChild(form);
    return block;
}

function createCharacterBlock(character, role) {
    const block = createElement('div', { className: 'profile-about' });
    block.appendChild(createElement('div', { className: 'profile-about__label', text: 'Персонаж' }));

    const head = createElement('div', { className: 'profile-tags__list' });
    const faction = (role === 'master' || role === 'igrotech')
        ? 'purple'
        : character.faction;
    if (faction) head.appendChild(FactionBadge({ faction }));
    head.appendChild(createElement('span', { text: character.name || 'Без имени' }));
    if (character.profession) head.appendChild(createElement('span', { text: character.profession }));
    block.appendChild(head);

    if (character.about) {
        block.appendChild(createElement('div', { className: 'profile-about__quote', text: character.about }));
    }

    return block;
}

async function createDocumentsSection(profile, isOwner) {
    const section = createElement('div', { className: 'profile-documents' });
    section.appendChild(createElement('h3', { className: 'profile-documents__title', text: 'Файлы' }));

    const docIds = profile.documents || [];
    if (docIds.length === 0) {
        section.appendChild(createElement('p', { className: 'profile-documents__empty', text: 'Нет файлов.' }));
        if (isOwner) {
            section.appendChild(Button({ text: 'Добавить файл', variant: 'secondary', href: '#/documents/add' }));
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
            link.appendChild(FactionBadge({ faction: doc.faction, size: 'sm' }));
            list.appendChild(link);
        }
        section.appendChild(list);
        if (isOwner) {
            section.appendChild(Button({ text: 'Добавить файл', icon: 'add', variant: 'secondary', size: 'sm', href: '#/documents/add' }));
        }
    } catch (_) {
        section.appendChild(createElement('p', { className: 'profile-documents__empty', text: 'Ошибка загрузки файлов.' }));
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

    const msg = StatusMessage({ type: 'ok', text: '', hidden: true });

    const saveBtn = Button({ text: 'Записать в досье', onClick: async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Запись...';
        hideMessage(msg);
        try {
            await saveNote(authorId, targetId, textarea.value);
            showMessage(msg, 'Досье обновлено', 'ok');
        } catch (err) {
            showMessage(msg, 'Ошибка: ' + translateError(err), 'err');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Записать в досье';
        }
    }});

    section.appendChild(saveBtn);
    section.appendChild(msg);
    return section;
}
