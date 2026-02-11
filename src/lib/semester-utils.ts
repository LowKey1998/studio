/**
 * @fileOverview Utilities for calculating academic year and semester based on intake date and current date.
 */

import { parseISO, format, startOfMonth, addMonths, differenceInMonths } from 'date-fns';

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

    // Normalize dates to start of month
    const intakeDate = startOfMonth(parseISO(intakeDateStr));
    const normalizedCurrentDate = startOfMonth(currentDate);
    
    // Sort cycles by month
    const sortedCycles = [...cycles].sort((a, b) => a.startMonth - b.startMonth);
    
    // Check for specific anomalies first
    const activeAnomaly = anomalies.find(a => 
        format(parseISO(a.overrideStartDate), 'yyyy-MM') === format(normalizedCurrentDate, 'yyyy-MM')
    );

    if (activeAnomaly) {
        return { year: activeAnomaly.year, semester: activeAnomaly.semester, isAnomaly: true };
    }

    // 1. Identify which cycle the student started in
    const intakeMonth = intakeDate.getMonth();
    const startingCycle = [...sortedCycles].reverse().find(c => intakeMonth >= c.startMonth) || sortedCycles[sortedCycles.length - 1];

    // 2. Count boundaries crossed
    // We count every month from intake to current. If month == a cycle start, count it.
    let boundariesCrossed = 0;
    let checkDate = new Date(intakeDate);
    
    let iterations = 0;
    while (checkDate <= normalizedCurrentDate && iterations < 600) {
        const currentMonth = checkDate.getMonth();
        if (sortedCycles.some(c => c.startMonth === currentMonth)) {
            boundariesCrossed++;
        }
        checkDate = addMonths(checkDate, 1);
        iterations++;
    }

    // 3. Determine Year
    // If there are 2 cycles, hit 1 & 2 are Year 1, hit 3 & 4 are Year 2.
    const academicYear = Math.ceil(boundariesCrossed / (sortedCycles.length || 1));

    // 4. Determine current semester type
    const currentMonth = normalizedCurrentDate.getMonth();
    const currentCycle = [...sortedCycles].reverse().find(c => currentMonth >= c.startMonth) || sortedCycles[sortedCycles.length - 1];

    return { 
        year: Math.max(1, academicYear), 
        semester: currentCycle.semester,
        isAnomaly: false
    };
}
