// ========================
// ПАТТЕРНЫ (10 штук)
// ========================
const PATTERN_DOLBO = '[дД][оО0oO][лЛ][бБ6][аА@оО0oO][еЕёЁeEëË]{1,2}[бБ6bпП]';
const PATTERN_ZALUPA = '[зЗ3][аАaA@][лЛ][уУyY][пП][аАaA@уУyYоО0oOыЫ]';
const PATTERN_PIDOR = '[пП][иИ](?:[дД]|[тТ](?![еЕ][рРpP]))[оО0oOаАaA@еЕёЁeE]?[рРpP]';
const PATTERN_PIZD = '[пП][иИеЕ]?[зЗ3сС][дДтТ]';
const PATTERN_MANDA = '(?<![оО])[мМ][аАaA@][нНhH][дД][аАaA@оО0oO]';
const PATTERN_HUI = '[хХxX\u00D7][уУyY][лЛйЙёЁяЯеЕeEаАaA@][иИтТ]?(?![еЕтТгГсС]|[иИ][тТ][еЕсС])';
const PATTERN_BLYA = '(?<![нН][оО0oO])(?<![аА@еЕоОмМрРуУ])[бБ6пП][лЛ][яЯ](?![жЖсСшШкКюЮ])';
const PATTERN_EBA = '(?<![б-дБ-ДкКлЛмМнНпПрРсСтТцЧчЧшШщЩRrcC])[еЕёЁeEëË][бБ6bпП](?![иИ][тТ])(?![оО][чЧ][кК])(?![нН][аАеЕиИоОуУыЫэЭюЮяЯ]?(?![а-яА-Я]))[аАaA@еЕёЁëËиИкКнНоО0oOуУyYhH]';
const PATTERN_EBLO = '(?<![б-дБ-ДкКлЛмМнНпПрРсСтТцЧчЧшШщЩRrcC])[еЕёЁeEëË][бБ6bпП][лЛ][аА@нНоО0oOкК]';
const PATTERN_IBO = '(?<![аАлЛрРсСшШ])[иИ][бБ][оО0oO](?![кКлЛ\u0020])(?=[а-яА-Я])';

// Объединённая регулярка
const regex = new RegExp(
    `(${[
        PATTERN_DOLBO,
        PATTERN_ZALUPA,
        PATTERN_PIDOR,
        PATTERN_PIZD,
        PATTERN_MANDA,
        PATTERN_HUI,
        PATTERN_BLYA,
        PATTERN_EBA,
        PATTERN_EBLO,
        PATTERN_IBO
    ].join('|')})`,
    'g'
);