import { createElement } from '../utils/dom.js?v=21';
import { store } from '../core/Store.js?v=21';
import { createAvatar } from '../core/Avatar.js?v=21';
import { Icon } from './Icon.js?v=21';
import { translateError } from '../utils/translateError.js?v=21';
import { getActiveFaction, getActiveGame, FACTION_LABELS } from '../utils/profile.js?v=21';
import { getAllPublicPlayers } from '../firebase/publicPlayersService.js?v=21';
import { getCharactersByGame } from '../firebase/charactersService.js?v=21';
import {
    ensureFactionChat,
    ensureMasterChat,
    ensureDm,
    subscribeChat,
    subscribeDmChats,
    subscribeChatsByType,
    subscribeMessages,
    sendMessage,
    markRead,
    dmChatId
} from '../firebase/chatService.js?v=21';

const TIME_FORMAT = { hour: '2-digit', minute: '2-digit' };

/**
 * Плавающий чат (правый нижний угол): фракция, ЛС, мастерская.
 */
export function ChatWidget() {
    const root = createElement('div', { className: 'chat-widget' });
    let builtFor = null;
    let builtFaction = null;
    let session = null;

    function rebuild(user) {
        if (session) {
            session.destroy();
            session = null;
        }
        root.innerHTML = '';
        builtFor = user ? user.uid : null;
        builtFaction = getActiveFaction();
        if (!user || user.radioFaction) return;
        session = new ChatSession(root, user);
        session.build();
    }

    store.subscribe('user', (user) => {
        const uid = user ? user.uid : null;
        if (uid !== builtFor) rebuild(user);
    });

    // Персонаж/фракция загружаются после профиля — пересобираем чат с фракцией
    store.subscribe('character', () => {
        const user = store.get('user');
        if (user && getActiveFaction() !== builtFaction) rebuild(user);
    });

    rebuild(store.get('user'));
    return root;
}

class ChatSession {
    constructor(root, user) {
        this.root = root;
        this.user = user;
        this.chats = new Map();
        this.players = {};
        this.lastRead = { ...(user.lastRead || {}) };
        this.activeId = null;
        this.initialized = false;
        this.unsubs = [];
        this.messagesUnsub = null;
        this.messages = [];
        this.soundCtx = null;
        this.factionMembers = [];
        this.masterMode = user.role === 'master';
        this.faction = getActiveFaction();
        this.onSubError = (e) => console.warn('chat:', e?.code || e?.message || e);
    }

    get authorName() {
        return store.get('character')?.name || this.user.username || 'Агент';
    }

    build() {
        this.root.appendChild(this.buildBubble());
        this.root.appendChild(this.buildPanel());
        this.updateBadge();
        document.addEventListener('pointerdown', () => this.initAudio(), { once: true });
        this.initChats().catch(() => {});
    }

    /* ---------- разметка ---------- */

    buildBubble() {
        const bubble = createElement('button', {
            className: 'chat-bubble',
            attributes: { type: 'button', 'aria-label': 'Открыть чат' }
        });
        bubble.appendChild(Icon({ name: 'chat', size: 'lg' }));
        this.badge = createElement('span', { className: 'chat-bubble__badge', attributes: { hidden: '' } });
        bubble.appendChild(this.badge);
        bubble.addEventListener('click', () => this.togglePanel());
        return bubble;
    }

    buildPanel() {
        const panel = createElement('div', { className: 'chat-panel', attributes: { hidden: '' } });

        const header = createElement('div', { className: 'chat-panel__header' });
        this.headerTitle = createElement('span', { className: 'chat-panel__title', text: 'Связь' });
        header.appendChild(this.headerTitle);

        const actions = createElement('div', { className: 'chat-panel__actions' });

        if ('Notification' in window && Notification.permission === 'default') {
            const notifyBtn = createElement('button', {
                className: 'chat-panel__icon-btn',
                attributes: { type: 'button', 'aria-label': 'Включить уведомления', title: 'Включить уведомления' }
            });
            notifyBtn.appendChild(Icon({ name: 'notifications', size: 'sm' }));
            notifyBtn.addEventListener('click', async () => {
                await Notification.requestPermission();
                notifyBtn.remove();
            });
            actions.appendChild(notifyBtn);
        }

        const closeBtn = createElement('button', {
            className: 'chat-panel__icon-btn',
            attributes: { type: 'button', 'aria-label': 'Закрыть чат' }
        });
        closeBtn.appendChild(Icon({ name: 'close', size: 'sm' }));
        closeBtn.addEventListener('click', () => this.togglePanel(false));
        actions.appendChild(closeBtn);

        header.appendChild(actions);
        panel.appendChild(header);

        this.body = createElement('div', { className: 'chat-panel__body' });
        panel.appendChild(this.body);

        this.listView = createElement('div', { className: 'chat-list' });
        this.threadView = createElement('div', { className: 'chat-thread' });

        // Заголовок открытого диалога (как в VK)
        const threadHead = createElement('div', { className: 'chat-thread__header' });
        this.threadBack = createElement('button', {
            className: 'chat-thread__back',
            attributes: { type: 'button', 'aria-label': 'К списку диалогов' }
        });
        this.threadBack.appendChild(Icon({ name: 'arrow_back', size: 'sm' }));
        this.threadBack.addEventListener('click', () => this.closeChat());
        threadHead.appendChild(this.threadBack);

        this.threadTitle = createElement('div', { className: 'chat-thread__title', text: 'Выберите диалог' });
        threadHead.appendChild(this.threadTitle);
        this.threadView.appendChild(threadHead);

        this.threadPlaceholder = createElement('div', {
            className: 'chat-thread__placeholder',
            text: 'Выберите диалог слева'
        });
        this.threadView.appendChild(this.threadPlaceholder);

        this.messagesEl = createElement('div', { className: 'chat-thread__messages', attributes: { hidden: '' } });
        this.threadView.appendChild(this.messagesEl);

        const form = createElement('form', { className: 'chat-thread__form', attributes: { hidden: '' } });
        this.input = createElement('input', {
            className: 'chat-thread__input',
            attributes: { type: 'text', placeholder: 'Сообщение...', 'aria-label': 'Сообщение', autocomplete: 'off' }
        });
        const sendBtn = createElement('button', {
            className: 'chat-thread__send',
            attributes: { type: 'submit', 'aria-label': 'Отправить' }
        });
        sendBtn.appendChild(Icon({ name: 'send', size: 'sm' }));
        form.appendChild(this.input);
        form.appendChild(sendBtn);
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = this.input.value.trim();
            if (!text || !this.activeId) return;
            this.input.value = '';
            try {
                await sendMessage(this.activeId, text, {
                    uid: this.user.uid,
                    name: this.authorName,
                    faction: this.faction
                }, (() => {
                    const chat = this.chats.get(this.activeId);
                    return chat ? { type: chat.type, title: this.chatTitle(chat) } : {};
                })());
            } catch (err) {
                console.warn('Не удалось отправить:', translateError(err));
            }
        });
        this.threadForm = form;
        this.threadView.appendChild(form);

        this.body.appendChild(this.listView);
        this.body.appendChild(this.threadView);

        this.panel = panel;
        return panel;
    }

    /* ---------- открытие ---------- */

    async togglePanel(force) {
        const open = force !== undefined ? force : this.panel.hidden;
        this.panel.hidden = !open;

        if (!open) {
            this.activeId = null;
            this.stopMessages();
            return;
        }

        this.initAudio();
    }

    initAudio() {
        if (this.soundCtx) return;
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (Ctx) this.soundCtx = new Ctx();
        } catch (e) { /* без звука */ }
    }

    beep() {
        if (!this.soundCtx) return;
        try {
            const t = this.soundCtx.currentTime;
            const osc = this.soundCtx.createOscillator();
            const gain = this.soundCtx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
            osc.connect(gain);
            gain.connect(this.soundCtx.destination);
            osc.start(t);
            osc.stop(t + 0.26);
        } catch (e) { /* без звука */ }
    }

    async notifyIncoming(chat) {
        this.beep();
        if (document.hidden) {
            await this.showNotification(this.chatTitle(chat), chat.lastMessage?.text || '');
        }
    }

    async showNotification(title, body) {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        const options = { body, icon: 'icons/icon-192.png', tag: 'bluered-chat' };
        try {
            if (navigator.serviceWorker && navigator.serviceWorker.ready) {
                const reg = await navigator.serviceWorker.ready;
                reg.showNotification(title, options);
            } else {
                new Notification(title, options);
            }
        } catch (e) { /* без уведомления */ }
    }

    /* ---------- данные ---------- */

    async initChats() {
        if (this.initialized) return;
        this.initialized = true;

        try {
            const players = await getAllPublicPlayers();
            for (const p of players) this.players[p.uid] = p;
        } catch (e) { /* имена не критичны */ }

        if (this.masterMode) {
            for (const f of ['red', 'blue', 'purple']) {
                try { await ensureFactionChat(f); } catch (e) { /* уже есть */ }
            }
            this.unsubs.push(subscribeChatsByType('faction', list => this.upsertMany(list), this.onSubError));
            this.unsubs.push(subscribeChatsByType('master', list => this.upsertMany(list), this.onSubError));
        } else {
            if (this.faction) {
                await ensureFactionChat(this.faction);
                this.unsubs.push(subscribeChat(this.factionChatId(), chat => this.upsert(chat), this.onSubError));
                await this.loadFactionMembers();
            }
            if (this.user.role !== 'igrotech') {
                await ensureMasterChat(this.user);
                this.unsubs.push(subscribeChat(this.masterChatId(), chat => this.upsert(chat), this.onSubError));
            }
            this.unsubs.push(subscribeDmChats(this.user.uid, list => this.upsertMany(list), this.onSubError));
        }

        this.renderList();
    }

    factionChatId() {
        return 'faction_' + this.faction;
    }

    masterChatId() {
        return 'master_' + this.user.uid;
    }

    async loadFactionMembers() {
        const game = getActiveGame();
        if (!game || !this.faction) return;
        try {
            const characters = await getCharactersByGame(game.id);
            const players = await getAllPublicPlayers();
            const map = {};
            for (const p of players) map[p.uid] = p;
            this.factionMembers = characters
                .filter(c => c.active !== false && c.faction === this.faction && c.playerId && c.playerId !== this.user.uid)
                .map(c => ({
                    uid: c.playerId,
                    name: c.name || map[c.playerId]?.username || 'Агент',
                    username: map[c.playerId]?.username || '',
                    faction: c.faction
                }));
        } catch (e) {
            this.factionMembers = [];
        }
    }

    upsertMany(list) {
        for (const chat of list) this.upsert(chat, true);
        this.renderList();
        this.updateBadge();
    }

    upsert(chat, silent = false) {
        if (!chat) return;
        const prev = this.chats.get(chat.id);
        this.chats.set(chat.id, chat);

        const prevAt = prev?.lastMessageAt || '';
        const nextAt = chat.lastMessageAt || '';
        const isNew = prev && nextAt && nextAt > prevAt && chat.lastMessage?.authorId !== this.user.uid;

        if (isNew && !silent && (document.hidden || this.activeId !== chat.id)) {
            this.notifyIncoming(chat);
        }

        if (!silent) {
            this.renderList();
            this.updateBadge();
        }
    }

    /* ---------- список ---------- */

    chatTitle(chat) {
        if (chat.type === 'faction') {
            return `Фракция: ${FACTION_LABELS[chat.faction] || chat.faction}`;
        }
        if (chat.type === 'master') {
            if (chat.playerId === this.user.uid) return 'Мастерская';
            const p = this.players[chat.playerId];
            return `Мастерская · ${p?.characterName || p?.displayName || p?.username || 'Игрок'}`;
        }
        if (chat.type === 'dm') {
            const other = (chat.members || []).find(m => m !== this.user.uid);
            const p = this.players[other];
            return p?.characterName || p?.displayName || p?.username || 'Личный чат';
        }
        return chat.title || 'Чат';
    }

    isUnread(chat) {
        if (!chat.lastMessageAt) return false;
        if (chat.lastMessage?.authorId === this.user.uid) return false;
        const read = this.lastRead[chat.id] || '';
        return chat.lastMessageAt > read;
    }

    updateBadge() {
        if (!this.badge) return;
        const unread = [...this.chats.values()].filter(c => this.isUnread(c)).length;
        this.badge.hidden = unread === 0;
        this.badge.textContent = unread > 9 ? '9+' : String(unread);
    }

    renderList() {
        if (!this.listView) return;
        this.listView.innerHTML = '';

        const header = createElement('div', { className: 'chat-list__head' });
        header.appendChild(createElement('span', { className: 'chat-list__title', text: 'Диалоги' }));

        if (!this.masterMode && this.faction && this.factionMembers.length > 0) {
            const addBtn = createElement('button', {
                className: 'chat-panel__icon-btn',
                attributes: { type: 'button', 'aria-label': 'Новый диалог' }
            });
            addBtn.appendChild(Icon({ name: 'person_add', size: 'sm' }));
            addBtn.addEventListener('click', () => this.showMemberPicker());
            header.appendChild(addBtn);
        }
        this.listView.appendChild(header);

        const list = [...this.chats.values()].sort((a, b) => {
            return (b.lastMessageAt || b.createdAt || '').localeCompare(a.lastMessageAt || a.createdAt || '');
        });

        if (list.length === 0) {
            this.listView.appendChild(createElement('div', {
                className: 'chat-list__empty',
                text: 'Пока нет диалогов'
            }));
            return;
        }

        for (const chat of list) {
            const item = createElement('button', {
                className: 'chat-list__item' + (this.isUnread(chat) ? ' chat-list__item--unread' : ''),
                attributes: { type: 'button' }
            });

            let avatar;
            if (chat.type === 'faction') {
                const iconName = 'groups';
                avatar = createElement('div', {
                    className: 'chat-list__avatar chat-list__avatar--faction chat-list__avatar--' + chat.faction
                });
                avatar.appendChild(Icon({ name: iconName, size: 'sm' }));
            } else {
                const other = chat.type === 'dm'
                    ? (chat.members || []).find(m => m !== this.user.uid)
                    : chat.playerId;
                const person = this.players[other] || {};
                avatar = createAvatar(
                    person.username || chat.title || 'user',
                    person.faction || this.faction,
                    'chat-list__avatar chat-list__avatar--photo',
                    person.gender
                );
            }

            const info = createElement('div', { className: 'chat-list__info' });
            info.appendChild(createElement('div', {
                className: 'chat-list__name',
                text: this.chatTitle(chat)
            }));
            info.appendChild(createElement('div', {
                className: 'chat-list__preview',
                text: chat.lastMessage ? `${chat.lastMessage.authorName}: ${chat.lastMessage.text}` : 'Нет сообщений'
            }));

            const meta = createElement('div', { className: 'chat-list__meta' });
            meta.appendChild(createElement('span', {
                className: 'chat-list__time',
                text: this.formatTime(chat.lastMessageAt)
            }));
            if (this.isUnread(chat)) {
                meta.appendChild(createElement('span', { className: 'chat-list__dot' }));
            }

            item.appendChild(avatar);
            item.appendChild(info);
            item.appendChild(meta);
            item.addEventListener('click', () => this.openChat(chat));
            this.listView.appendChild(item);
        }
    }

    formatTime(iso) {
        if (!iso) return '';
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return '';
        const today = new Date();
        if (date.toDateString() === today.toDateString()) {
            return date.toLocaleTimeString('ru-RU', TIME_FORMAT);
        }
        return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    }

    showMemberPicker() {
        const overlay = createElement('div', { className: 'chat-picker' });
        const box = createElement('div', { className: 'chat-picker__box' });
        box.appendChild(createElement('div', { className: 'chat-picker__title', text: 'Новый диалог' }));

        const list = createElement('div', { className: 'chat-picker__list' });
        for (const member of this.factionMembers) {
            const row = createElement('button', {
                className: 'chat-picker__item',
                attributes: { type: 'button' }
            });
            row.appendChild(createAvatar(
                member.username || member.name || 'user',
                member.faction || this.faction,
                'chat-picker__avatar',
                member.gender
            ));
            const rowInfo = createElement('span', { className: 'chat-picker__info' });
            rowInfo.appendChild(createElement('span', { className: 'chat-picker__name', text: member.name }));
            if (member.username) {
                rowInfo.appendChild(createElement('span', { className: 'chat-picker__username', text: '@' + member.username }));
            }
            row.appendChild(rowInfo);
            row.addEventListener('click', async () => {
                overlay.remove();
                try {
                    await ensureDm(this.user, { uid: member.uid }, member.name);
                    const id = dmChatId(this.user.uid, member.uid);
                    if (!this.chats.has(id)) {
                        this.chats.set(id, {
                            id,
                            type: 'dm',
                            members: [this.user.uid, member.uid],
                            title: member.name
                        });
                    }
                    this.openChat(this.chats.get(id));
                } catch (e) {
                    console.warn('Не удалось открыть диалог:', e);
                }
            });
            list.appendChild(row);
        }

        if (this.factionMembers.length === 0) {
            list.appendChild(createElement('div', { className: 'chat-picker__empty', text: 'В составе фракции больше никого нет' }));
        }

        const close = createElement('button', {
            className: 'chat-picker__close',
            text: 'Отмена',
            attributes: { type: 'button' }
        });
        close.addEventListener('click', () => overlay.remove());

        box.appendChild(list);
        box.appendChild(close);
        overlay.appendChild(box);
        this.panel.appendChild(overlay);
    }

    /* ---------- переписка ---------- */

    async openChat(chat) {
        this.activeId = chat.id;
        this.panel.classList.add('chat-panel--thread');
        this.threadTitle.textContent = this.chatTitle(chat);
        this.threadPlaceholder.hidden = true;
        this.messagesEl.hidden = false;
        this.threadForm.hidden = false;
        this.messagesEl.innerHTML = '';
        this.input.value = '';

        this.stopMessages();
        this.messagesUnsub = subscribeMessages(chat.id, (messages) => {
            this.messages = messages;
            this.renderMessages();
            this.markChatRead(chat.id, messages);
        }, this.onSubError);

        setTimeout(() => this.input.focus(), 50);
    }

    closeChat() {
        this.activeId = null;
        this.stopMessages();
        this.panel.classList.remove('chat-panel--thread');
        this.threadTitle.textContent = 'Выберите диалог';
        this.threadPlaceholder.hidden = false;
        this.messagesEl.hidden = true;
        this.threadForm.hidden = true;
        this.messagesEl.innerHTML = '';
        this.input.value = '';
        this.renderList();
        this.updateBadge();
    }

    stopMessages() {
        if (this.messagesUnsub) {
            this.messagesUnsub();
            this.messagesUnsub = null;
        }
    }

    destroy() {
        for (const unsub of this.unsubs) {
            try { if (typeof unsub === 'function') unsub(); } catch (e) { /* ignore */ }
        }
        this.unsubs = [];
        this.stopMessages();
    }

    renderMessages() {
        if (!this.messagesEl) return;
        this.messagesEl.innerHTML = '';

        if (this.messages.length === 0) {
            this.messagesEl.appendChild(createElement('div', {
                className: 'chat-thread__empty',
                text: 'Сообщений пока нет'
            }));
            return;
        }

        for (const message of this.messages) {
            const own = message.authorId === this.user.uid;
            const bubble = createElement('div', {
                className: 'chat-msg' + (own ? ' chat-msg--own' : '')
            });

            if (!own) {
                const person = this.players[message.authorId] || {};
                bubble.appendChild(createAvatar(
                    person.username || message.authorName || 'user',
                    person.faction || message.faction || this.faction,
                    'chat-msg__avatar',
                    person.gender
                ));
            }

            const body = createElement('div', { className: 'chat-msg__body' });
            if (!own) {
                body.appendChild(createElement('div', {
                    className: 'chat-msg__author',
                    text: message.authorName || 'Агент'
                }));
            }
            body.appendChild(createElement('div', { className: 'chat-msg__text', text: message.text }));
            body.appendChild(createElement('div', {
                className: 'chat-msg__time',
                text: this.formatTime(message.createdAt)
            }));
            bubble.appendChild(body);
            this.messagesEl.appendChild(bubble);
        }

        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }

    markChatRead(chatId, messages) {
        const last = messages[messages.length - 1];
        if (!last) return;
        const ts = last.createdAt;
        if (this.lastRead[chatId] === ts) return;
        this.lastRead[chatId] = ts;
        markRead(this.user.uid, chatId, ts);
        this.updateBadge();
    }
}
