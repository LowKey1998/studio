
import { eachDayOfInterval, format, addDays } from 'date-fns';

type Holiday = {
    name: string;
    date: string; // YYYY-MM-DD
};

// Calculates Easter Sunday for a given year (using the anonymous Gregorian algorithm)
const getEasterSunday = (year: number): Date => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
};

export const getZambianPublicHolidays = (year: number): Holiday[] => {
    const easterSunday = getEasterSunday(year);
    
    return [
        { name: "New Year's Day", date: `${year}-01-01` },
        { name: "Women's Day", date: `${year}-03-08` },
        { name: "International Women's Day", date: `${year}-03-09` },
        { name: "Youth Day", date: `${year}-03-12` },
        { name: "Good Friday", date: format(addDays(easterSunday, -2), 'yyyy-MM-dd') },
        { name: "Holy Saturday", date: format(addDays(easterSunday, -1), 'yyyy-MM-dd') },
        { name: "Easter Monday", date: format(addDays(easterSunday, 1), 'yyyy-MM-dd') },
        { name: "Labour Day", date: `${year}-05-01` },
        { name: "Africa Freedom Day", date: `${year}-05-25` },
        { name: "Heroes' Day", date: `${year}-07-03` }, // Note: This is an example, typically the first Monday of July
        { name: "Unity Day", date: `${year}-07-04` },   // Note: This is an example, typically the day after Heroes' day
        { name: "Farmers' Day", date: `${year}-08-07` }, // Note: This is an example, typically the first Monday of August
        { name: "National Prayer Day", date: `${year}-10-18` },
        { name: "Independence Day", date: `${year}-10-24` },
        { name: "Christmas Day", date: `${year}-12-25` },
    ];
};
