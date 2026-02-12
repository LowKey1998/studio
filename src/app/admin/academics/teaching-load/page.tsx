'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info, UserCheck, BookOpen, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type TeachingLoad = {
    lecturerId: string;
    lecturerName: string;
    courseCount: number;
    courses: { name: string; code: string }[];
    fill?: string;
};

const COLORS = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
    'hsl(var(--primary))',
    '#2563eb',
    '#7c3aed',
    '#db2777',
    '#ea580c'
];

const chartConfig = {
  courseCount: {
    label: "Courses Assigned",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;


export default function TeachingLoadPage() {
    const [teachingLoad, setTeachingLoad] = React.useState<TeachingLoad[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const fetchTeachingLoad = async () => {
            setLoading(true);
            try {
                const [usersSnap, coursesSnap, subRolesSnap] = await Promise.all([
                    get(ref(db, 'users')),
                    get(ref(db, 'courses')),
                    get(ref(db, 'settings/subRoles'))
                ]);

                if (!usersSnap.exists() || !coursesSnap.exists()) {
                    setTeachingLoad([]);
                    setLoading(false);
                    return;
                }

                const users = usersSnap.val();
                const courses = coursesSnap.val();
                const subRolesData = subRolesSnap.val() || {};

                const lecturerRoleIds = new Set(
                    Object.keys(subRolesData).filter(roleId => subRolesData[roleId].permissions?.canBeAssignedClass)
                );

                const lecturers: Record<string, { name: string, courses: any[] }> = {};
                for (const uid in users) {
                    const user = users[uid];
                     if (user.role === 'Staff') {
                        const userSubRoleIds = user.subRoles ? (Array.isArray(user.subRoles) ? user.subRoles : Object.keys(user.subRoles)) : [];
                        const userHasLecturerRole = userSubRoleIds.some((userSubRoleId: string) => lecturerRoleIds.has(userSubRoleId));

                        if (userHasLecturerRole) {
                            lecturers[uid] = { name: users[uid].name, courses: [] };
                        }
                    }
                }

                for (const courseId in courses) {
                    const course = courses[courseId];
                    if (course.lecturerIds && Array.isArray(course.lecturerIds)) {
                        course.lecturerIds.forEach((lecturerId: string) => {
                            if (lecturers[lecturerId]) {
                                lecturers[lecturerId].courses.push({ name: course.name, code: course.code });
                            }
                        });
                    } else if (course.lecturerId && lecturers[course.lecturerId]) {
                        lecturers[course.lecturerId].courses.push({ name: course.name, code: course.code });
                    }
                }

                const loadData: TeachingLoad[] = Object.entries(lecturers).map(([lecturerId, data], index) => ({
                    lecturerId,
                    lecturerName: data.name,
                    courseCount: data.courses.length,
                    courses: data.courses,
                    fill: COLORS[index % COLORS.length]
                })).sort((a, b) => b.courseCount - a.courseCount);

                setTeachingLoad(loadData);
            } catch (error) {
                console.error("Error fetching teaching load:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTeachingLoad();
    }, []);

    const totalCourses = React.useMemo(() => teachingLoad.reduce((sum, item) => sum + item.courseCount, 0), [teachingLoad]);

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="font-headline text-2xl">Teaching Load Analytics</CardTitle>
                            <CardDescription>Visualize and balance academic workloads to ensure faculty efficiency and equity.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2 bg-muted p-2 rounded-lg border">
                            <BookOpen className="h-4 w-4 text-primary" />
                            <span className="text-sm font-bold uppercase">{totalCourses} Courses Mapped</span>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="shadow-md">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2"><BarChart2 className="h-5 w-5 text-primary"/> Load Distribution (Courses)</CardTitle>
                        <CardDescription>Number of courses assigned per faculty member.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-[300px] w-full" /> : teachingLoad.length > 0 ? (
                            <ChartContainer config={chartConfig} className="h-[300px] w-full">
                                <BarChart data={teachingLoad} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                    <XAxis dataKey="lecturerName" tickLine={false} axisLine={false} tickMargin={10} hide={teachingLoad.length > 8} />
                                    <YAxis />
                                    <Tooltip content={<ChartTooltipContent />} />
                                    <Bar dataKey="courseCount" fill="var(--color-courseCount)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ChartContainer>
                        ) : (
                            <div className="h-[300px] flex items-center justify-center text-muted-foreground italic">No data to display</div>
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-md">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5 text-primary"/> Workload Percentage</CardTitle>
                        <CardDescription>Relative share of total institutional teaching load.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-[300px] w-full" /> : teachingLoad.length > 0 ? (
                            <ChartContainer config={chartConfig} className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={teachingLoad}
                                            dataKey="courseCount"
                                            nameKey="lecturerName"
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={100}
                                            label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                                        >
                                            {teachingLoad.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<ChartTooltipContent hideLabel />} />
                                        <Legend verticalAlign="bottom" height={36}/>
                                    </PieChart>
                                </ResponsiveContainer>
                            </ChartContainer>
                        ) : (
                            <div className="h-[300px] flex items-center justify-center text-muted-foreground italic">No data to display</div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-md">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2"><UserCheck className="h-5 w-5 text-primary"/> Detailed Breakdown</CardTitle>
                    <CardDescription>Granular view of course assignments by lecturer.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? <Skeleton className="h-64 w-full" /> : teachingLoad.length > 0 ? (
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead>Lecturer Name</TableHead>
                                    <TableHead className="text-center">Count</TableHead>
                                    <TableHead>Assigned Courses</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {teachingLoad.map(load => (
                                    <TableRow key={load.lecturerId} className="hover:bg-muted/30 transition-colors">
                                        <TableCell className="font-bold">{load.lecturerName}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant={load.courseCount > 4 ? "destructive" : "secondary"}>
                                                {load.courseCount}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {load.courses.map((c, i) => (
                                                    <Badge key={i} variant="outline" className="text-[10px] font-mono whitespace-nowrap">{c.code}</Badge>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" asChild>
                                                <Link href="/admin/academics/lecturer-allocation">Edit</Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertTitle>No Data Available</AlertTitle>
                            <AlertDescription>
                                No faculty members have been assigned to courses yet. Use the Lecturer Allocation tool to begin.
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
