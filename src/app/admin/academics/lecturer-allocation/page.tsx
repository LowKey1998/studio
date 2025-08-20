
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { db } from '@/lib/firebase';
import { ref, onValue, update, get } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

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

    React.useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const usersRef = ref(db, 'users');
                const coursesRef = ref(db, 'courses');

                const [usersSnapshot, coursesSnapshot] = await Promise.all([
                    get(usersRef),
                    get(coursesRef)
                ]);

                const usersData = usersSnapshot.val() || {};
                const lecturersList: Lecturer[] = [];
                const lecturerMap = new Map<string, string>();

                for (const uid in usersData) {
                    if (usersData[uid].role === 'Staff' && usersData[uid].subRoles?.includes('Lecturer')) {
                        lecturersList.push({ uid, name: usersData[uid].name });
                        lecturerMap.set(uid, usersData[uid].name);
                    }
                }
                setLecturers(lecturersList);

                const coursesData = coursesSnapshot.val() || {};
                const coursesList: Course[] = [];
                for (const id in coursesData) {
                    const course = coursesData[id];
                    coursesList.push({
                        id,
                        ...course,
                        lecturerName: course.lecturerId ? lecturerMap.get(course.lecturerId) : undefined
                    });
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

        // Set up listeners for real-time updates after initial fetch
        const coursesRef = ref(db, 'courses');
        const unsubCourses = onValue(coursesRef, (snapshot) => {
             // Re-fetch data if changes occur to ensure consistency
             fetchData();
        });

        return () => {
            unsubCourses();
        };
    }, [toast]);

    const handleAssignLecturer = async (courseId: string, lecturerId: string) => {
        try {
            await update(ref(db, `courses/${courseId}`), { lecturerId });
            toast({ title: "Lecturer Assigned", description: "The course has been updated." });
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
                <CardTitle>Lecturer Allocation</CardTitle>
                <CardDescription>Assign lecturers to courses for the upcoming semesters.</CardDescription>
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
                                        value={course.lecturerId}
                                        onValueChange={(value) => handleAssignLecturer(course.id, value)}
                                    >
                                        <SelectTrigger className="w-[280px]">
                                            <SelectValue placeholder="Assign a lecturer..." />
                                        </SelectTrigger>
                                        <SelectContent>
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
