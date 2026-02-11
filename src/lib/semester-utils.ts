/**
 * @fileOverview Utilities for calculating academic year and semester based on intake date and current date.
 */

import { parseISO, format, startOfMonth, addMonths } from 'date-fns';

export type AcademicCycle = {
    semester: number;
    startMonth: number; // 0-11
};

export type Anomaly = {
    intakeId: string;
    year: number;
    semester: number;
    overrideStartDate: string;
};

/**
 * Calculates the current year and semester for a given intake.
 * Progression is calculated by counting institutional semester boundaries crossed.
 */
export function calculateAcademicState(
    intakeDateStr: string,
    currentDate: Date = new Date(),
    cycles: AcademicCycle[] = [
        { semester: 1, startMonth: 0 }, // Jan
        { semester: 2, startMonth: 6 }  // July
    ],
    anomalies: Anomaly[] = []
) {
    if (!intakeDateStr) return { year: 1, semester: 1, isAnomaly: false };

    const intakeDate = startOfMonth(parseISO(intakeDateStr));
    const normalizedCurrentDate = startOfMonth(currentDate);
    const sortedCycles = [...cycles].sort((a, b) => a.startMonth - b.startMonth);
    
    // Check for specific anomalies first
    const activeAnomaly = anomalies.find(a => 
        format(parseISO(a.overrideStartDate), 'yyyy-MM') === format(normalizedCurrentDate, 'yyyy-MM')
    );

    if (activeAnomaly) {
        return { year: activeAnomaly.year, semester: activeAnomaly.semester, isAnomaly: true };
    }

    // 1. Calculate total number of cycles passed since intake
    // We count how many institutional boundaries have been crossed since the intake date
    let cycleCount = 0;
    let checkDate = new Date(intakeDate);
    
    // Ensure we start counting from the very first month if it's a boundary
    while (checkDate <= normalizedCurrentDate) {
        const month = checkDate.getMonth();
        if (sortedCycles.some(c => c.startMonth === month)) {
            cycleCount++;
        }
        checkDate = addMonths(checkDate, 1);
    }

    // 2. Determine Year of study
    // For 2 semesters per year: 1-2 = Year 1, 3-4 = Year 2, etc.
    const academicYear = Math.ceil(cycleCount / sortedCycles.length);

    // 3. Determine current institutional semester (Jan or July cycle)
    const currentMonth = normalizedCurrentDate.getMonth();
    const currentCycle = [...sortedCycles].reverse().find(c => currentMonth >= c.startMonth) || sortedCycles[sortedCycles.length - 1];

    return { 
        year: Math.max(1, academicYear), 
        semester: currentCycle.semester,
        isAnomaly: false
    };
}
