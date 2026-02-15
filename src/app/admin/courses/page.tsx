'use client';
import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Loader2, Trash2, Undo2, MoreVertical, Pencil, Users, Search, Route, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from '@/components/ui/checkbox';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { ref, get, serverTimestamp, update, push } from 'firebase/database';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { isWithinInterval, parseISO, startOfDay } from 'date-fns';

type Lecturer = {
    uid: string;
    name: string;
};

type StudentEnrollment = {
    uid: string;
    name: string;
    id: string; 
    semesterName: string;
}

type Course = {
    id: string;
    name: string;
    code: string;
    credits?: number;
    cost: number;
    year: number;
    lecturerId: string;
    lecturerIds?: string[];
    lecturerName?: string;
    status: 'active' | 'archived';
    archiveReason?: string;
    studentCount?: number;
    enrolledStudents?: StudentEnrollment[];
    separateInstance?: boolean;
    assessmentTemplateId?: string;
};

type Programme = {
    id: string;
    name: string;
    courseIds?: Record<string, boolean>;
}

type CurrentAdmin = {
    name: string;
    id: string;
}

export default function CoursesPage() {
    const [courses, setCourses] = React.useState<Course[]>([]);
    const [lecturers, setLecturers] = React.useState<Lecturer[]>([]);
    const [programmes, setProgrammes] = React.useState<Programme[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [formLoading, setFormLoading] = React.useState(false);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [isStudentListOpen, setIsStudentListOpen] = React.useState(false);
    const [selectedCourseForList, setSelectedCourseForList] = React.useState<Course | null>(null);
    const [viewingStudents, setViewingStudents] = React.useState<StudentEnrollment[]>([]);
    const [activeTab, setActiveTab] = React.useState('active');
    const [isArchiveDialogOpen, setIsArchiveDialogOpen] = React.useState(false);
    const [archivingCourse, setArchivingCourse] = React.useState<Course | null>(null);
    const [archiveReason, setArchiveReason] = React.useState('');
    const [currentAdmin, setCurrentAdmin] = React.useState<CurrentAdmin | null>(null);
    const [editingCourse, setEditingCourse] = React.useState<Course | null>(null);

    const [searchTerm, setSearchTerm] = React.useState('');
    const [yearFilter, setYearFilter] = React.useState('all');

    const [courseName, setCourseName] = React.useState('');
    const [courseCode, setCourseCode] = React.useState('');
    const [courseCredits, setCourseCredits] = React.useState('');
    const [courseCost, setCourseCost] = React.useState('');
    const [courseYear, setCourseYear] = React.useState('');
    const [selectedLecturerId, setSelectedLecturerId] = React.useState('');
    const [selectedProgrammes, setSelectedProgrammes] = React.useState<Record<string, boolean>>({});
    const [separateInstance, setSeparateInstance] = React.useState(false);

    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
            const userRef = ref(db, `users/${user.uid}`);
            const snapshot = await get(userRef);
            if (snapshot.exists()) {
              const userData = snapshot.val();
              setCurrentAdmin({ name: userData.name, id: userData.id });
            }
          }
        });
        return () => unsubscribe();
    }, []);

    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [usersSnap, coursesSnap, programmesSnap, registrationsSnap, semestersSnap] = await Promise.all([
                get(ref(db, 'users')),
                get(ref(db, 'courses')),
                get(ref(db, 'programmes')),
                get(ref(db, 'registrations')),
                get(ref(db, 'semesters'))
            ]);
            
            const userMap = new Map<string, any>();
            if (usersSnap.exists()) {
                Object.entries(usersSnap.val() as Record<string, any>).forEach(([uid, userData]) => userMap.set(uid, userData));
            }

            const lecturersList: Lecturer[] = [];
            userMap.forEach((user, uid) => {
                if (user.role === 'Staff' && user.subRoles?.includes('Lecturer')) {
                    lecturersList.push({ uid, name: user.name });
                }
            });
            setLecturers(lecturersList);
            
            if(programmesSnap.exists()) {
                const programmesData = programmesSnap.val();
                setProgrammes(Object.keys(programmesData).map(id => ({id, ...programmesData[id]})));
            }

            const allSemesters = semestersSnap.val() || {};
            const now = startOfDay(new Date());

            const isSemesterCurrent = (sem: any) => {
                if (!sem || sem.status === 'Archived') return false;
                if (!sem.startDate || !sem.endDate) return false;
                try {
                    const start = startOfDay(parseISO(sem.startDate));
                    const end = startOfDay(parseISO(sem.endDate));
                    return isWithinInterval(now, { start, end });
                } catch (e) {
                    return false;
                }
            };

            const courseEnrollments: Record<string, StudentEnrollment[]> = {};
            if (registrationsSnap.exists()) {
                const regs = registrationsSnap.val();
                for (const userId in regs) {
                    for (const semesterId in regs[userId]) {
                        const registration = regs[userId][semesterId];
                        const semesterInfo = allSemesters[semesterId];
                        
                        if (semesterInfo && isSemesterCurrent(semesterInfo) && (registration.status === 'Completed' || registration.status === 'Pending Payment')) {
                            const coursesArr = Array.isArray(registration.courses) ? registration.courses : Object.keys(registration.courses || {});
                            coursesArr.forEach((courseId: string) => {
                                if (!courseEnrollments[courseId]) {
                                    courseEnrollments[courseId] = [];
                                }
                                const studentData = userMap.get(userId);
                                if (studentData) {
                                     courseEnrollments[courseId].push({ 
                                         uid: userId, 
                                         name: studentData.name, 
                                         id: studentData.id, 
                                         semesterName: registration.semesterName || semesterInfo.name || 'Unknown' 
                                     });
                                }
                            });
                        }
                    }
                }
            }

            if (coursesSnap.exists()) {
                const coursesData = coursesSnap.val();
                const coursesList: Course[] = Object.keys(coursesData).map(key => {
                    const c = coursesData[key];
                    const lecturerNames = (c.lecturerIds || [])
                        .map((id: string) => userMap.get(id)?.name)
                        .filter(Boolean)
                        .join(', ') || userMap.get(c.lecturerId)?.name || 'N/A';

                    return {
                        id: key,
                        ...c,
                        status: c.status || 'active',
                        lecturerName: lecturerNames,
                        enrolledStudents: courseEnrollments[key] || [],
                        studentCount: (courseEnrollments[key] || []).length
                    };
                });
                setCourses(coursesList);
            } else {
                setCourses([]);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            toast({ variant: 'destructive', title: 'Failed to load data' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const resetForm = () => {
        setCourseName('');
        setCourseCode('');
        setCourseCost('');
        setCourseYear('');
        setCourseCredits('');
        setSelectedLecturerId('');
        setSelectedProgrammes({});
        setSeparateInstance(false);
        setEditingCourse(null);
    };
    
    const openEditDialog = (course: Course) => {
        setEditingCourse(course);
        setCourseName(course.name);
        setCourseCode(course.code);
        setCourseCost(String(course.cost || ''));
        setCourseYear(String(course.year || ''));
        setCourseCredits(String(course.credits || ''));
        setSelectedLecturerId(course.lecturerId || '');
        setSeparateInstance(course.separateInstance || false);
        
        const initialSelectedProgrammes: Record<string, boolean> = {};
        programmes.forEach(prog => {
            if (prog.courseIds && prog.courseIds[course.id]) {
                initialSelectedProgrammes[prog.id] = true;
            }
        });
        setSelectedProgrammes(initialSelectedProgrammes);
        setIsDialogOpen(true);
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!courseName || !courseCode) {
            toast({ variant: 'destructive', title: 'Missing Fields', description: 'Please provide Name and Code.' });
            return;
        }
        setFormLoading(true);
        
        const courseData = {
            name: courseName,
            code: courseCode,
            credits: courseCredits ? Number(courseCredits) : null,
            cost: courseCost ? Number(courseCost) : 0,
            year: courseYear ? Number(courseYear) : 1,
            lecturerId: selectedLecturerId || null,
            separateInstance: separateInstance,
            status: 'active' as 'active',
        };

        try {
            let courseId = editingCourse?.id;
            const updates: Record<string, any> = {};

            if (editingCourse) {
                updates[`/courses/${editingCourse.id}`] = { ...editingCourse, ...courseData };
            } else {
                const newCourseRef = push(ref(db, 'courses'));
                courseId = newCourseRef.key!;
                updates[`/courses/${courseId}`] = courseData;

                const activityRef = push(ref(db, 'recentActivities'));
                 updates[`/recentActivities/${activityRef.key!}`] = {
                    user: currentAdmin?.name || 'Admin',
                    userId: currentAdmin?.id || 'N/A',
                    action: `created a new course: '${courseName} (${courseCode})'.`,
                    timestamp: serverTimestamp()
                };
            }
            
            programmes.forEach(prog => {
                const isSelected = selectedProgrammes[prog.id];
                const isCurrentlyLinked = prog.courseIds && prog.courseIds[courseId!];
                if (isSelected && !isCurrentlyLinked) updates[`/programmes/${prog.id}/courseIds/${courseId!}`] = true;
                else if (!isSelected && isCurrentlyLinked) updates[`/programmes/${prog.id}/courseIds/${courseId!}`] = null;
            });
            
            await update(ref(db), updates);
            toast({ title: editingCourse ? 'Course Updated' : 'Course Added' });
            fetchData(); resetForm(); setIsDialogOpen(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to save', description: error.message });
        } finally { setFormLoading(false); }
    };
    
    const handleUpdateCourseStatus = async (courseId: string, status: 'active' | 'archived', reason: string = '') => {
        try {
            await update(ref(db, `courses/${courseId}`), { status, archiveReason: status === 'archived' ? reason : '' });
            fetchData();
            toast({ title: `Course ${status === 'archived' ? 'Archived' : 'Restored'}` });
        } catch (error: any) { toast({ variant: 'destructive', title: 'Failed', description: error.message }); }
    };

    const handleArchiveSubmit = async () => {
        if (archivingCourse) {
            await handleUpdateCourseStatus(archivingCourse.id, 'archived', archiveReason);
            setIsArchiveDialogOpen(false);
            setArchivingCourse(null);
            setArchiveReason('');
        }
    };

    const filteredAndGroupedCourses = React.useMemo(() => {
        const filtered = courses.filter(course => {
            const statusMatch = course.status === activeTab;
            const lowerCaseSearch = searchTerm.toLowerCase();
            const searchMatch = searchTerm === '' || course.name.toLowerCase().includes(lowerCaseSearch) || course.code.toLowerCase().includes(lowerCaseSearch);
            const yearMatch = yearFilter === 'all' || course.year.toString() === yearFilter;
            return statusMatch && searchMatch && yearMatch;
        });

        return filtered.reduce((acc, course) => {
            const yearKey = `Year ${course.year || 'Not Set'}`;
            if (!acc[yearKey]) acc[yearKey] = [];
            acc[yearKey].push(course);
            return acc;
        }, {} as Record<string, Course[]>);
    }, [courses, activeTab, searchTerm, yearFilter]);

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle className="font-headline text-2xl">Course Catalog</CardTitle>
                            <CardDescription>Manage courses by academic year and semester dates.</CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" asChild><Link href="/admin/course-paths"><Route className="mr-2 h-4 w-4" />Course Paths</Link></Button>
                            <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) resetForm(); }}>
                                <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" /> Add Course</Button></DialogTrigger>
                                <DialogContent className="sm:max-w-2xl">
                                    <form onSubmit={handleFormSubmit}>
                                        <DialogHeader><DialogTitle>{editingCourse ? 'Edit' : 'New'} Course</DialogTitle></DialogHeader>
                                        <div className="grid max-h-[70vh] gap-6 overflow-y-auto py-4 pr-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1"><Label>Name *</Label><Input value={courseName} onChange={e => setCourseName(e.target.value)} disabled={formLoading} /></div>
                                                <div className="space-y-1"><Label>Code *</Label><Input value={courseCode} onChange={e => setCourseCode(e.target.value)} disabled={formLoading} /></div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="space-y-1"><Label>Credits</Label><Input type="number" value={courseCredits} onChange={e => setCourseCredits(e.target.value)} disabled={formLoading}/></div>
                                                <div className="space-y-1"><Label>Cost (ZMW)</Label><Input type="number" value={courseCost} onChange={e => setCourseCost(e.target.value)} disabled={formLoading}/></div>
                                                <div className="space-y-1"><Label>Year</Label><Input type="number" value={courseYear} onChange={e => setCourseYear(e.target.value)} disabled={formLoading}/></div>
                                            </div>
                                            <div className="space-y-1"><Label>Lecturer</Label>
                                                <Select onValueChange={setSelectedLecturerId} value={selectedLecturerId} disabled={formLoading}>
                                                    <SelectTrigger><SelectValue placeholder="Select lecturer" /></SelectTrigger>
                                                    <SelectContent><SelectItem value="none">Unassigned</SelectItem>{lecturers.map(l => ( <SelectItem key={l.uid} value={l.uid}>{l.name}</SelectItem> ))}</SelectContent>
                                                </Select>
                                            </div>
                                            <div className="flex items-center space-x-2 p-4 border rounded-md bg-primary/5">
                                                <Switch checked={separateInstance} onCheckedChange={setSeparateInstance} />
                                                <div className="space-y-0.5"><Label className="text-sm font-bold">Make separate instance per intake</Label><p className="text-[10px] text-muted-foreground italic leading-tight">If enabled, this course will have independent session schedules for each intake cohort.</p></div>
                                            </div>
                                            <div className="space-y-2"><Label>Linked Programmes</Label><div className="grid grid-cols-2 gap-2 border p-4 max-h-48 overflow-y-auto bg-muted/20">{programmes.map(p => (<div key={p.id} className="flex items-center gap-2"><Checkbox checked={!!selectedProgrammes[p.id]} onCheckedChange={() => setSelectedProgrammes(prev => ({...prev, [p.id]: !prev[p.id]}))}/><Label className="font-normal text-sm">{p.name}</Label></div>))}</div></div>
                                        </div>
                                        <DialogFooter><DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose><Button type="submit" disabled={formLoading}>{formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save'}</Button></DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertTitle className="font-bold text-blue-800 uppercase text-xs tracking-wider">Date-Aware Enrollment Tracking</AlertTitle>
                <AlertDescription className="text-blue-700 text-sm italic leading-relaxed">
                    Student counts strictly include students registered for semesters where the current date falls between the designated <strong>Start Date</strong> and <strong>End Date</strong>.
                </AlertDescription>
            </Alert>

            <Card>
                <CardContent className="pt-6">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6"><TabsList><TabsTrigger value="active">Active</TabsTrigger><TabsTrigger value="archived">Archived</TabsTrigger></TabsList></Tabs>
                    <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 border rounded-lg bg-muted/10">
                        <div className="relative flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8 bg-background"/></div>
                        <Select value={yearFilter} onValueChange={setYearFilter}><SelectTrigger className="w-40 bg-background"><SelectValue placeholder="Year" /></SelectTrigger><SelectContent><SelectItem value="all">All Years</SelectItem><SelectItem value="1">Year 1</SelectItem><SelectItem value="2">Year 2</SelectItem><SelectItem value="3">Year 3</SelectItem></SelectContent></Select>
                    </div>
                    
                    <Accordion type="multiple" defaultValue={Object.keys(filteredAndGroupedCourses)} className="w-full space-y-4">
                        {loading ? Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-md"/>) : 
                        Object.entries(filteredAndGroupedCourses).map(([year, courses]) => (
                            <AccordionItem value={year} key={year} className="border rounded-lg bg-card">
                                <AccordionTrigger className="font-bold text-lg px-4">{year} <Badge variant="outline" className="ml-2">{courses.length}</Badge></AccordionTrigger>
                                <AccordionContent className="px-0">
                                    <Table>
                                        <TableHeader><TableRow><TableHead className="pl-4">Code</TableHead><TableHead>Name</TableHead><TableHead>Lecturer</TableHead><TableHead>Active Students</TableHead><TableHead className="text-right pr-4">Actions</TableHead></TableRow></TableHeader>
                                        <TableBody>{courses.map((course) => (
                                            <TableRow key={course.id}>
                                                <TableCell className="font-mono text-xs pl-4">{course.code}</TableCell>
                                                <TableCell className="font-medium text-sm">{course.name}</TableCell>
                                                <TableCell className="text-sm">{course.lecturerName}</TableCell>
                                                <TableCell><Button variant="ghost" size="sm" onClick={() => { setSelectedCourseForList(course); setViewingStudents(course.enrolledStudents || []); setIsStudentListOpen(true); }}><Users className="h-3 w-3 mr-1"/> {course.studentCount}</Button></TableCell>
                                                <TableCell className="text-right pr-4">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            {activeTab === 'active' ? (<><DropdownMenuItem onClick={() => openEditDialog(course)}><Pencil className="mr-2 h-4 w-4"/>Edit</DropdownMenuItem><DropdownMenuItem className="text-destructive" onClick={() => { setArchivingCourse(course); setIsArchiveDialogOpen(true); }}><Trash2 className="mr-2 h-4 w-4"/>Archive</DropdownMenuItem></>) 
                                                            : (<DropdownMenuItem onClick={() => handleUpdateCourseStatus(course.id, 'active')}><Undo2 className="mr-2 h-4 w-4"/>Restore</DropdownMenuItem>)}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))}</TableBody>
                                    </Table>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </CardContent>
            </Card>

            <Dialog open={isStudentListOpen} onOpenChange={setIsStudentListOpen}>
                <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
                    <DialogHeader><DialogTitle>Enrolled Students</DialogTitle><DialogDescription>Current active students for {selectedCourseForList?.name}.</DialogDescription></DialogHeader>
                    <div className="flex-1 overflow-auto rounded-md border mt-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-4">ID</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead className="pr-4 text-right">Semester</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>{viewingStudents.map(s => (<TableRow key={s.uid}><TableCell className="font-mono text-xs pl-4">{s.id}</TableCell><TableCell className="font-medium text-sm">{s.name}</TableCell><TableCell className="text-xs pr-4 text-right">{s.semesterName}</TableCell></TableRow>))}</TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Archive Course?</AlertDialogTitle><div className="space-y-2 pt-2"><Label>Reason</Label><Input value={archiveReason} onChange={e => setArchiveReason(e.target.value)} /></div></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleArchiveSubmit}>Archive</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
