'use client';
import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { db } from '@/lib/firebase';
import { ref, onValue, update, get } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type Course = {
    id: string;
    name: string;
    code: string;
    lecturerId?: string;
    lecturerName?: string;
};

type Lecturer = {
    uid: string;
    name: string;
};

export default function LecturerAllocationPage() {
    const [courses, setCourses] = React.useState<Course[]>([]);
    const [lecturers, setLecturers] = React.useState<Lecturer[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const router = useRouter();
    const semesterId = searchParams.get('semesterId');
    const [semesterName, setSemesterName] = React.useState<string | null>(null);


    React.useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [usersSnapshot, coursesSnapshot, subRolesSnap, regsSnap, semestersSnap] = await Promise.all([
                    get(ref(db, 'users')),
                    get(ref(db, 'courses')),
                    get(ref(db, 'settings/subRoles')),
                    semesterId ? get(ref(db, 'registrations')) : Promise.resolve(null),
                    semesterId ? get(ref(db, `semesters/${semesterId}`)) : Promise.resolve(null),
                ]);

                const usersData = usersSnapshot.val() || {};
                const subRolesData = subRolesSnap.val() || {};

                const lecturerRoleIds = new Set(
                    Object.keys(subRolesData).filter(roleId => subRolesData[roleId].permissions?.canBeAssignedClass)
                );
                
                const lecturersList: Lecturer[] = [];
                const lecturerMap = new Map<string, string>();

                for (const uid in usersData) {
                    const user = usersData[uid];
                    if (user.role === 'Staff') {
                        const userSubRoleIds = user.subRoles ? (Array.isArray(user.subRoles) ? user.subRoles : Object.keys(user.subRoles)) : [];
                        const userHasLecturerRole = userSubRoleIds.some((userSubRoleId: string) => lecturerRoleIds.has(userSubRoleId));
                        
                        if (userHasLecturerRole) {
                           lecturersList.push({ uid, name: user.name });
                           lecturerMap.set(uid, user.name);
                        }
                    }
                }
                setLecturers(lecturersList);

                setSemesterName(semestersSnap?.exists() ? semestersSnap.val().name : null);
                
                const coursesData = coursesSnapshot.val() || {};
                let coursesList: Course[] = [];

                if (semesterId && regsSnap?.exists()) {
                    const courseIdsInSemester = new Set<string>();
                    const allRegistrations = regsSnap.val();
                    for (const userId in allRegistrations) {
                        const userRegs = allRegistrations[userId];
                        if (userRegs[semesterId]) {
                            userRegs[semesterId].courses.forEach((cid: string) => courseIdsInSemester.add(cid));
                        }
                    }
                    
                    courseIdsInSemester.forEach(courseId => {
                        if (coursesData[courseId]) {
                            const course = coursesData[courseId];
                            coursesList.push({
                                id: courseId,
                                ...course,
                                lecturerName: course.lecturerId ? lecturerMap.get(course.lecturerId) : undefined
                            });
                        }
                    });
                } else {
                    for (const id in coursesData) {
                        const course = coursesData[id];
                        coursesList.push({
                            id,
                            ...course,
                            lecturerName: course.lecturerId ? lecturerMap.get(course.lecturerId) : undefined
                        });
                    }
                }
                
                setCourses(coursesList.sort((a,b) => a.code.localeCompare(b.code)));
                
            } catch (error) {
                console.error("Failed to fetch data:", error);
                toast({ variant: 'destructive', title: "Data Loading Error" });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [toast, semesterId]);

    const handleAssignLecturer = async (courseId: string, lecturerId: string) => {
        try {
            const lecturerUpdate = lecturerId === 'unassign' ? null : lecturerId;
            await update(ref(db, `courses/${courseId}`), { lecturerId: lecturerUpdate });
            
            setCourses(prevCourses => prevCourses.map(course => {
                if (course.id === courseId) {
                    const newLecturerName = lecturerId === 'unassign' ? undefined : lecturers.find(l => l.uid === lecturerId)?.name;
                    return { ...course, lecturerId: lecturerId === 'unassign' ? undefined : lecturerId, lecturerName: newLecturerName };
                }
                return course;
            }));

            toast({ title: "Lecturer Assignment Updated", description: "The course has been updated." });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: "Assignment Failed" });
        }
    };

    const filteredCourses = courses.filter(course =>
        course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Card>
            <CardHeader>
                 {semesterName ? (
                    <div className="flex justify-between items-center">
                         <CardTitle>Lecturer Allocation for {semesterName}</CardTitle>
                         <Button variant="outline" onClick={() => router.push('/admin/academics/lecturer-allocation')}>
                            <X className="mr-2 h-4 w-4"/>Clear Filter
                         </Button>
                    </div>
                ) : (
                    <CardTitle>Lecturer Allocation</CardTitle>
                )}
                <CardDescription>Assign lecturers to courses. {semesterName ? '' : 'You can filter by semester from the Registration Management page.'}</CardDescription>
                <div className="relative pt-2">
                    <Search className="absolute left-2.5 top-4.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search courses by name or code..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Course Code</TableHead>
                            <TableHead>Course Name</TableHead>
                            <TableHead>Assigned Lecturer</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            Array.from({length: 5}).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={3}><Skeleton className="h-8 w-full" /></TableCell>
                                </TableRow>
                            ))
                        ) : filteredCourses.map(course => (
                            <TableRow key={course.id}>
                                <TableCell>{course.code}</TableCell>
                                <TableCell>{course.name}</TableCell>
                                <TableCell>
                                    <Select
                                        value={course.lecturerId || 'unassign'}
                                        onValueChange={(value) => handleAssignLecturer(course.id, value)}
                                    >
                                        <SelectTrigger className="w-[280px]">
                                            <SelectValue placeholder="Assign a lecturer..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                             <SelectItem value="unassign">-- Unassign --</SelectItem>
                                            {lecturers.map(lec => (
                                                <SelectItem key={lec.uid} value={lec.uid}>{lec.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}