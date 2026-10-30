// чистый модуль без node-зависимостей: используется и на сервере, и в админке
const converter = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
}

export function transliterate(text) {
    return text.split('').map(char => {
        // Проверяем регистр, чтобы сохранить его в латинице
        const isUpperCase = char === char.toUpperCase();
        const lowerChar = char.toLowerCase();

        if (converter[lowerChar] !== undefined) {
            const converted = converter[lowerChar];
            return isUpperCase ? converted.charAt(0).toUpperCase() + converted.slice(1) : converted;
        }

        return char; // Оставляем без изменений (например, цифры или знаки)
    }).join('');
}
