'use client';
import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from '@/lib/firebase';
import { ref, update, get } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Search, X, ChevronDown, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import type { CoursePath } from '@/app/admin/course-paths/page';

type Course = {
    id: string;
    name: string;
    code: string;
    lecturerIds?: string[];
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
                const [usersSnapshot, coursesSnapshot, subRolesSnap, semestersSnap, coursePathsSnap] = await Promise.all([
                    get(ref(db, 'users')),
                    get(ref(db, 'courses')),
                    get(ref(db, 'settings/subRoles')),
                    get(ref(db, 'semesters')),
                    get(ref(db, 'coursePaths')),
                ]);

                const usersData = usersSnapshot.val() || {};
                const subRolesData = subRolesSnap.val() || {};
                const coursesData = coursesSnapshot.val() || {};

                const lecturerRoleIds = new Set(
                    Object.keys(subRolesData).filter(roleId => subRolesData[roleId].permissions?.canBeAssignedClass)
                );
                const lecturersList: Lecturer[] = [];
                for (const uid in usersData) {
                    const user = usersData[uid];
                    if (user.role === 'Staff') {
                        const userSubRoleIds = user.subRoles ? (Array.isArray(user.subRoles) ? user.subRoles : Object.keys(user.subRoles)) : [];
                        const userHasLecturerRole = userSubRoleIds.some((userSubRoleId: string) => lecturerRoleIds.has(userSubRoleId));
                        if (userHasLecturerRole) {
                           lecturersList.push({ uid, name: user.name });
                        }
                    }
                }
                setLecturers(lecturersList);

                let coursesList: Course[] = [];
                if (semesterId && semestersSnap.exists() && coursePathsSnap.exists()) {
                    const allSemesters = semestersSnap.val();
                    const semesterData = allSemesters[semesterId];
                    setSemesterName(semesterData?.name || null);
    
                    if (semesterData) {
                        const allCoursePaths: CoursePath[] = Object.values(coursePathsSnap.val());
                        const relevantPaths = allCoursePaths.filter(p => p.intakeId === semesterData.intakeId);
    
                        const courseIdsInSemester = new Set<string>();
                        relevantPaths.forEach(path => {
                            if (path.semesters && path.semesters[semesterId]) {
                                path.semesters[semesterId].courses.forEach(cid => courseIdsInSemester.add(cid));
                            }
                        });
    
                        courseIdsInSemester.forEach(courseId => {
                            if (coursesData[courseId]) {
                                const course = coursesData[courseId];
                                coursesList.push({
                                    id: courseId,
                                    ...course,
                                });
                            }
                        });
                    }
                } else {
                    for (const id in coursesData) {
                        const course = coursesData[id];
                        coursesList.push({ id, ...course });
                    }
                }
                
                setCourses(coursesList.sort((a, b) => a.code.localeCompare(b.code)));

            } catch (error) {
                console.error("Failed to fetch data:", error);
                toast({ variant: 'destructive', title: "Data Loading Error" });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [toast, semesterId]);

    const handleLecturerAssignmentChange = async (courseId: string, lecturerId: string) => {
        const course = courses.find(c => c.id === courseId);
        if (!course) return;

        const currentLecturerIds = course.lecturerIds || [];
        const isAssigned = currentLecturerIds.includes(lecturerId);
        const newLecturerIds = isAssigned
            ? currentLecturerIds.filter(id => id !== lecturerId)
            : [...currentLecturerIds, lecturerId];

        try {
            await update(ref(db, `courses/${courseId}`), { lecturerIds: newLecturerIds });
            
            setCourses(prevCourses => prevCourses.map(c => 
                c.id === courseId ? { ...c, lecturerIds: newLecturerIds } : c
            ));

            toast({ title: "Lecturer Assignment Updated" });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: "Assignment Failed" });
        }
    };

    const handleClearAssignments = async (courseId: string) => {
        try {
            await update(ref(db, `courses/${courseId}`), { lecturerIds: null });
            setCourses(prevCourses => prevCourses.map(c => 
                c.id === courseId ? { ...c, lecturerIds: [] } : c
            ));
            toast({ title: "Assignments Cleared" });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: "Clear Failed" });
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
                <CardDescription>Assign one or more lecturers to courses. {semesterName ? '' : 'You can filter by semester from the Registration Management page.'}</CardDescription>
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
                            <TableHead>Assigned Lecturers</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            Array.from({length: 5}).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={3}><Skeleton className="h-8 w-full" /></TableCell>
                                </TableRow>
                            ))
                        ) : filteredCourses.map(course => {
                            const assignedLecturersText = course.lecturerIds?.map(id => lecturers.find(l => l.uid === id)?.name).filter(Boolean).join(', ') || 'Assign lecturers...';

                            return (
                            <TableRow key={course.id}>
                                <TableCell>{course.code}</TableCell>
                                <TableCell>{course.name}</TableCell>
                                <TableCell>
                                     <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" className="w-[280px] justify-between">
                                                <span className="truncate">{assignedLecturersText}</span>
                                                <ChevronDown className="h-4 w-4 ml-2"/>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-[280px]">
                                            {course.lecturerIds && course.lecturerIds.length > 0 && (
                                                <>
                                                    <DropdownMenuItem 
                                                        className="text-destructive focus:text-destructive font-medium"
                                                        onSelect={(e) => {
                                                            e.preventDefault();
                                                            handleClearAssignments(course.id);
                                                        }}
                                                    >
                                                        <UserMinus className="mr-2 h-4 w-4" />
                                                        Unassign All
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                </>
                                            )}
                                            {lecturers.length > 0 ? lecturers.map(lec => (
                                                <DropdownMenuCheckboxItem
                                                    key={lec.uid}
                                                    checked={course.lecturerIds?.includes(lec.uid)}
                                                    onCheckedChange={() => handleLecturerAssignmentChange(course.id, lec.uid)}
                                                    onSelect={(e) => e.preventDefault()}
                                                >
                                                    {lec.name}
                                                </DropdownMenuCheckboxItem>
                                            )) : (
                                                <div className="p-2 text-sm text-muted-foreground text-center">No lecturers found</div>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        )})}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
