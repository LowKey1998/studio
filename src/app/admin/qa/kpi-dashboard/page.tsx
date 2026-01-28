
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { AlertCircle, TrendingUp, Users, UserCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type KpiData = {
    passRate: number | null;
    studentFacultyRatio: number | null;
    applicationEnrollmentRate: number | null;
    totalStudents: number;
    totalFaculty: number;
};

export default function KPIDashboardPage() {
    const [kpiData, setKpiData] = React.useState<KpiData | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const fetchKpiData = async () => {
            setLoading(true);
            try {
                const [assessmentsSnap, usersSnap, leadsSnap] = await Promise.all([
                    get(ref(db, 'assessments')),
                    get(ref(db, 'users')),
                    get(ref(db, 'admissions/leads'))
                ]);

                // Student Pass Rate
                let totalGraded = 0;
                let totalPassed = 0;
                if (assessmentsSnap.exists()) {
                    const assessments = assessmentsSnap.val();
                    for (const courseId in assessments) {
                        for (const userId in assessments[courseId]) {
                            const finalScore = assessments[courseId][userId]?.finalExam?.score;
                            if (finalScore !== undefined) {
                                totalGraded++;
                                if (finalScore >= 50) totalPassed++;
                            }
                        }
                    }
                }
                const passRate = totalGraded > 0 ? (totalPassed / totalGraded) * 100 : null;

                // Student-to-Faculty Ratio & Total Students
                let studentCount = 0;
                let facultyCount = 0;
                if (usersSnap.exists()) {
                    const users = usersSnap.val();
                    for (const uid in users) {
                        if (users[uid].role === 'Student') studentCount++;
                        if (users[uid].role === 'Staff' && users[uid].subRoles?.includes('Lecturer')) facultyCount++;
                    }
                }
                const studentFacultyRatio = facultyCount > 0 ? studentCount / facultyCount : null;

                // Application-to-Enrollment Rate
                let applicationCount = 0;
                let enrollmentCount = studentCount; // Use total students as proxy for enrolled
                if (leadsSnap.exists()) {
                    applicationCount = Object.keys(leadsSnap.val()).length;
                }
                const applicationEnrollmentRate = applicationCount > 0 ? (enrollmentCount / applicationCount) * 100 : null;


                setKpiData({
                    passRate,
                    studentFacultyRatio,
                    applicationEnrollmentRate,
                    totalStudents: studentCount,
                    totalFaculty: facultyCount
                });

            } catch (error) {
                console.error("Error fetching KPI data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchKpiData();
    }, []);
    
    const renderKpiCard = (title: string, value: string | number | null, unit: string, icon: React.ReactNode) => (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-8 w-24"/> : value !== null ? (
                    <div className="text-2xl font-bold">{typeof value === 'number' ? value.toFixed(1) : value}{unit}</div>
                ) : <div className="text-sm text-muted-foreground">Not enough data</div>}
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Quality Assurance KPI Dashboard</CardTitle>
                    <CardDescription>Track Key Performance Indicators for quality assurance.</CardDescription>
                </CardHeader>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {renderKpiCard("Student Pass Rate", kpiData?.passRate, "%", <UserCheck className="h-4 w-4 text-muted-foreground" />)}
                {renderKpiCard("Student-to-Faculty Ratio", kpiData?.studentFacultyRatio, ":1", <Users className="h-4 w-4 text-muted-foreground" />)}
                {renderKpiCard("Application-to-Enrollment Rate", kpiData?.applicationEnrollmentRate, "%", <TrendingUp className="h-4 w-4 text-muted-foreground" />)}
                {renderKpiCard("Total Students", kpiData?.totalStudents, "", <Users className="h-4 w-4 text-muted-foreground" />)}
            </div>
             <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>About These KPIs</AlertTitle>
                <AlertDescription>
                    These metrics are calculated based on available system data. For example, 'Pass Rate' is based on final exam scores (a score of 50 or above is considered a pass), and 'Student-to-Faculty Ratio' is based on users with the 'Lecturer' sub-role.
                </AlertDescription>
            </Alert>
        </div>
    );
}
