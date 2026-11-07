import { createElement } from '../utils/dom.js?v=10';
import { translateError } from '../utils/translateError.js?v=10';
import { requireAuth } from '../components/PageLayout.js?v=10';
import { Button } from '../components/Button.js?v=10';
import { StatusMessage } from '../components/StatusMessage.js?v=10';
import { SequenceGame, TunerGame } from '../components/MiniGame.js?v=10';
import { getActiveGame, getActiveFaction } from '../utils/profile.js?v=10';
import { getCharacterForPlayer } from '../firebase/charactersService.js?v=10';
import {
    grantAccess,
    addTrace,
    createRecipientCode,
    listRecipientCodes,
    isCodeValid
} from '../firebase/radioService.js?v=10';
import { logEvent } from '../firebase/chatService.js?v=10';

const ROLE_LABELS = { engineer: 'Инженер', signalman: 'Связист' };

export async function RadioScanPage() {
    const section = createElement('section', { className: 'radio-page radio-page--scan' });
    const user = requireAuth(section);
    if (!user) return section;

    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const roomUid = params.get('room');
    const role = params.get('role');

    if (!roomUid || !['engineer', 'signalman'].includes(role)) {
        section.appendChild(StatusMessage({ type: 'err', text: 'Неверный QR радиорубки' }));
        return section;
    }

    const container = createElement('div', { className: 'radio-page__container' });
    container.appendChild(createElement('h1', { className: 'radio-page__title', text: `Радиорубка · ${ROLE_LABELS[role]}` }));
    section.appendChild(container);

    let profession = '';
    try {
        const game = getActiveGame();
        if (game) {
            const character = await getCharacterForPlayer(game.id, user.uid);
            profession = (character?.profession || '').toLowerCase();
        }
    } catch (e) { /* нет персонажа */ }

    const isEngineer = profession.includes('инженер');
    const isSignalman = profession.includes('связист');
    const isHacker = profession.includes('хакер');
    const canPlay = (role === 'engineer' && isEngineer) || (role === 'signalman' && isSignalman);

    container.appendChild(createElement('p', {
        className: 'radio-page__hint',
        text: 'Мини-игра даёт доступ на 20 минут. Код получателя действует 3 часа.'
    }));

    const area = createElement('div', { className: 'radio-scan__area' });
    container.appendChild(area);
    const msg = StatusMessage({ type: 'ok', text: '', hidden: true });
    container.appendChild(msg);

    function show(text, type = 'ok') {
        msg.textContent = text;
        msg.className = `msg msg--${type}`;
        msg.hidden = false;
    }

    if (canPlay) {
        area.appendChild(createElement('div', {
            className: 'radio-scan__lead',
            text: role === 'engineer' ? 'Соберите цепь: повторите последовательность' : 'Поймайте частоту три раза'
        }));

        const game = role === 'engineer'
            ? SequenceGame({
                length: 4,
                timeLimit: 60,
                onSuccess: async () => {
                    try {
                        await grantAccess(roomUid, role, { uid: user.uid, name: user.username }, { minutes: 20 });
                        show('Доступ открыт на 20 минут');
                        area.innerHTML = '';
                    } catch (err) { show('Ошибка: ' + translateError(err), 'err'); }
                },
                onFail: () => show('Провал. Попробуйте снова', 'err')
            })
            : TunerGame({
                rounds: 3,
                duration: 60,
                onSuccess: async () => {
                    try {
                        await grantAccess(roomUid, role, { uid: user.uid, name: user.username }, { minutes: 20 });
                        show('Доступ открыт на 20 минут');
                        area.innerHTML = '';
                    } catch (err) { show('Ошибка: ' + translateError(err), 'err'); }
                },
                onFail: () => show('Провал. Попробуйте снова', 'err')
            });
        area.appendChild(game);
        return section;
    }

    if (isHacker) {
        container.appendChild(createElement('h2', { className: 'radio-page__subtitle', text: 'Взлом' }));
        container.appendChild(createElement('p', {
            className: 'radio-page__hint',
            text: 'Каждое действие повышает след. При 100 радиорубка будет обнаружена.'
        }));

        const hackBox = createElement('div', { className: 'radio-scan__hacks' });

        // A. Свой код
        hackBox.appendChild(Button({
            text: 'Свой код (3 ч)',
            icon: 'vpn_key',
            variant: 'secondary',
            onClick: async () => {
                try {
                    const result = await createRecipientCode(
                        { uid: user.uid, name: user.username },
                        getActiveFaction()
                    );
                    show(`Ваш код: ${result.code} (до ${new Date(result.expiresAt).toLocaleTimeString('ru-RU')})`);
                    await logEvent({
                        chatTitle: 'Взлом',
                        authorId: user.uid,
                        authorName: user.username,
                        text: 'сгенерировал свой код получателя'
                    });
                } catch (err) { show('Ошибка: ' + translateError(err), 'err'); }
            }
        }));

        // B. Кража кода
        hackBox.appendChild(Button({
            text: 'Кража кода',
            icon: 'content_copy',
            variant: 'secondary',
            onClick: async () => {
                try {
                    const codes = (await listRecipientCodes()).filter(c => isCodeValid(c) && c.ownerId !== user.uid);
                    if (codes.length === 0) { show('Нет доступных кодов', 'err'); return; }
                    const target = codes[Math.floor(Math.random() * codes.length)];
                    const success = Math.random() < 0.7;
                    if (success) {
                        show(`Украден код: ${target.code} (${target.ownerName})`);
                        await logEvent({
                            chatTitle: 'Взлом',
                            authorId: user.uid,
                            authorName: user.username,
                            text: `украл код ${target.code} у ${target.ownerName}`
                        });
                    } else {
                        const trace = await addTrace(roomUid, 40);
                        show(`Провал. Тревога! След: ${trace}/100`, 'err');
                        await logEvent({
                            chatTitle: 'Взлом',
                            authorId: user.uid,
                            authorName: user.username,
                            text: 'провалил кражу кода (тревога)'
                        });
                    }
                } catch (err) { show('Ошибка: ' + translateError(err), 'err'); }
            }
        }));

        // C. Подмена специалиста
        const subBox = createElement('div', { className: 'radio-scan__sub' });
        subBox.appendChild(createElement('div', { className: 'radio-scan__lead', text: 'Подмена специалиста (10 мин, сложнее):' }));
        for (const [key, label] of Object.entries(ROLE_LABELS)) {
            subBox.appendChild(Button({
                text: label,
                variant: 'secondary',
                size: 'sm',
                onClick: () => {
                    area.innerHTML = '';
                    area.appendChild(SequenceGame({
                        length: 5,
                        timeLimit: 30,
                        onSuccess: async () => {
                            try {
                                await grantAccess(roomUid, key, { uid: user.uid, name: user.username }, { minutes: 10, hacked: true });
                                const trace = await addTrace(roomUid, 25);
                                show(`Подмена «${label}» на 10 минут. След: ${trace}/100`);
                                await logEvent({
                                    chatTitle: 'Взлом',
                                    authorId: user.uid,
                                    authorName: user.username,
                                    text: `подменил специалиста «${label}»`
                                });
                            } catch (err) { show('Ошибка: ' + translateError(err), 'err'); }
                        },
                        onFail: async () => {
                            const trace = await addTrace(roomUid, 25);
                            show(`Подмена провалена. След: ${trace}/100`, 'err');
                        }
                    }));
                }
            }));
        }
        hackBox.appendChild(subBox);
        container.appendChild(hackBox);

        // Для роли, к которой нет профессии
        area.appendChild(createElement('div', {
            className: 'radio-scan__lead',
            text: `Ваша профессия — хакер. Доступ «${ROLE_LABELS[role]}» можно получить только подменой.`
        }));
        return section;
    }

    container.appendChild(StatusMessage({
        type: 'err',
        text: `Нужна профессия «${ROLE_LABELS[role]}». Обратитесь к специалисту.`
    }));
    return section;
}
