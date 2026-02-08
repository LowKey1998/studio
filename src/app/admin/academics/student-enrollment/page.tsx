'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus, Search, Trash2, Check, ChevronsUpDown, Info, AlertCircle, Users, Copy, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, get, update, set, push, onValue } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';

type Semester = { id: string; name: string; status: string; intakeId: string; };
type Course = { id: string; name: string; code: string; };
type Student = { uid: string; id: string; name: string; email: string; intakeId?: string; };

export default function StudentEnrollmentPage() {
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [courses, setCourses] = React.useState<Course[]>([]);
    const [allStudents, setAllStudents] = React.useState<Student[]>([]);
    const [enrolledStudents, setEnrolledStudents] = React.useState<Student[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [actionLoading, setActionLoading] = React.useState<string | null>(null);
    
    // Filter state
    const [selectedSemester, setSelectedSemester] = React.useState('');
    const [selectedCourse, setSelectedCourse] = React.useState('');
    const [searchStudent, setSearchStudent] = React.useState('');
    const [bulkIds, setBulkIds] = React.useState('');

    const { toast } = useToast();

    React.useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [semSnap, coursesSnap, usersSnap] = await Promise.all([
                    get(ref(db, 'semesters')),
                    get(ref(db, 'courses')),
                    get(ref(db, 'users'))
                ]);

                if (semSnap.exists()) {
                    setSemesters(Object.entries(semSnap.val()).map(([id, data]) => ({ id, ...(data as any) })).sort((a,b) => b.name.localeCompare(a.name)));
                }
                if (coursesSnap.exists()) {
                    setCourses(Object.entries(coursesSnap.val()).map(([id, data]) => ({ id, ...(data as any) })).sort((a,b) => a.name.localeCompare(b.name)));
                }
                if (usersSnap.exists()) {
                    const data = usersSnap.val();
                    setAllStudents(Object.keys(data).filter(uid => data[uid].role === 'Student').map(uid => ({ uid, ...data[uid] })));
                }
            } catch (e) {
                toast({ variant: 'destructive', title: 'Data Loading Error' });
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [toast]);

    const fetchEnrolledStudents = React.useCallback(async () => {
        if (!selectedSemester || !selectedCourse) {
            setEnrolledStudents([]);
            return;
        }
        setLoading(true);
        try {
            const regsSnap = await get(ref(db, 'registrations'));
            if (regsSnap.exists()) {
                const regs = regsSnap.val();
                const uids: string[] = [];
                for (const userId in regs) {
                    if (regs[userId][selectedSemester]?.courses?.includes(selectedCourse)) {
                        uids.push(userId);
                    }
                }
                setEnrolledStudents(allStudents.filter(s => uids.includes(s.uid)));
            } else {
                setEnrolledStudents([]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [selectedSemester, selectedCourse, allStudents]);

    React.useEffect(() => {
        fetchEnrolledStudents();
    }, [fetchEnrolledStudents]);

    const handleEnrollStudent = async (uid: string) => {
        if (!selectedSemester || !selectedCourse) return;
        setActionLoading(uid);
        try {
            const regRef = ref(db, `registrations/${uid}/${selectedSemester}`);
            const regSnap = await get(regRef);
            
            let currentCourses = [];
            if (regSnap.exists()) {
                currentCourses = regSnap.val().courses || [];
            }

            if (currentCourses.includes(selectedCourse)) {
                toast({ title: 'Already enrolled' });
                return;
            }

            const updatedCourses = [...currentCourses, selectedCourse];
            await update(regRef, { 
                courses: updatedCourses,
                status: regSnap.exists() ? regSnap.val().status : 'Pending Payment',
                registrationDate: regSnap.exists() ? regSnap.val().registrationDate : new Date().toISOString()
            });

            toast({ title: 'Student Enrolled Successfully' });
            fetchEnrolledStudents();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Enrollment Failed', description: e.message });
        } finally {
            setActionLoading(null);
        }
    };

    const handleBulkEnrollByIds = async () => {
        if (!selectedSemester || !selectedCourse || !bulkIds.trim()) return;
        setActionLoading('bulk');
        const ids = bulkIds.split(/[\n,]+/).map(id => id.trim()).filter(Boolean);
        let success = 0;
        let fail = 0;

        try {
            for (const studentId of ids) {
                const student = allStudents.find(s => s.id === studentId);
                if (student) {
                    try {
                        const regRef = ref(db, `registrations/${student.uid}/${selectedSemester}`);
                        const regSnap = await get(regRef);
                        let currentCourses = regSnap.exists() ? regSnap.val().courses || [] : [];
                        if (!currentCourses.includes(selectedCourse)) {
                            await update(regRef, { 
                                courses: [...currentCourses, selectedCourse],
                                status: regSnap.exists() ? regSnap.val().status : 'Pending Payment',
                                registrationDate: regSnap.exists() ? regSnap.val().registrationDate : new Date().toISOString()
                            });
                        }
                        success++;
                    } catch (e) { fail++; }
                } else {
                    fail++;
                }
            }
            toast({ title: 'Bulk Enrollment Complete', description: `Successfully enrolled ${success} students. Failed: ${fail}.` });
            setBulkIds('');
            fetchEnrolledStudents();
        } finally {
            setActionLoading(null);
        }
    };

    const handleRemoveStudent = async (uid: string) => {
        if (!window.confirm("Remove student from this course?")) return;
        setActionLoading(uid);
        try {
            const regRef = ref(db, `registrations/${uid}/${selectedSemester}`);
            const regSnap = await get(regRef);
            if (regSnap.exists()) {
                const currentCourses = regSnap.val().courses || [];
                const updatedCourses = currentCourses.filter((id: string) => id !== selectedCourse);
                await update(regRef, { courses: updatedCourses });
                toast({ title: 'Student Removed' });
                fetchEnrolledStudents();
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Removal Failed' });
        } finally {
            setActionLoading(null);
        }
    };

    const availableStudents = allStudents.filter(s => 
        !enrolledStudents.some(e => e.uid === s.uid) &&
        (s.name.toLowerCase().includes(searchStudent.toLowerCase()) || s.id.toLowerCase().includes(searchStudent.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users /> Student Enrollment Management</CardTitle>
                    <CardDescription>Manually enroll or remove students from courses.</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label>Semester</Label>
                        <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                            <SelectTrigger><SelectValue placeholder="Select semester..." /></SelectTrigger>
                            <SelectContent>{semesters.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label>Course</Label>
                        <Select value={selectedCourse} onValueChange={setSelectedCourse} disabled={!selectedSemester}>
                            <SelectTrigger><SelectValue placeholder="Select course..." /></SelectTrigger>
                            <SelectContent>{courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {selectedSemester && selectedCourse ? (
                <div className="grid md:grid-cols-3 gap-6">
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle>Enrolled Students ({enrolledStudents.length})</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Student ID</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {enrolledStudents.length > 0 ? enrolledStudents.map(s => (
                                        <TableRow key={s.uid}>
                                            <TableCell>{s.id}</TableCell>
                                            <TableCell>{s.name}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleRemoveStudent(s.uid)} disabled={actionLoading === s.uid}>
                                                    {actionLoading === s.uid ? <Loader2 className="animate-spin h-4 w-4"/> : <Trash2 className="h-4 w-4 text-destructive"/>}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )) : <TableRow><TableCell colSpan={3} className="text-center h-24 text-muted-foreground">No students enrolled yet.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Enroll Students</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="list">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="list">From List</TabsTrigger>
                                    <TabsTrigger value="bulk">Bulk by ID</TabsTrigger>
                                </TabsList>
                                <TabsContent value="list" className="space-y-4 pt-4">
                                    <div className="relative">
                                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input placeholder="Search students..." className="pl-8" value={searchStudent} onChange={e => setSearchStudent(e.target.value)} />
                                    </div>
                                    <ScrollArea className="h-80 border rounded-md p-2">
                                        {availableStudents.map(s => (
                                            <div key={s.uid} className="flex items-center justify-between p-2 hover:bg-muted rounded-md transition-colors">
                                                <div className="text-sm">
                                                    <p className="font-medium">{s.name}</p>
                                                    <p className="text-xs text-muted-foreground">{s.id}</p>
                                                </div>
                                                <Button size="icon" variant="ghost" onClick={() => handleEnrollStudent(s.uid)} disabled={actionLoading === s.uid}>
                                                    {actionLoading === s.uid ? <Loader2 className="animate-spin h-4 w-4"/> : <PlusCircle className="h-4 w-4 text-primary"/>}
                                                </Button>
                                            </div>
                                        ))}
                                    </ScrollArea>
                                </TabsContent>
                                <TabsContent value="bulk" className="space-y-4 pt-4">
                                    <Label>Paste Student IDs</Label>
                                    <Textarea 
                                        placeholder="STU-001&#10;STU-002&#10;STU-003" 
                                        rows={8} 
                                        value={bulkIds}
                                        onChange={e => setBulkIds(e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">One ID per line or separated by commas.</p>
                                    <Button className="w-full" onClick={handleBulkEnrollByIds} disabled={actionLoading === 'bulk'}>
                                        {actionLoading === 'bulk' ? <Loader2 className="mr-2 animate-spin h-4 w-4"/> : <UserPlus className="mr-2 h-4 w-4"/>}
                                        Enroll All
                                    </Button>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Selection Required</AlertTitle>
                    <AlertDescription>Please select both a semester and a course to manage enrollment.</AlertDescription>
                </Alert>
            )}
        </div>
    );
}
