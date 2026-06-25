import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, orderBy, limit } from 'firebase/firestore';
import { getFirebase } from './firebase.js?v=3';

const SEED_RULES = [
    {
        type: 'general',
        title: 'Фракции',
        content: 'В секторе действуют три расы: Красные, Синие и Фиолетовые.\n\n'
            + 'Красные и Синие — две расы, каждая со своим укладом. '
            + 'У них разные взгляды на многие вещи, и это иногда приводит к разногласиям. '
            + 'Однако обе стороны остаются частью общего пространства.\n\n'
            + 'Фиолетовые занимают особое положение. '
            + 'Встречи представителей разных рас проходят на их территории — '
            + 'дрейфующем в космосе шатле. '
            + 'Фиолетовые следят за порядком и помогают сторонам договариваться.',
        order: 1
    },
    {
        type: 'general',
        title: 'Документы',
        content: 'Документы — это записи с ограниченным доступом. '
            + 'Каждый документ имеет номер и код доступа.\n\n'
            + 'Текст может быть написан на разных языках — '
            + 'у каждой расы своя письменность. '
            + 'При необходимости текст можно переключить на привычное отображение.\n\n'
            + 'Доступ к документу можно получить несколькими способами:\n'
            + '  — Через ответственное лицо\n'
            + '  — По специальной ссылке\n'
            + '  — По номеру документа и коду доступа\n\n'
            + 'Уровни доступа:\n'
            + '  — Чтение (просмотр содержимого)\n'
            + '  — Полный доступ (чтение + просмотр оригинала)',
        order: 2
    },
    {
        type: 'general',
        title: 'Архив страниц',
        content: 'Архив — это хранилище информации. '
            + 'Страницы в архиве разделены по темам.\n\n'
            + 'Есть два типа страниц:\n'
            + '  — Общие страницы со свободным контентом\n'
            + '  — Страницы фракций, где информация структурирована по разделам\n\n'
            + 'Страницы могут быть вложенными — внутри одной страницы могут находиться другие.',
        order: 3
    },
    {
        type: 'site',
        title: 'Правила работы с сайтом',
        content: 'Раздел будет заполнен мастерами. Содержит правила использования сайта.',
        order: 4
    },
    {
        type: 'hidden',
        title: 'Скрытые механики',
        content: 'Раздел будет заполнен мастерами.',
        order: 5
    }
];

export async function getAllRules(typeFilter) {
    const { db } = getFirebase();
    const constraints = [orderBy('order')];
    if (typeFilter) {
        const { where } = await import('firebase/firestore');
        constraints.unshift(where('type', '==', typeFilter));
    }
    const snapshot = await getDocs(query(collection(db, 'rules'), ...constraints));
    const rules = [];
    snapshot.forEach(d => rules.push({ id: d.id, ...d.data() }));
    return rules;
}

export async function getRule(id) {
    const { db } = getFirebase();
    const snap = await getDoc(doc(db, 'rules', id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
}

export async function createRule(data) {
    const { db } = getFirebase();
    const ref = doc(collection(db, 'rules'));
    const payload = {
        type: data.type || 'general',
        title: data.title.trim(),
        content: data.content.trim(),
        order: data.order || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    await setDoc(ref, payload);
    return { id: ref.id, ...payload };
}

export async function updateRule(id, data) {
    const { db } = getFirebase();
    const updates = {};
    if (data.title !== undefined) updates.title = data.title.trim();
    if (data.content !== undefined) updates.content = data.content.trim();
    if (data.order !== undefined) updates.order = data.order;
    if (data.type !== undefined) updates.type = data.type;
    updates.updatedAt = new Date().toISOString();
    await setDoc(doc(db, 'rules', id), updates, { merge: true });
    return { id, ...updates };
}

export async function deleteRule(id) {
    const { db } = getFirebase();
    await deleteDoc(doc(db, 'rules', id));
}

export async function seedInitialRules() {
    const { db } = getFirebase();
    const snapshot = await getDocs(collection(db, 'rules'));
    const existing = {};
    snapshot.forEach(d => existing[d.data().title] = { id: d.id, ...d.data() });

    const seen = new Set();

    for (const data of SEED_RULES) {
        seen.add(data.title);
        const now = new Date().toISOString();

        if (existing[data.title]) {
            const old = existing[data.title];
            if (old.type !== data.type || old.content !== data.content || old.order !== data.order) {
                await setDoc(doc(db, 'rules', old.id), {
                    type: data.type,
                    title: data.title,
                    content: data.content,
                    order: data.order,
                    updatedAt: now
                }, { merge: true });
            }
        } else {
            const ref = doc(collection(db, 'rules'));
            await setDoc(ref, {
                ...data,
                createdAt: now,
                updatedAt: now
            });
        }
    }

    for (const [title, rule] of Object.entries(existing)) {
        if (!seen.has(title)) {
            await deleteDoc(doc(db, 'rules', rule.id));
        }
    }
}
