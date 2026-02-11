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
 * Progression is calculated by counting institutional semester boundaries crossed starting FROM the intake month.
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

    // Normalize dates to start of month for comparison
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

    // 1. Count how many institutional boundaries have been hit since the intake month inclusive.
    // We start the count FROM the month the student actually arrived.
    let cycleCount = 0;
    let checkDate = new Date(intakeDate);
    
    while (checkDate <= normalizedCurrentDate) {
        const month = checkDate.getMonth();
        // Does this month represent a start of a new institutional semester?
        if (sortedCycles.some(c => c.startMonth === month)) {
            cycleCount++;
        }
        checkDate = addMonths(checkDate, 1);
    }

    // 2. Determine Year of study
    // If there are 2 cycles per year, hits 1 and 2 are Year 1, hits 3 and 4 are Year 2, etc.
    const academicYear = Math.ceil(cycleCount / sortedCycles.length);

    // 3. Determine the actual institutional semester (Jan cycle or July cycle)
    // This is simply the cycle associated with the current month.
    const currentMonth = normalizedCurrentDate.getMonth();
    const currentCycle = [...sortedCycles].reverse().find(c => currentMonth >= c.startMonth) || sortedCycles[sortedCycles.length - 1];

    return { 
        year: Math.max(1, academicYear), 
        semester: currentCycle.semester,
        isAnomaly: false
    };
}
