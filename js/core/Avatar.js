const COLORS = {
    purple: { bg: '#7c3aed', text: '#ffffff' },
    blue: { bg: '#1a73e8', text: '#ffffff' },
    red: { bg: '#dc2626', text: '#ffffff' }
};

export function generateAvatarSVG(username, faction) {
    const letter = username ? username.charAt(0).toUpperCase() : '?';
    const color = COLORS[faction] || COLORS.purple;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
        <rect width="96" height="96" rx="48" fill="${color.bg}"/>
        <text x="48" y="48" text-anchor="middle" dominant-baseline="central"
              font-size="42" font-weight="700" fill="${color.text}"
              font-family="sans-serif">${letter}</text>
    </svg>`;

    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}
