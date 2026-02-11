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
 * 
 * Logic:
 * - A "Semester Count" increments every time today's date passes a month defined in the institutional cycle.
 * - Year = ceil(SemesterCount / number_of_cycles_per_year)
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

    // 1. Calculate how many institutional cycle starts have been passed since the intake started
    let semesterCount = 0;
    let checkDate = new Date(intakeDate);
    
    // Iterate month by month from intake start to current date
    while (checkDate <= normalizedCurrentDate) {
        const month = checkDate.getMonth();
        if (sortedCycles.some(c => c.startMonth === month)) {
            semesterCount++;
        }
        checkDate = addMonths(checkDate, 1);
    }

    // 2. Calculate Year based on cycles completed
    // If there are 2 cycles per year, the 1st and 2nd semesters of study are Year 1.
    const academicYear = Math.ceil(semesterCount / sortedCycles.length);

    // 3. Determine the institutional semester number based on the current month
    const currentMonth = normalizedCurrentDate.getMonth();
    const currentCycle = [...sortedCycles].reverse().find(c => currentMonth >= c.startMonth) || sortedCycles[0];

    return { 
        year: Math.max(1, academicYear), 
        semester: currentCycle.semester,
        isAnomaly: false
    };
}
