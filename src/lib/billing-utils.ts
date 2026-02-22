/**
 * @fileOverview Centralized utility for calculating student billing, tuition, and fees.
 */

export type BillingPolicy = 'course' | 'semester';

export type FeeItem = {
  name: string;
  amount: number;
};

export type CourseItem = {
  id: string;
  cost: number;
};

export type BillingInput = {
  policy: BillingPolicy;
  semesterTuition?: number;
  courses: CourseItem[];
  mandatoryFees: FeeItem[];
  optionalFees: FeeItem[];
  scholarshipPercentage?: number;
  applyScholarship?: boolean;
  lateFee?: number;
};

export type BillingOutput = {
  baseTuition: number;
  scholarshipAmount: number;
  netTuition: number;
  totalMandatoryFees: number;
  totalOptionalFees: number;
  totalFees: number;
  lateFee: number;
  grandTotal: number;
};

/**
 * Calculates the full financial breakdown for a registration cycle.
 * Force number conversion on all inputs to ensure accurate floating-point summation.
 */
export function calculateBilling(input: BillingInput): BillingOutput {
  const {
    policy,
    semesterTuition = 0,
    courses = [],
    mandatoryFees = [],
    optionalFees = [],
    scholarshipPercentage = 0,
    applyScholarship = false,
    lateFee = 0,
  } = input;

  // 1. Calculate Base Tuition
  let baseTuition = 0;
  if (policy === 'semester') {
    baseTuition = Number(semesterTuition) || 0;
  } else {
    // Sum course costs strictly.
    baseTuition = (courses || []).reduce((sum, course) => {
        const cost = Number(course?.cost || 0);
        return sum + (isNaN(cost) ? 0 : cost);
    }, 0);
  }

  // 2. Apply Scholarship (only to tuition)
  const scholarshipAmount = applyScholarship 
    ? baseTuition * (Number(scholarshipPercentage || 0) / 100)
    : 0;
  
  const netTuition = Math.max(0, baseTuition - scholarshipAmount);

  // 3. Sum Fees
  const totalMandatoryFees = (mandatoryFees || []).reduce((sum, fee) => sum + (Number(fee?.amount || 0) || 0), 0);
  const totalOptionalFees = (optionalFees || []).reduce((sum, fee) => sum + (Number(fee?.amount || 0) || 0), 0);
  const totalFees = totalMandatoryFees + totalOptionalFees;

  // 4. Calculate Grand Total
  const grandTotal = netTuition + totalFees + (Number(lateFee) || 0);

  return {
    baseTuition,
    scholarshipAmount,
    netTuition,
    totalMandatoryFees,
    totalOptionalFees,
    totalFees,
    lateFee: Number(lateFee) || 0,
    grandTotal,
  };
}
