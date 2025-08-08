
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

type EnrollmentData = {
    name: string;
    count: number;
};

const chartConfig = {
  count: {
    label: "Students",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export default function EnrollmentDashboardPage() {
    const [enrollmentByIntake, setEnrollmentByIntake] = React.useState<EnrollmentData[]>([]);
    const [enrollmentByProgramme, setEnrollmentByProgramme] = React.useState<EnrollmentData[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const fetchEnrollmentData = async () => {
            setLoading(true);
            try {
                const [usersSnap, programmesSnap, intakesSnap] = await Promise.all([
                    get(ref(db, 'users')),
                    get(ref(db, 'programmes')),
                    get(ref(db, 'intakes'))
                ]);

                if (!usersSnap.exists()) {
                    setLoading(false);
                    return;
                }

                const users = usersSnap.val();
                const programmes = programmesSnap.exists() ? programmesSnap.val() : {};
                const intakes = intakesSnap.exists() ? intakesSnap.val() : {};

                const intakeCounts: Record<string, number> = {};
                const programmeCounts: Record<string, number> = {};

                for (const uid in users) {
                    const user = users[uid];
                    if (user.role === 'Student') {
                        if (user.intakeId) {
                            intakeCounts[user.intakeId] = (intakeCounts[user.intakeId] || 0) + 1;
                        }
                        if (user.programmeId) {
                            programmeCounts[user.programmeId] = (programmeCounts[user.programmeId] || 0) + 1;
                        }
                    }
                }
                
                setEnrollmentByIntake(
                    Object.entries(intakeCounts).map(([intakeId, count]) => ({
                        name: intakes[intakeId]?.name || `Unknown Intake (${intakeId})`,
                        count,
                    })).sort((a,b) => b.count - a.count)
                );

                setEnrollmentByProgramme(
                     Object.entries(programmeCounts).map(([programmeId, count]) => ({
                        name: programmes[programmeId]?.name || `Unknown Programme (${programmeId})`,
                        count,
                    })).sort((a,b) => b.count - a.count)
                );

            } catch (error) {
                console.error("Error fetching enrollment data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchEnrollmentData();
    }, []);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Enrollment Statistics</CardTitle>
                    <CardDescription>An overview of student enrollment across different intakes and programmes.</CardDescription>
                </CardHeader>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Enrollment by Intake</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-[300px] w-full" /> : enrollmentByIntake.length > 0 ? (
                            <ChartContainer config={chartConfig} className="h-[300px] w-full">
                                <BarChart data={enrollmentByIntake} layout="vertical" margin={{ left: 20, right: 20 }}>
                                    <CartesianGrid horizontal={false} />
                                    <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={120} />
                                    <XAxis type="number" dataKey="count" hide/>
                                    <Tooltip cursor={{fill: 'hsl(var(--muted))'}} content={<ChartTooltipContent />} />
                                    <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                                </BarChart>
                            </ChartContainer>
                        ) : (
                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>No Data</AlertTitle>
                                <AlertDescription>No student intake data to display.</AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Enrollment by Programme</CardTitle>
                    </CardHeader>
                    <CardContent>
                       {loading ? <Skeleton className="h-[300px] w-full" /> : enrollmentByProgramme.length > 0 ? (
                            <ChartContainer config={chartConfig} className="h-[300px] w-full">
                                <BarChart data={enrollmentByProgramme} layout="vertical" margin={{ left: 20, right: 20 }}>
                                    <CartesianGrid horizontal={false} />
                                    <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={120} />
                                    <XAxis type="number" dataKey="count" hide/>
                                    <Tooltip cursor={{fill: 'hsl(var(--muted))'}} content={<ChartTooltipContent />} />
                                    <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                                </BarChart>
                            </ChartContainer>
                        ) : (
                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>No Data</AlertTitle>
                                <AlertDescription>No student programme data to display.</AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
