// src/utils/urlHelper.ts
export const parseRoomId = (input: string): string | null => {
    if (!input) return null;

    // Якщо це прямий код (напр. 123456)
    if (input.length >= 4 && input.length <= 8 && !input.includes('http')) {
        return input.toUpperCase();
    }

    // Якщо це повний URL: https://h5.play/works/mrc/index.html?p=1223344
    try {
        const url = new URL(input);
        return url.searchParams.get('p');
    } catch (e) {
        return null;
    }
};