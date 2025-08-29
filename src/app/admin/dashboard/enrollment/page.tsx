
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LegendProps } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { TrendingUp } from 'lucide-react';


type EnrollmentData = {
    name: string;
    count: number;
    fill: string;
};

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

export default function EnrollmentDashboardPage() {
    const [enrollmentByIntake, setEnrollmentByIntake] = React.useState<EnrollmentData[]>([]);
    const [enrollmentByProgramme, setEnrollmentByProgramme] = React.useState<EnrollmentData[]>([]);
    const [totalStudents, setTotalStudents] = React.useState(0);
    const [loading, setLoading] = React.useState(true);

    const intakeChartConfig = React.useMemo(() => {
        const config: ChartConfig = {};
        enrollmentByIntake.forEach(item => {
            config[item.name] = { label: item.name, color: item.fill };
        });
        return {count: {label: "Students"}, ...config};
    }, [enrollmentByIntake]);
    
    const programmeChartConfig = React.useMemo(() => {
        const config: ChartConfig = {};
        enrollmentByProgramme.forEach(item => {
            config[item.name] = { label: item.name, color: item.fill };
        });
        return config;
    }, [enrollmentByProgramme]);


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
                let studentCount = 0;

                for (const uid in users) {
                    const user = users[uid];
                    if (user.role === 'Student') {
                        studentCount++;
                        if (user.intakeId) {
                            intakeCounts[user.intakeId] = (intakeCounts[user.intakeId] || 0) + 1;
                        }
                        if (user.programmeId) {
                            programmeCounts[user.programmeId] = (programmeCounts[user.programmeId] || 0) + 1;
                        }
                    }
                }
                setTotalStudents(studentCount);
                
                setEnrollmentByIntake(
                    Object.entries(intakeCounts).map(([intakeId, count], index) => ({
                        name: intakes[intakeId]?.name || `Unknown Intake (${intakeId})`,
                        count,
                        fill: COLORS[index % COLORS.length]
                    })).sort((a,b) => b.count - a.count)
                );

                setEnrollmentByProgramme(
                     Object.entries(programmeCounts).map(([programmeId, count], index) => ({
                        name: programmes[programmeId]?.name || `Unknown Programme (${programmeId})`,
                        count,
                        fill: COLORS[index % COLORS.length]
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

    const CustomPieLegend = (props: LegendProps) => {
        const { payload } = props;
        return (
            <ul className="flex flex-wrap gap-x-4 gap-y-2 justify-center">
            {payload?.map((entry, index) => (
                <li key={`item-${index}`} className="flex items-center text-sm">
                <span className="w-3 h-3 mr-2" style={{ backgroundColor: entry.color }} />
                <span>{entry.value} ({entry.payload?.value})</span>
                </li>
            ))}
            </ul>
        );
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Enrollment Statistics</CardTitle>
                    <CardDescription>An overview of student enrollment across different intakes and programmes.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Card className="sm:col-span-2">
                        <CardHeader className="pb-3">
                            <CardTitle>Total Student Enrollment</CardTitle>
                            <CardDescription className="max-w-lg text-balance leading-relaxed">
                                A high-level overview of your student population.
                            </CardDescription>
                        </CardHeader>
                        <CardFooter>
                            <div className="text-4xl font-bold">{loading ? <Skeleton className="h-10 w-24"/> : totalStudents}</div>
                        </CardFooter>
                    </Card>
                </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Enrollment by Intake</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-[300px] w-full" /> : enrollmentByIntake.length > 0 ? (
                            <ChartContainer config={intakeChartConfig} className="h-[300px] w-full">
                                <BarChart data={enrollmentByIntake} accessibilityLayer>
                                    <CartesianGrid vertical={false} />
                                    <XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} angle={-45} textAnchor="end" height={60} />
                                    <YAxis />
                                    <Tooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                                    <Bar dataKey="count" fill="var(--color-count)" radius={4}>
                                         {enrollmentByIntake.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Bar>
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
                            <ChartContainer config={programmeChartConfig} className="h-[300px] w-full">
                               <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                    <Pie
                                        data={enrollmentByProgramme}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        outerRadius={80}
                                        dataKey="count"
                                        nameKey="name"
                                        label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                                    >
                                        {enrollmentByProgramme.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<ChartTooltipContent hideLabel />} />
                                     <Legend content={<CustomPieLegend/>}/>
                                    </PieChart>
                                </ResponsiveContainer>
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
