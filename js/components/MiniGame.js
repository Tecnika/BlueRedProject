import { createElement } from '../utils/dom.js?v=10';

/** Мини-игра «повтори последовательность» (инженер / хакер) */
export function SequenceGame({ length = 4, timeLimit = 60, onSuccess, onFail }) {
    const root = createElement('div', { className: 'mini-game' });
    const status = createElement('div', { className: 'mini-game__status', text: 'Приготовьтесь...' });
    root.appendChild(status);

    const grid = createElement('div', { className: 'mini-game__grid' });
    const buttons = [];
    for (let i = 1; i <= 4; i++) {
        const btn = createElement('button', {
            className: 'mini-game__btn mini-game__btn--' + i,
            text: String(i),
            attributes: { type: 'button', disabled: '' }
        });
        buttons.push(btn);
        grid.appendChild(btn);
    }
    root.appendChild(grid);

    const sequence = Array.from({ length }, () => 1 + Math.floor(Math.random() * 4));
    let inputIndex = 0;
    let started = false;
    let finished = false;
    let deadline = 0;
    let timer = null;

    function finish(ok) {
        if (finished) return;
        finished = true;
        if (timer) clearInterval(timer);
        if (ok) onSuccess && onSuccess();
        else onFail && onFail();
    }

    async function showSequence() {
        for (const value of sequence) {
            if (finished) return;
            buttons[value - 1].classList.add('mini-game__btn--lit');
            await new Promise(r => setTimeout(r, 450));
            buttons[value - 1].classList.remove('mini-game__btn--lit');
            await new Promise(r => setTimeout(r, 180));
        }
        if (finished) return;
        started = true;
        deadline = Date.now() + timeLimit * 1000;
        buttons.forEach(b => { b.disabled = false; });
        status.textContent = 'Повторите последовательность';
    }

    buttons.forEach((btn, idx) => {
        btn.addEventListener('click', () => {
            if (!started || finished) return;
            if (idx + 1 !== sequence[inputIndex]) {
                status.textContent = 'Ошибка';
                finish(false);
                return;
            }
            btn.classList.add('mini-game__btn--lit');
            setTimeout(() => btn.classList.remove('mini-game__btn--lit'), 150);
            inputIndex += 1;
            if (inputIndex >= sequence.length) finish(true);
        });
    });

    timer = setInterval(() => {
        if (!started || finished) return;
        const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        status.textContent = `Осталось: ${left} с`;
        if (left <= 0) {
            status.textContent = 'Время вышло';
            finish(false);
        }
    }, 250);

    setTimeout(showSequence, 400);
    return root;
}

/** Мини-игра «поймай частоту» (связист) */
export function TunerGame({ rounds = 3, duration = 60, onSuccess, onFail }) {
    const root = createElement('div', { className: 'mini-game' });
    const status = createElement('div', { className: 'mini-game__status', text: 'Остановите маркер в зоне' });
    root.appendChild(status);

    const track = createElement('div', { className: 'mini-game__track' });
    const zone = createElement('div', { className: 'mini-game__zone' });
    const marker = createElement('div', { className: 'mini-game__marker' });
    track.appendChild(zone);
    track.appendChild(marker);
    root.appendChild(track);

    const stopBtn = createElement('button', {
        className: 'btn btn--primary btn--md mini-game__stop',
        text: 'Стоп',
        attributes: { type: 'button' }
    });
    root.appendChild(stopBtn);

    const zoneStart = 0.38;
    const zoneSize = 0.22;
    zone.style.left = (zoneStart * 100) + '%';
    zone.style.width = (zoneSize * 100) + '%';

    let pos = 0;
    let dir = 1;
    let speed = 0.012;
    let caught = 0;
    let finished = false;
    let raf = null;
    let startedAt = Date.now();

    function loop() {
        if (finished) return;
        pos += dir * speed;
        if (pos >= 1) { pos = 1; dir = -1; }
        if (pos <= 0) { pos = 0; dir = 1; }
        marker.style.left = (pos * 100) + '%';
        const left = Math.max(0, Math.ceil(duration - (Date.now() - startedAt) / 1000));
        if (left <= 0) return stop(false);
        raf = requestAnimationFrame(loop);
    }

    function stop(forceFail) {
        if (finished) return;
        const ok = !forceFail && pos >= zoneStart && pos <= zoneStart + zoneSize;
        if (ok) {
            caught += 1;
            status.textContent = `Поймано: ${caught} из ${rounds}`;
            if (caught >= rounds) {
                finished = true;
                cancelAnimationFrame(raf);
                onSuccess && onSuccess();
                return;
            }
            speed += 0.004;
        } else {
            status.textContent = 'Мимо!';
        }
        if (!ok && forceFail) {
            finished = true;
            cancelAnimationFrame(raf);
            onFail && onFail();
        }
    }

    stopBtn.addEventListener('click', () => stop(false));
    raf = requestAnimationFrame(loop);

    return root;
}
