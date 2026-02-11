/**
 * @fileOverview Utilities for calculating academic year and semester based on intake date and current date.
 */

import { parseISO, format, startOfMonth, addMonths, isSameMonth } from 'date-fns';

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
 * Calculates the current year and semester for a given intake.
 * Progression is calculated by identifying institutional semester boundaries (Cycle Starts) 
 * encountered starting FROM the student's specific intake month.
 */
export function calculateAcademicState(
    intakeDateStr: string,
    currentDate: Date = new Date(),
    cycles: AcademicCycle[] = [
        { semester: 1, startMonth: 0, endMonth: 5 }, // Jan - Jun
        { semester: 2, startMonth: 6, endMonth: 11 } // Jul - Dec
    ],
    anomalies: Anomaly[] = []
) {
    if (!intakeDateStr) return { year: 1, semester: 1, isAnomaly: false };

    // Normalize dates to start of month for calculation
    const intakeDate = startOfMonth(parseISO(intakeDateStr));
    const normalizedCurrentDate = startOfMonth(currentDate);
    
    // Check for specific anomalies first
    const activeAnomaly = anomalies.find(a => 
        format(parseISO(a.overrideStartDate), 'yyyy-MM') === format(normalizedCurrentDate, 'yyyy-MM')
    );

    if (activeAnomaly) {
        return { year: activeAnomaly.year, semester: activeAnomaly.semester, isAnomaly: true };
    }

    // Ensure cycles are sorted by startMonth
    const sortedCycles = [...cycles].sort((a, b) => a.startMonth - b.startMonth);
    const cycleStartMonths = sortedCycles.map(c => c.startMonth);

    // 1. Count distinct institutional semester boundaries encountered since intake
    // We count every boundary hit (e.g., Jan or July) starting FROM the intake month
    let semestersStarted = 0;
    let checkDate = new Date(intakeDate);
    
    // Safety check to prevent infinite loops
    let iterations = 0;
    while ((checkDate < normalizedCurrentDate || isSameMonth(checkDate, normalizedCurrentDate)) && iterations < 600) {
        if (cycleStartMonths.includes(checkDate.getMonth())) {
            semestersStarted++;
        }
        checkDate = addMonths(checkDate, 1);
        iterations++;
    }

    // 2. Identify the global institutional cycle for the current month
    const currentMonth = normalizedCurrentDate.getMonth();
    const currentCycle = sortedCycles.find(c => {
        if (c.startMonth <= c.endMonth) {
            return currentMonth >= c.startMonth && currentMonth <= c.endMonth;
        } else {
            // Cycle spans across year boundary
            return currentMonth >= c.startMonth || currentMonth <= c.endMonth;
        }
    }) || sortedCycles[0];

    // 3. Determine Study Year
    // Standard rule: Hit 1 & 2 = Year 1, Hit 3 & 4 = Year 2, etc.
    const academicYear = Math.ceil(semestersStarted / (sortedCycles.length || 1));

    return { 
        year: Math.max(1, academicYear), 
        semester: currentCycle.semester,
        isAnomaly: false
    };
}
