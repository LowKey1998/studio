/**
 * @fileOverview Utilities for calculating academic year and semester based on intake date and current date.
 */

import { differenceInMonths, parseISO, format, startOfMonth, addMonths } from 'date-fns';

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
    
    // 1. Determine Starting Semester
    const startMonth = intakeDate.getMonth();
    const sortedCycles = [...cycles].sort((a, b) => a.startMonth - b.startMonth);
    
    // Find which cycle the intake started in
    const startCycle = [...sortedCycles].reverse().find(c => startMonth >= c.startMonth) || sortedCycles[0];
    
    // 2. Count months passed
    const totalMonthsPassed = differenceInMonths(normalizedCurrentDate, intakeDate);
    
    // 3. Calculate progression
    // We determine the current semester based on the month, then calculate the year 
    // by seeing how many times we've passed the "first" semester of the institutional cycle
    // relative to where we started.
    
    const currentMonth = normalizedCurrentDate.getMonth();
    const currentCycle = [...sortedCycles].reverse().find(c => currentMonth >= c.startMonth) || sortedCycles[0];
    
    // Check for specific anomalies
    const activeAnomaly = anomalies.find(a => 
        format(parseISO(a.overrideStartDate), 'yyyy-MM') === format(normalizedCurrentDate, 'yyyy-MM')
    );

    if (activeAnomaly) {
        return { year: activeAnomaly.year, semester: activeAnomaly.semester, isAnomaly: true };
    }

    // Year Calculation: 
    // If we start at Sem 2, and we are now at Sem 1, we are still in Year 1.
    // If we start at Sem 2, and we are now at Sem 2 (12 months later), we are in Year 2.
    // Basic formula: Every 12 months from the start date, the year increments.
    const academicYear = Math.floor(totalMonthsPassed / 12) + 1;

    return { 
        year: Math.max(1, academicYear), 
        semester: currentCycle.semester,
        isAnomaly: false
    };
}
