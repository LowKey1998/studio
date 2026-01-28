
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';

type TeachingLoad = {
    lecturerId: string;
    lecturerName: string;
    courseCount: number;
    courses: { name: string; code: string }[];
};

const chartConfig = {
  courseCount: {
    label: "Courses",
    color: "hsl(var(--chart-1))",
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
                        const userHasLecturerRole = user.subRoles?.some((userSubRole: string) => {
                            const roleEntry = Object.entries(subRolesData).find(([, roleDetails]: [string, any]) => roleDetails.name === userSubRole);
                            return roleEntry && lecturerRoleIds.has(roleEntry[0]);
                        });

                        if (userHasLecturerRole) {
                            lecturers[uid] = { name: users[uid].name, courses: [] };
                        }
                    }
                }

                for (const courseId in courses) {
                    const course = courses[courseId];
                    if (course.lecturerId && lecturers[course.lecturerId]) {
                        lecturers[course.lecturerId].courses.push({ name: course.name, code: course.code });
                    }
                }

                const loadData: TeachingLoad[] = Object.entries(lecturers).map(([lecturerId, data]) => ({
                    lecturerId,
                    lecturerName: data.name,
                    courseCount: data.courses.length,
                    courses: data.courses,
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

    return (
        <Card>
            <CardHeader>
                <CardTitle>Teaching Load Balance</CardTitle>
                <CardDescription>Analyze and balance the teaching loads across all lecturers to ensure equitable distribution.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                {loading ? (
                    <Skeleton className="h-96 w-full" />
                ) : teachingLoad.length > 0 ? (
                    <>
                        <div>
                            <h3 className="text-lg font-semibold mb-4">Load Distribution Chart</h3>
                             <ChartContainer config={chartConfig} className="h-[300px] w-full">
                                <BarChart data={teachingLoad} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                                    <CartesianGrid vertical={false} />
                                    <XAxis dataKey="lecturerName" tickLine={false} axisLine={false} tickMargin={10} />
                                    <YAxis />
                                    <Tooltip content={<ChartTooltipContent />} />
                                    <Bar dataKey="courseCount" fill="var(--color-courseCount)" radius={4} />
                                </BarChart>
                            </ChartContainer>
                        </div>
                        <div>
                             <h3 className="text-lg font-semibold mb-4">Detailed Breakdown</h3>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Lecturer</TableHead>
                                        <TableHead className="text-center">Assigned Courses</TableHead>
                                        <TableHead>Course Codes</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {teachingLoad.map(load => (
                                        <TableRow key={load.lecturerId}>
                                            <TableCell className="font-medium">{load.lecturerName}</TableCell>
                                            <TableCell className="text-center font-bold text-lg">{load.courseCount}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{load.courses.map(c => c.code).join(', ')}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                ) : (
                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>No Data Available</AlertTitle>
                        <AlertDescription>
                            There are no lecturers or assigned courses to display. Please assign lecturers to courses first.
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>
    );
}
