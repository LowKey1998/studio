/**
 * @fileOverview Utilities for calculating academic year and semester based on intake date and current date.
 */

import { parseISO, format, startOfMonth, addMonths, isSameMonth, endOfMonth } from 'date-fns';

export type AcademicCycle = {
    semester: number;
    startMonth: number; // 0-11
    endMonth: number;   // 0-11
};

export type Anomaly = {
    intakeId: string;
    year: number;
    semester: number;
    overrideStartDate: string;
};

/**
 * Robustly parses an intake name into a YYYY-MM-DD date string.
 * Supports formats like "2025JUL", "July 2025", "2024JAN", etc.
 */
export function parseIntakeDate(intakeName: string): string | null {
    if (!intakeName) return null;
    const yearMatch = intakeName.match(/\d{4}/);
    if (!yearMatch) return null;
    const year = yearMatch[0];

    const monthsMap: Record<string, string> = {
        'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04', 'MAY': '05', 'JUN': '06',
        'JUL': '07', 'AUG': '08', 'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12',
        'JANUARY': '01', 'FEBRUARY': '02', 'MARCH': '03', 'APRIL': '04', 'MAY': '05', 'JUNE': '06',
        'JULY': '07', 'AUGUST': '08', 'SEPTEMBER': '09', 'OCTOBER': '10', 'NOVEMBER': '11', 'DECEMBER': '12'
    };

    const upperName = intakeName.toUpperCase();
    let month = '01'; 
    for (const key in monthsMap) {
        if (upperName.includes(key)) {
            month = monthsMap[key];
            break;
        }
    }
    return `${year}-${month}-01`;
}

/**
 * Calculates the current study year and semester for a given intake.
 * Progression is calculated by identifying institutional cycle boundaries (e.g., Jan/July)
 * encountered strictly starting FROM the student's intake month.
 */
export function calculateAcademicState(
    intakeDateStr: string,
    currentDate: Date = new Date(),
    cycles: AcademicCycle[] = [
        { semester: 1, startMonth: 0, endMonth: 5 }, // Cycle 1 (e.g., Jan)
        { semester: 2, startMonth: 6, endMonth: 11 } // Cycle 2 (e.g., July)
    ],
    anomalies: Anomaly[] = []
) {
    if (!intakeDateStr) return { year: 1, semester: 1, isAnomaly: false, cyclesCounted: 0, identifiedMonth: 'N/A' };

    const intakeDate = startOfMonth(parseISO(intakeDateStr));
    const normalizedCurrentDate = startOfMonth(currentDate);
    
    // Check for specific anomalies first
    const activeAnomaly = anomalies.find(a => 
        format(parseISO(a.overrideStartDate), 'yyyy-MM') === format(normalizedCurrentDate, 'yyyy-MM')
    );

    if (activeAnomaly) {
        return { 
            year: activeAnomaly.year, 
            semester: activeAnomaly.semester, 
            isAnomaly: true, 
            cyclesCounted: 0, 
            identifiedMonth: format(intakeDate, 'MMMM') 
        };
    }

    const sortedCycles = [...cycles].sort((a, b) => a.startMonth - b.startMonth);
    const cycleStartMonths = sortedCycles.map(c => c.startMonth);

    // 1. Count distinct institutional boundaries encountered since intake month
    let cyclesCounted = 0;
    let checkDate = new Date(intakeDate);
    
    let iterations = 0;
    while ((checkDate < normalizedCurrentDate || isSameMonth(checkDate, normalizedCurrentDate)) && iterations < 600) {
        if (cycleStartMonths.includes(checkDate.getMonth())) {
            cyclesCounted++;
        }
        checkDate = addMonths(checkDate, 1);
        iterations++;
    }

    const cyclesPerYear = sortedCycles.length || 1;

    // 2. Determine Study Year
    // Study year is relative to the start. After 2 boundaries, the student enters Year 2.
    const academicYear = Math.ceil(cyclesCounted / cyclesPerYear);

    // 3. Determine Study Semester (Relative to student start)
    // 1st cycle encountered = Semester 1, 2nd = Semester 2, etc.
    const studySemester = ((cyclesCounted - 1) % (cyclesPerYear || 1)) + 1;

    return { 
        year: Math.max(1, academicYear), 
        semester: studySemester || 1,
        cyclesCounted,
        identifiedMonth: format(intakeDate, 'MMMM'),
        isAnomaly: false
    };
}

/**
 * Predicts the start and end dates for a specific Year and Semester relative to an intake date.
 */
export function calculateSemesterDateRange(
    intakeDateStr: string,
    targetYear: number,
    targetSemesterInYear: number,
    cycles: AcademicCycle[] = [
        { semester: 1, startMonth: 0, endMonth: 5 },
        { semester: 2, startMonth: 6, endMonth: 11 }
    ]
) {
    if (!intakeDateStr) return null;

    const intakeDate = startOfMonth(parseISO(intakeDateStr));
    const sortedCycles = [...cycles].sort((a, b) => a.startMonth - b.startMonth);
    const cycleStartMonths = sortedCycles.map(c => c.startMonth);
    const cyclesPerYear = sortedCycles.length || 1;

    // Determine total cycle index we need to find (e.g., Year 2, Sem 1 = 3rd cycle encounter)
    const targetCycleCount = (targetYear - 1) * cyclesPerYear + targetSemesterInYear;

    let cyclesFound = 0;
    let checkDate = new Date(intakeDate);
    let startDate: Date | null = null;
    
    let iterations = 0;
    while (cyclesFound < targetCycleCount && iterations < 1200) {
        if (cycleStartMonths.includes(checkDate.getMonth())) {
            cyclesFound++;
            if (cyclesFound === targetCycleCount) {
                startDate = new Date(checkDate);
                break;
            }
        }
        checkDate = addMonths(checkDate, 1);
        iterations++;
    }

    if (!startDate) return null;

    // Find the end date (last day of the 6th month if 2 cycles per year)
    const monthsPerSemester = Math.floor(12 / cyclesPerYear);
    const endDate = endOfMonth(addMonths(startDate, monthsPerSemester - 1));

    return { from: startDate, to: endDate };
}