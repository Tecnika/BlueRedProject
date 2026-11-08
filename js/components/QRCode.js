import { createElement } from '../utils/dom.js?v=21';

export function QRCode({ data, size = 200 }) {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
    return createElement('img', {
        className: 'qr',
        attributes: { src: url, alt: 'QR-код', width: size, height: size }
    });
}
