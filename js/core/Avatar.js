const COLORS = {
    purple: '7c3aed',
    blue: '1a73e8',
    red: 'dc2626'
};

export function getAvatarUrl(username, faction) {
    const bgColor = COLORS[faction] || COLORS.purple;
    const seed = encodeURIComponent(username || 'user');
    return `https://api.dicebear.com/9.x/personas/svg?seed=${seed}&backgroundColor=${bgColor}&backgroundType=gradientLinear&radius=50`;
}
