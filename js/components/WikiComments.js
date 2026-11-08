import { createElement } from '../utils/dom.js?v=27';
import { store } from '../core/Store.js?v=27';
import { createAvatar } from '../core/Avatar.js?v=27';
import { Icon } from './Icon.js?v=27';
import { Button } from './Button.js?v=27';
import { StatusMessage, showMessage } from './StatusMessage.js?v=27';
import { translateError } from '../utils/translateError.js?v=27';
import { FactionBadge } from './FactionBadge.js?v=27';
import { ROLE_LABELS } from '../utils/constants.js?v=27';
import { getAllPublicPlayers } from '../firebase/publicPlayersService.js?v=27';
import {
    getWikiComments,
    addWikiComment,
    setWikiCommentVisible,
    deleteWikiComment
} from '../firebase/wikiCommentsService.js?v=27';

function formatTime(iso) {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });
}

export async function WikiComments({ targetType, targetId, rulesWiki = false }) {
    const user = store.get('user');
    const section = createElement('section', {
        className: 'wiki-comments',
        attributes: { id: 'wiki-comments' }
    });

    if (!user) return section;

    const isMaster = user.role === 'master';
    const canMarkForAll = rulesWiki && isMaster;
    let photoMap = {};
    try {
        const players = await getAllPublicPlayers();
        for (const player of players) photoMap[player.uid] = player.photo || null;
    } catch (e) { /* без фото */ }

    const header = createElement('div', { className: 'wiki-comments__header' });
    header.appendChild(createElement('h2', { className: 'wiki-comments__title', text: 'Обсуждение' }));
    const countEl = createElement('span', { className: 'wiki-comments__count', text: '' });
    header.appendChild(countEl);
    section.appendChild(header);

    const note = createElement('p', { className: 'wiki-comments__note' });
    note.textContent = canMarkForAll
        ? 'Комментарии видны вашей фракции. Мастер может пометить комментарий как «Для всех».'
        : 'Комментарий увидят ваша фракция и мастера.';
    section.appendChild(note);

    const list = createElement('div', { className: 'wiki-comments__list', text: 'Загрузка...' });
    section.appendChild(list);

    const msg = StatusMessage({ type: 'ok', text: '', hidden: true });
    section.appendChild(msg);

    let comments = [];

    const authorName = () => {
        const character = store.get('character');
        if (character?.name) return character.name;
        const p = user.player || {};
        return [p.firstName, p.lastName].filter(Boolean).join(' ') || user.username || 'Агент';
    };

    function buildTree() {
        const map = new Map();
        for (const comment of comments) {
            map.set(comment.id, { ...comment, children: [] });
        }
        const roots = [];
        for (const node of map.values()) {
            if (node.parentId && map.has(node.parentId)) {
                map.get(node.parentId).children.push(node);
            } else {
                roots.push(node);
            }
        }
        return roots;
    }

    function renderComment(comment) {
        const item = createElement('article', { className: 'wiki-comment' });

        const main = createElement('div', { className: 'wiki-comment__main' });
        main.appendChild(createAvatar(
            comment.authorName || 'agent',
            comment.faction || null,
            'wiki-comment__avatar',
            null,
            photoMap[comment.authorId] || null
        ));

        const body = createElement('div', { className: 'wiki-comment__body' });
        const head = createElement('div', { className: 'wiki-comment__head' });
        head.appendChild(createElement('span', {
            className: 'wiki-comment__author',
            text: comment.authorName || 'Агент'
        }));
        head.appendChild(createElement('span', {
            className: 'wiki-comment__role',
            text: ROLE_LABELS[comment.authorRole] || comment.authorRole || 'Игрок'
        }));
        if (comment.faction) {
            head.appendChild(FactionBadge({ faction: comment.faction, size: 'sm' }));
        }
        if (comment.visibleToAll) {
            const allBadge = createElement('span', { className: 'wiki-comment__all' });
            allBadge.appendChild(Icon({ name: 'public', size: 'sm' }));
            allBadge.appendChild(createElement('span', { text: 'Для всех' }));
            head.appendChild(allBadge);
        }
        head.appendChild(createElement('span', {
            className: 'wiki-comment__time',
            text: formatTime(comment.createdAt)
        }));
        body.appendChild(head);

        body.appendChild(createElement('div', {
            className: 'wiki-comment__text',
            text: comment.text || ''
        }));

        const actions = createElement('div', { className: 'wiki-comment__actions' });
        const replyBtn = createElement('button', {
            className: 'wiki-comment__action',
            text: 'Ответить',
            attributes: { type: 'button' }
        });
        actions.appendChild(replyBtn);

        if (canMarkForAll) {
            actions.appendChild(createElement('button', {
                className: 'wiki-comment__action',
                text: comment.visibleToAll ? 'Только фракция' : 'Для всех',
                attributes: { type: 'button' },
                events: {
                    click: async () => {
                        try {
                            await setWikiCommentVisible(comment.id, !comment.visibleToAll);
                            await load();
                        } catch (err) {
                            showMessage(msg, 'Ошибка: ' + translateError(err), 'err');
                        }
                    }
                }
            }));
        }

        if (isMaster) {
            actions.appendChild(createElement('button', {
                className: 'wiki-comment__action wiki-comment__action--danger',
                text: 'Удалить',
                attributes: { type: 'button' },
                events: {
                    click: async () => {
                        if (!confirm('Удалить комментарий?')) return;
                        try {
                            await deleteWikiComment(comment.id);
                            await load();
                        } catch (err) {
                            showMessage(msg, 'Ошибка: ' + translateError(err), 'err');
                        }
                    }
                }
            }));
        }
        body.appendChild(actions);
        main.appendChild(body);
        item.appendChild(main);

        const replyBox = createElement('div', { className: 'wiki-comment__reply', attributes: { hidden: '' } });
        item.appendChild(replyBox);
        replyBtn.addEventListener('click', () => {
            replyBox.hidden = !replyBox.hidden;
            if (!replyBox.hidden && !replyBox.dataset.ready) {
                replyBox.dataset.ready = '1';
                replyBox.appendChild(commentForm(comment.id, 'Ответить...', () => {
                    replyBox.hidden = true;
                }));
            }
        });

        if (comment.children.length) {
            const children = createElement('div', { className: 'wiki-comment__children' });
            for (const child of comment.children) {
                children.appendChild(renderComment(child));
            }
            item.appendChild(children);
        }

        return item;
    }

    function commentForm(parentId, placeholder, onCancel) {
        const form = createElement('form', { className: 'wiki-comment-form' });
        const textarea = createElement('textarea', {
            className: 'wiki-comment-form__textarea',
            attributes: { rows: 3, placeholder, 'aria-label': 'Комментарий' }
        });
        const actions = createElement('div', { className: 'wiki-comment-form__actions' });
        const send = Button({
            text: 'Отправить',
            icon: 'send',
            variant: 'primary',
            size: 'sm',
            attributes: { type: 'submit' }
        });
        actions.appendChild(send);
        if (onCancel) {
            const cancel = createElement('button', {
                className: 'wiki-comment__action',
                text: 'Отмена',
                attributes: { type: 'button' }
            });
            cancel.addEventListener('click', onCancel);
            actions.appendChild(cancel);
        }
        form.appendChild(textarea);
        form.appendChild(actions);

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const text = textarea.value.trim();
            if (!text) return;
            send.disabled = true;
            try {
                await addWikiComment({
                    targetType,
                    targetId,
                    parentId,
                    text,
                    user,
                    authorName: authorName()
                });
                textarea.value = '';
                await load();
                if (onCancel) onCancel();
            } catch (err) {
                showMessage(msg, 'Ошибка: ' + translateError(err), 'err');
            } finally {
                send.disabled = false;
            }
        });

        return form;
    }

    function renderList() {
        list.innerHTML = '';
        countEl.textContent = comments.length ? String(comments.length) : '';

        if (comments.length === 0) {
            list.appendChild(createElement('div', {
                className: 'wiki-comments__empty',
                text: 'Комментариев пока нет'
            }));
            return;
        }

        for (const root of buildTree()) {
            list.appendChild(renderComment(root));
        }
    }

    async function load() {
        try {
            comments = await getWikiComments(targetType, targetId, user);
            renderList();
        } catch (err) {
            list.textContent = 'Ошибка загрузки комментариев: ' + translateError(err);
        }
    }

    const rootForm = createElement('div', { className: 'wiki-comments__new' });
    rootForm.appendChild(createElement('h3', {
        className: 'wiki-comments__new-title',
        text: 'Оставить комментарий'
    }));
    rootForm.appendChild(commentForm(null, 'Ваш комментарий...', null));
    section.appendChild(rootForm);

    await load();
    return section;
}
