
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Loader2, Trash2, Undo2, MoreVertical, Pencil, Users, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ref, set, push, get, child, serverTimestamp, update, remove } from 'firebase/database';
import { auth, db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from '@/components/ui/checkbox';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type Lecturer = {
    uid: string;
    name: string;
};

type StudentEnrollment = {
    uid: string;
    name: string;
    id: string; // STU-001
    semesterName: string;
}

type Course = {
    id: string;
    name: string;
    code: string;
    cost: number;
    year: number;
    lecturerId: string;
    lecturerName?: string;
    status: 'active' | 'archived';
    archiveReason?: string;
    studentCount?: number;
    enrolledStudents?: StudentEnrollment[];
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
    const [viewingStudents, setViewingStudents] = React.useState<StudentEnrollment[]>([]);
    const [activeTab, setActiveTab] = React.useState('active');
    const [isArchiveDialogOpen, setIsArchiveDialogOpen] = React.useState(false);
    const [archivingCourse, setArchivingCourse] = React.useState<Course | null>(null);
    const [archiveReason, setArchiveReason] = React.useState('');
    const [editingCourse, setEditingCourse] = React.useState<Course | null>(null);
    const [currentAdmin, setCurrentAdmin] = React.useState<CurrentAdmin | null>(null);

    // Filter states
    const [searchTerm, setSearchTerm] = React.useState('');
    const [yearFilter, setYearFilter] = React.useState('all');


    // Form state
    const [courseName, setCourseName] = React.useState('');
    const [courseCode, setCourseCode] = React.useState('');
    const [courseCost, setCourseCost] = React.useState('');
    const [courseYear, setCourseYear] = React.useState('');
    const [selectedLecturerId, setSelectedLecturerId] = React.useState('');
    const [selectedProgrammes, setSelectedProgrammes] = React.useState<Record<string, boolean>>({});

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
            const [usersSnap, coursesSnap, programmesSnap, registrationsSnap] = await Promise.all([
                get(ref(db, 'users')),
                get(ref(db, 'courses')),
                get(ref(db, 'programmes')),
                get(ref(db, 'registrations'))
            ]);
            
            // Fetch Lecturers
            const lecturersList: Lecturer[] = [];
            if (usersSnap.exists()) {
                const usersData = usersSnap.val();
                Object.keys(usersData).forEach(uid => {
                    const user = usersData[uid];
                    if (user.role === 'Staff' && user.subRoles?.includes('Lecturer')) {
                        lecturersList.push({ uid, name: user.name });
                    }
                });
            }
            setLecturers(lecturersList);
            
            // Fetch Programmes
            if(programmesSnap.exists()) {
                const programmesData = programmesSnap.val();
                setProgrammes(Object.keys(programmesData).map(id => ({id, ...programmesData[id]})));
            } else {
                setProgrammes([]);
            }

            const userMap = new Map<string, any>();
            if (usersSnap.exists()) {
                Object.entries(usersSnap.val()).forEach(([uid, userData]) => userMap.set(uid, userData));
            }

            const courseEnrollments: Record<string, StudentEnrollment[]> = {};
            if (registrationsSnap.exists()) {
                const regs = registrationsSnap.val();
                for (const userId in regs) {
                    for (const semesterId in regs[userId]) {
                        const registration = regs[userId][semesterId];
                        if (registration.status === 'Completed' || registration.status === 'Pending Payment') {
                            registration.courses.forEach((courseId: string) => {
                                if (!courseEnrollments[courseId]) {
                                    courseEnrollments[courseId] = [];
                                }
                                const studentData = userMap.get(userId);
                                if (studentData) {
                                     courseEnrollments[courseId].push({ uid: userId, name: studentData.name, id: studentData.id, semesterName: registration.semesterName });
                                }
                            });
                        }
                    }
                }
            }


            if (coursesSnap.exists()) {
                const coursesData = coursesSnap.val();
                const coursesList: Course[] = Object.keys(coursesData).map(key => ({
                    id: key,
                    ...coursesData[key],
                    status: coursesData[key].status || 'active',
                    lecturerName: userMap.get(coursesData[key].lecturerId)?.name || 'N/A',
                    enrolledStudents: courseEnrollments[key] || [],
                    studentCount: (courseEnrollments[key] || []).length
                }));
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
        setSelectedLecturerId('');
        setSelectedProgrammes({});
        setEditingCourse(null);
    };
    
    const openEditDialog = (course: Course) => {
        setEditingCourse(course);
        setCourseName(course.name);
        setCourseCode(course.code);
        setCourseCost(String(course.cost));
        setCourseYear(String(course.year));
        setSelectedLecturerId(course.lecturerId);
        
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
        if (!courseName || !courseCode || !selectedLecturerId || !courseCost || !courseYear) {
            toast({
                variant: 'destructive',
                title: 'Missing Fields',
                description: 'Please fill out all fields to add or update a course.',
            });
            return;
        }
        setFormLoading(true);
        
        const courseData = {
            name: courseName,
            code: courseCode,
            cost: Number(courseCost),
            year: Number(courseYear),
            lecturerId: selectedLecturerId,
            status: 'active' as 'active',
        };

        try {
            let courseId = editingCourse?.id;
            const updates: Record<string, any> = {};

            if (editingCourse) {
                // Update existing course
                updates[`/courses/${editingCourse.id}`] = courseData;
            } else {
                // Add new course
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
            
            // Update programme links
            programmes.forEach(prog => {
                const isSelected = selectedProgrammes[prog.id];
                const isCurrentlyLinked = prog.courseIds && prog.courseIds[courseId!];
                
                if (isSelected && !isCurrentlyLinked) {
                    updates[`/programmes/${prog.id}/courseIds/${courseId!}`] = true;
                } else if (!isSelected && isCurrentlyLinked) {
                    updates[`/programmes/${prog.id}/courseIds/${courseId!}`] = null; // Deletes the key
                }
            });
            
            await update(ref(db), updates);

            toast({ variant: 'success', title: editingCourse ? 'Course Updated' : 'Course Added' });
            fetchData();
            resetForm();
            setIsDialogOpen(false);
        } catch (error: any) {
            console.error('Error saving course:', error);
            toast({
                variant: 'destructive',
                title: 'Failed to save course',
                description: error.message || 'An unexpected error occurred.',
            });
        } finally {
            setFormLoading(false);
        }
    };
    
    const handleUpdateCourseStatus = async (courseId: string, status: 'active' | 'archived', reason: string = '') => {
        try {
            const courseRef = ref(db, `courses/${courseId}`);
            const updates: Partial<Course> = { status };

            if (status === 'archived') {
                updates.archiveReason = reason;
            } else {
                 updates.archiveReason = '';
            }
            
            await update(courseRef, updates);
            fetchData();

            toast({
                variant: 'success',
                title: `Course ${status === 'archived' ? 'Archived' : 'Restored'}`,
                description: `The course has been successfully ${status}.`,
            });
        } catch (error: any) {
             toast({
                variant: 'destructive',
                title: `Failed to ${status} course`,
                description: error.message || 'An unexpected error occurred.',
            });
        }
    };

    const handleArchiveSubmit = () => {
        if (!archivingCourse) return;
        if (!archiveReason.trim()) {
            toast({
                variant: 'destructive',
                title: 'Reason Required',
                description: 'Please provide a reason for archiving the course.',
            });
            return;
        }
        handleUpdateCourseStatus(archivingCourse.id, 'archived', archiveReason);
        setIsArchiveDialogOpen(false);
        setArchivingCourse(null);
        setArchiveReason('');
    };
    
    const handleProgrammeSelection = (programmeId: string) => {
        setSelectedProgrammes(prev => {
            const newSelection = { ...prev };
            if (newSelection[programmeId]) {
                delete newSelection[programmeId];
            } else {
                newSelection[programmeId] = true;
            }
            return newSelection;
        });
    };

    const handleViewStudents = (students: StudentEnrollment[]) => {
        setViewingStudents(students.sort((a,b) => a.semesterName.localeCompare(b.semesterName) || a.name.localeCompare(b.name)));
        setIsStudentListOpen(true);
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
            const yearKey = `Year ${course.year}`;
            if (!acc[yearKey]) {
                acc[yearKey] = [];
            }
            acc[yearKey].push(course);
            return acc;
        }, {} as Record<string, Course[]>);
    }, [courses, activeTab, searchTerm, yearFilter]);

    return (
        <Card className="shadow-lg">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <CardTitle className="font-headline text-2xl">Course Management</CardTitle>
                    <CardDescription>Create new courses and assign them to lecturers and programmes.</CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={(isOpen) => { setIsDialogOpen(isOpen); if (!isOpen) resetForm(); }}>
                    <DialogTrigger asChild>
                        <Button>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add Course
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                        <form onSubmit={handleFormSubmit}>
                            <DialogHeader>
                                <DialogTitle className="font-headline">{editingCourse ? 'Edit Course' : 'Add New Course'}</DialogTitle>
                                <DialogDescription>
                                    Define the course details and assign a lecturer and programmes.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid max-h-[70vh] gap-4 overflow-y-auto py-4 pr-4">
                                <div className="space-y-1">
                                    <Label htmlFor="courseName">Name</Label>
                                    <Input id="courseName" placeholder="e.g., Intro to AI" value={courseName} onChange={e => setCourseName(e.target.value)} disabled={formLoading} />
                                </div>
                                 <div className="space-y-1">
                                    <Label htmlFor="courseCode">Code</Label>
                                    <Input id="courseCode" placeholder="e.g., CS-401" value={courseCode} onChange={e => setCourseCode(e.target.value)} disabled={formLoading} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label htmlFor="courseCost">Cost (ZMW)</Label>
                                        <Input id="courseCost" type="number" placeholder="e.g., 1500" value={courseCost} onChange={e => setCourseCost(e.target.value)} disabled={formLoading}/>
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="courseYear">Year</Label>
                                        <Input id="courseYear" type="number" placeholder="e.g., 1" value={courseYear} onChange={e => setCourseYear(e.target.value)} disabled={formLoading}/>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="lecturer">Lecturer</Label>
                                    <Select onValueChange={setSelectedLecturerId} value={selectedLecturerId} disabled={formLoading}>
                                        <SelectTrigger><SelectValue placeholder="Select a lecturer" /></SelectTrigger>
                                        <SelectContent>
                                            {lecturers.length > 0 ? (
                                                lecturers.map(lecturer => ( <SelectItem key={lecturer.uid} value={lecturer.uid}>{lecturer.name}</SelectItem> ))
                                            ) : ( <SelectItem value="none" disabled>No lecturers found</SelectItem> )}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Programmes</Label>
                                    <div className="space-y-2 rounded-md border p-4 max-h-40 overflow-y-auto">
                                        {programmes.map(prog => (
                                            <div key={prog.id} className="flex items-center gap-2">
                                                <Checkbox
                                                    id={`prog-${prog.id}`}
                                                    checked={!!selectedProgrammes[prog.id]}
                                                    onCheckedChange={() => handleProgrammeSelection(prog.id)}
                                                />
                                                <Label htmlFor={`prog-${prog.id}`} className="font-normal">{prog.name}</Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <DialogFooter className="pt-4">
                                <DialogClose asChild>
                                    <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                                </DialogClose>
                                <Button type="submit" disabled={formLoading}>
                                    {formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingCourse ? 'Save Changes' : 'Add Course'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
                    <TabsList>
                        <TabsTrigger value="active">Active</TabsTrigger>
                        <TabsTrigger value="archived">Archived</TabsTrigger>
                    </TabsList>
                </Tabs>
                <div className="flex gap-4 mb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search by code or name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                    <Select value={yearFilter} onValueChange={setYearFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by year" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Years</SelectItem>
                            <SelectItem value="1">Year 1</SelectItem>
                            <SelectItem value="2">Year 2</SelectItem>
                            <SelectItem value="3">Year 3</SelectItem>
                            <SelectItem value="4">Year 4</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <AlertDialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
                    <Accordion type="multiple" defaultValue={Object.keys(filteredAndGroupedCourses)} className="w-full">
                        {loading ? (
                            <Skeleton className="h-48 w-full" />
                        ) : Object.keys(filteredAndGroupedCourses).length > 0 ? (
                           Object.entries(filteredAndGroupedCourses).sort(([a],[b]) => parseInt(a.replace('Year ', '')) - parseInt(b.replace('Year ', ''))).map(([year, courses]) => (
                               <AccordionItem value={year} key={year}>
                                   <AccordionTrigger className="font-bold text-lg">{year} Courses ({courses.length})</AccordionTrigger>
                                   <AccordionContent>
                                       <Table>
                                           <TableHeader>
                                                <TableRow>
                                                   <TableHead>Course Code</TableHead>
                                                   <TableHead>Course Name</TableHead>
                                                   <TableHead>Lecturer</TableHead>
                                                   <TableHead>Students</TableHead>
                                                   {activeTab === 'archived' && <TableHead>Reason</TableHead>}
                                                   <TableHead className="text-right">Actions</TableHead>
                                               </TableRow>
                                           </TableHeader>
                                           <TableBody>
                                               {courses.map((course) => (
                                                   <TableRow key={course.id}>
                                                       <TableCell className="font-medium">{course.code}</TableCell>
                                                       <TableCell>{course.name}</TableCell>
                                                       <TableCell>{course.lecturerName}</TableCell>
                                                       <TableCell>
                                                           <Button variant="link" className="p-0 h-auto" onClick={() => handleViewStudents(course.enrolledStudents || [])}>
                                                               {course.studentCount || 0}
                                                           </Button>
                                                       </TableCell>
                                                       {activeTab === 'archived' && <TableCell>{course.archiveReason || 'N/A'}</TableCell>}
                                                       <TableCell className="text-right">
                                                           <DropdownMenu>
                                                               <DropdownMenuTrigger asChild>
                                                                   <Button variant="ghost" className="h-8 w-8 p-0">
                                                                       <span className="sr-only">Open menu</span>
                                                                       <MoreVertical className="h-4 w-4" />
                                                                   </Button>
                                                               </DropdownMenuTrigger>
                                                               <DropdownMenuContent align="end">
                                                                   <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                                   {activeTab === 'active' ? (
                                                                       <>
                                                                       <DropdownMenuItem onClick={() => openEditDialog(course)}>
                                                                           <Pencil className="mr-2 h-4 w-4" />
                                                                           Edit
                                                                       </DropdownMenuItem>
                                                                       <AlertDialogTrigger asChild>
                                                                           <DropdownMenuItem 
                                                                               className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                                                               onClick={() => setArchivingCourse(course)}
                                                                           >
                                                                               <Trash2 className="mr-2 h-4 w-4" />
                                                                               Archive
                                                                           </DropdownMenuItem>
                                                                       </AlertDialogTrigger>
                                                                       </>
                                                                   ) : (
                                                                       <DropdownMenuItem onClick={() => handleUpdateCourseStatus(course.id, 'active')}>
                                                                           <Undo2 className="mr-2 h-4 w-4" />
                                                                           Restore
                                                                       </DropdownMenuItem>
                                                                   )}
                                                               </DropdownMenuContent>
                                                           </DropdownMenu>
                                                       </TableCell>
                                                   </TableRow>
                                               ))}
                                           </TableBody>
                                       </Table>
                                   </AccordionContent>
                               </AccordionItem>
                           ))
                        ) : (
                            <div className="text-center text-muted-foreground py-10">No {activeTab} courses found matching the current filters.</div>
                        )}
                    </Accordion>

                     <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will archive the course and hide it from student registration. You can restore it later from the archived tab.
                            </AlertDialogDescription>
                             <div className="space-y-2 pt-2">
                                <Label htmlFor="archiveReason">Reason for Archiving</Label>
                                <Input 
                                    id="archiveReason" 
                                    placeholder="e.g., Semester Ended, Course Canceled" 
                                    value={archiveReason}
                                    onChange={(e) => setArchiveReason(e.target.value)}
                                />
                            </div>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => { setArchivingCourse(null); setArchiveReason(''); }}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleArchiveSubmit} className="bg-destructive hover:bg-destructive/90">
                                Yes, archive it
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <Dialog open={isStudentListOpen} onOpenChange={setIsStudentListOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Enrolled Students</DialogTitle>
                        </DialogHeader>
                        <div className="max-h-[60vh] overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Student ID</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Semester</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {viewingStudents.length > 0 ? viewingStudents.map(s => (
                                        <TableRow key={s.uid}>
                                            <TableCell>{s.id}</TableCell>
                                            <TableCell>{s.name}</TableCell>
                                            <TableCell>{s.semesterName}</TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center">No students enrolled.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}
