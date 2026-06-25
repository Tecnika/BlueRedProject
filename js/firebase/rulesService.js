import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, orderBy, limit } from 'firebase/firestore';
import { getFirebase } from './firebase.js?v=3';

const SEED_RULES = [
    {
        type: 'general',
        title: 'Красные и Синие',
        content: 'Две фракции находятся в состоянии информационного конфликта.\n\n'
            + 'Красные — экспансия, наступление, активная разведка. Их контент обозначается тегом red.\n'
            + 'Синие — оборона, аналитика, контрразведка. Их контент обозначается тегом blue.\n\n'
            + 'Каждая фракция видит только свой контент. Пропаганда врага не маркируется — вы видите её как обычную информацию о фракции.\n'
            + 'Фиолетовые видят всё — они гаранты переговоров.',
        order: 1
    },
    {
        type: 'general',
        title: 'Фиолетовые',
        content: 'Фиолетовые — фракция-гарант переговоров.\n\n'
            + 'Они не участвуют в конфликте, но имеют доступ к контенту всех сторон.\n'
            + 'Их задача — обеспечивать коммуникацию между Красными и Синими,'
            + ' а также следить за соблюдением договорённостей.\n\n'
            + 'Только фиолетовые могут создавать документы, видимые обеим сторонам.',
        order: 2
    },
    {
        type: 'general',
        title: 'Документы',
        content: 'Документы — зашифрованные записи с ограниченным доступом.\n\n'
            + 'Шифрование: текст документа транслитерируется в латиницу — это фракционный шифр.\n'
            + 'Мастер видит оригинал и шифр, может переключаться между ними.\n\n'
            + 'Доступ к документу:\n'
            + '  — Мастер выдаёт доступ вручную\n'
            + '  — По QR-коду (ссылка с кодом доступа)\n'
            + '  — По номеру документа и 8-значному коду\n\n'
            + 'Пропаганда отображается как обычный текст, без маркировки.',
        order: 3
    },
    {
        type: 'general',
        title: 'Архив страниц',
        content: 'Архив — матрица страниц 3×3 с доступом по тегам.\n\n'
            + '— Базовый тег фракции (red/blue/purple) открывает общую информацию\n'
            + '— Составной тег (тег_фракция_уровень) открывает конкретную ячейку\n'
            + '— Скрытые теги и пропаганда не видны чужим фракциям\n\n'
            + 'Страницы бывают двух типов:\n'
            + '  • general — свободный контент с картинками\n'
            + '  • faction — матрица 3×3 для фракционного контента',
        order: 4
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
    const snapshot = await getDocs(query(collection(db, 'rules'), limit(1)));
    if (!snapshot.empty) return;

    for (const data of SEED_RULES) {
        const ref = doc(collection(db, 'rules'));
        await setDoc(ref, {
            ...data,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }
}
