
/**
 * @fileOverview Utilities for calculating academic year and semester based on intake date and current date.
 */

import { differenceInMonths, parseISO, format } from 'date-fns';

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
 * Logic:
 * 1. Calculate how many months have passed since the intake start.
 * 2. Academic Year = floor(monthsPassed / 12) + 1
 * 3. Semester = Based on current month vs institutional cycles.
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
    const intakeDate = parseISO(intakeDateStr);
    const monthsPassed = differenceInMonths(currentDate, intakeDate);
    
    const academicYear = Math.floor(monthsPassed / 12) + 1;
    const currentMonth = currentDate.getMonth();

    // Check for specific anomalies first
    const activeAnomaly = anomalies.find(a => 
        a.year === academicYear && 
        format(parseISO(a.overrideStartDate), 'yyyy-MM') === format(currentDate, 'yyyy-MM')
    );

    if (activeAnomaly) {
        return { year: activeAnomaly.year, semester: activeAnomaly.semester, isAnomaly: true };
    }

    // Determine semester based on the closest preceding cycle start
    const sortedCycles = [...cycles].sort((a, b) => b.startMonth - a.startMonth);
    const currentCycle = sortedCycles.find(c => currentMonth >= c.startMonth) || sortedCycles[0];

    return { 
        year: academicYear > 0 ? academicYear : 1, 
        semester: currentCycle.semester,
        isAnomaly: false
    };
}
