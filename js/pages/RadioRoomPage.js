import { createElement } from '../utils/dom.js?v=10';
import { translateError } from '../utils/translateError.js?v=10';
import { requireAuth } from '../components/PageLayout.js?v=10';
import { Button } from '../components/Button.js?v=10';
import { StatusMessage } from '../components/StatusMessage.js?v=10';
import { QRCode } from '../components/QRCode.js?v=10';
import { Icon } from '../components/Icon.js?v=10';
import { FACTION_LABELS } from '../utils/profile.js?v=10';
import {
    subscribeSession,
    getRecipientCode,
    isCodeValid,
    effectiveTrace,
    findTargetFaction,
    ensureCrossChat,
    setChannel
} from '../firebase/radioService.js?v=10';
import { subscribeMessages, sendMessage, logEvent } from '../firebase/chatService.js?v=10';

export function RadioRoomPage() {
    const section = createElement('section', { className: 'radio-page' });
    const user = requireAuth(section);
    if (!user) return section;

    const roomUid = new URLSearchParams(window.location.hash.split('?')[1] || '').get('room') || user.uid;
    const radioFaction = user.radioFaction;

    if (!radioFaction && user.role !== 'master') {
        section.appendChild(StatusMessage({ type: 'err', text: 'Это экран радиорубки. Войдите в аккаунт радиорубки.' }));
        return section;
    }
    if (!radioFaction) {
        section.appendChild(StatusMessage({ type: 'err', text: 'У аккаунта не указана фракция радиорубки.' }));
        return section;
    }

    const container = createElement('div', { className: 'radio-page__container' });
    container.appendChild(createElement('h1', {
        className: 'radio-page__title',
        text: `Радиорубка · ${FACTION_LABELS[radioFaction] || radioFaction}`
    }));
    container.appendChild(createElement('p', {
        className: 'radio-page__hint',
        text: 'Специалисты сканируют QR на своих телефонах. После двух доступов введите код получателя.'
    }));

    // QR для специалистов
    const qrRow = createElement('div', { className: 'radio-page__qr-row' });
    const baseUrl = window.location.origin + window.location.pathname;
    for (const role of [
        { key: 'engineer', label: 'Инженер' },
        { key: 'signalman', label: 'Связист' }
    ]) {
        const box = createElement('div', { className: 'radio-page__qr' });
        box.appendChild(createElement('div', { className: 'radio-page__qr-label', text: role.label }));
        box.appendChild(QRCode({
            data: `${baseUrl}#/radio/scan?room=${roomUid}&role=${role.key}`,
            size: 150
        }));
        qrRow.appendChild(box);
    }
    container.appendChild(qrRow);

    // Статусы доступов
    const statusRow = createElement('div', { className: 'radio-page__status-row' });
    const engineerEl = createElement('div', { className: 'radio-page__status' });
    const signalmanEl = createElement('div', { className: 'radio-page__status' });
    statusRow.appendChild(engineerEl);
    statusRow.appendChild(signalmanEl);
    container.appendChild(statusRow);

    const traceEl = createElement('div', { className: 'radio-page__trace' });
    container.appendChild(traceEl);

    // Код получателя
    const codeBox = createElement('div', { className: 'radio-page__code' });
    codeBox.appendChild(createElement('h2', { className: 'radio-page__subtitle', text: 'Код получателя' }));
    const codeInput = createElement('input', {
        className: 'radio-page__input',
        attributes: { type: 'text', inputmode: 'numeric', maxlength: 6, placeholder: '6 цифр', 'aria-label': 'Код получателя' }
    });
    const codeBtn = Button({ text: 'Открыть канал', icon: 'settings_input_antenna', variant: 'primary' });
    const codeMsg = StatusMessage({ type: 'ok', text: '', hidden: true });
    codeBox.appendChild(codeInput);
    codeBox.appendChild(codeBtn);
    codeBox.appendChild(codeMsg);
    container.appendChild(codeBox);

    // Канал
    const channelBox = createElement('div', { className: 'radio-page__channel', attributes: { hidden: '' } });
    container.appendChild(channelBox);

    section.appendChild(container);

    let session = {};
    let channelId = null;
    let messagesUnsub = null;

    function accessActive(access) {
        return Boolean(access && access.expiresAt && new Date(access.expiresAt).getTime() > Date.now());
    }

    function remaining(access) {
        if (!accessActive(access)) return 'нет';
        const sec = Math.max(0, Math.floor((new Date(access.expiresAt).getTime() - Date.now()) / 1000));
        return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    }

    function renderStatus(el, access, label, role) {
        el.innerHTML = '';
        const active = accessActive(access);
        el.className = 'radio-page__status' + (active ? ' radio-page__status--active' : '');
        el.appendChild(Icon({ name: active ? 'check_circle' : 'radio_button_unchecked', size: 'sm' }));
        el.appendChild(createElement('span', { text: `${label}: ${active ? access.name : 'ожидание'}` }));
        if (active) el.appendChild(createElement('span', { className: 'radio-page__timer', text: remaining(access) }));
        if (access && access.hacked) el.appendChild(createElement('span', { className: 'radio-page__hacked', text: 'взлом' }));
    }

    function updateStatus() {
        renderStatus(engineerEl, session.engineer, 'Инженер', 'engineer');
        renderStatus(signalmanEl, session.signalman, 'Связист', 'signalman');
        const trace = effectiveTrace(session);
        const discovered = Boolean(session.discovered) || trace >= 100;
        traceEl.textContent = discovered
            ? 'Радиорубка обнаружена! След: 100/100'
            : `След: ${trace}/100`;
        traceEl.classList.toggle('radio-page__trace--alarm', discovered);
        const both = accessActive(session.engineer) && accessActive(session.signalman);
        codeBox.hidden = !both;
        if (!both) {
            codeMsg.hidden = true;
            if (channelId) closeChannel();
        }
    }

    function closeChannel() {
        channelId = null;
        channelBox.hidden = true;
        channelBox.innerHTML = '';
        if (messagesUnsub) {
            messagesUnsub();
            messagesUnsub = null;
        }
    }

    function channelTitle(id) {
        const parts = String(id || '').replace(/^cross_/, '').split('_').filter(Boolean);
        return 'Связь: ' + parts.map(f => FACTION_LABELS[f] || f).join(' ↔ ');
    }

    async function openChannel(id) {
        if (channelId === id) return;
        channelId = id;
        channelBox.hidden = false;
        channelBox.innerHTML = '';

        channelBox.appendChild(createElement('h2', { className: 'radio-page__subtitle', text: 'Канал открыт' }));

        const messagesEl = createElement('div', { className: 'radio-page__messages' });
        channelBox.appendChild(messagesEl);

        const form = createElement('form', { className: 'radio-page__form' });
        const input = createElement('input', {
            className: 'radio-page__input',
            attributes: { type: 'text', placeholder: 'Сообщение...', 'aria-label': 'Сообщение' }
        });
        form.appendChild(input);
        form.appendChild(Button({ text: 'Отправить', icon: 'send', variant: 'primary', attributes: { type: 'submit' } }));
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = input.value.trim();
            if (!text) return;
            input.value = '';
            try {
                await sendMessage(id, text, {
                    uid: user.uid,
                    // Радиорубка — терминал фракции, а не персонаж оператора
                    name: `Радиорубка · ${FACTION_LABELS[radioFaction] || radioFaction}`,
                    faction: radioFaction
                }, { type: 'cross', title: channelTitle(id) });
            } catch (err) {
                console.warn('Не удалось отправить:', translateError(err));
            }
        });
        channelBox.appendChild(form);

        if (messagesUnsub) messagesUnsub();
        messagesUnsub = subscribeMessages(id, (messages) => {
            messagesEl.innerHTML = '';
            if (messages.length === 0) {
                messagesEl.appendChild(createElement('div', { className: 'radio-page__empty', text: 'Нет сообщений' }));
                return;
            }
            for (const m of messages) {
                const row = createElement('div', { className: 'radio-page__message' });
                row.appendChild(createElement('span', { className: 'radio-page__message-author', text: m.authorName || 'Агент' }));
                row.appendChild(createElement('span', { className: 'radio-page__message-text', text: m.text }));
                messagesEl.appendChild(row);
            }
            messagesEl.scrollTop = messagesEl.scrollHeight;
        });
    }

    codeBtn.addEventListener('click', async () => {
        codeMsg.hidden = true;
        try {
            const code = await getRecipientCode(codeInput.value.trim());
            if (!isCodeValid(code)) {
                codeMsg.textContent = 'Код не найден или истёк';
                codeMsg.className = 'msg msg--err';
                codeMsg.hidden = false;
                return;
            }
            const targetFaction = await findTargetFaction(code);
            if (!targetFaction) {
                codeMsg.textContent = 'У получателя не указана фракция';
                codeMsg.className = 'msg msg--err';
                codeMsg.hidden = false;
                return;
            }
            const id = await ensureCrossChat(radioFaction, targetFaction);
            await setChannel(roomUid, id, code.code);
            await logEvent({
                chatTitle: 'Радиорубка',
                authorId: user.uid,
                authorName: user.username,
                text: `Канал открыт: ${FACTION_LABELS[radioFaction]} ↔ ${FACTION_LABELS[targetFaction]} (код ${code.code})`
            });
            codeInput.value = '';
            await openChannel(id);
        } catch (err) {
            codeMsg.textContent = 'Ошибка: ' + translateError(err);
            codeMsg.className = 'msg msg--err';
            codeMsg.hidden = false;
        }
    });

    const unsub = subscribeSession(roomUid, (data) => {
        session = data || {};
        updateStatus();
        if (session.channelId && accessActive(session.engineer) && accessActive(session.signalman)) {
            openChannel(session.channelId);
        }
    });

    const timer = setInterval(() => {
        if (!document.body.contains(section)) {
            clearInterval(timer);
            if (unsub) unsub();
            if (messagesUnsub) messagesUnsub();
            return;
        }
        updateStatus();
    }, 1000);

    updateStatus();
    return section;
}
