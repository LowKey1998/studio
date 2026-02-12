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
import { PlusCircle, Loader2, Trash2, Undo2, MoreVertical, Pencil, Users, Search, GraduationCap, BookCopy, Download } from 'lucide-react';
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
import { ref, get, child, serverTimestamp, update, remove, push } from 'firebase/database';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Switch } from '@/components/ui/switch';

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
    const [editingCourse, setEditingCourse] = React.useState<Course | null>(null);
    const [currentAdmin, setCurrentAdmin] = React.useState<CurrentAdmin | null>(null);

    // Filter states
    const [searchTerm, setSearchTerm] = React.useState('');
    const [yearFilter, setYearFilter] = React.useState('all');


    // Form state
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
            const [usersSnap, coursesSnap, programmesSnap, registrationsSnap] = await Promise.all([
                get(ref(db, 'users')),
                get(ref(db, 'courses')),
                get(ref(db, 'programmes')),
                get(ref(db, 'registrations'))
            ]);
            
            const userMap = new Map<string, any>();
            if (usersSnap.exists()) {
                Object.entries(usersSnap.val() as Record<string, any>).forEach(([uid, userData]) => userMap.set(uid, userData));
            }

            // Fetch Lecturers
            const lecturersList: Lecturer[] = [];
            userMap.forEach((user, uid) => {
                if (user.role === 'Staff' && user.subRoles?.includes('Lecturer')) {
                    lecturersList.push({ uid, name: user.name });
                }
            });
            setLecturers(lecturersList);
            
            // Fetch Programmes
            if(programmesSnap.exists()) {
                const programmesData = programmesSnap.val();
                setProgrammes(Object.keys(programmesData).map(id => ({id, ...programmesData[id]})));
            } else {
                setProgrammes([]);
            }

            const courseEnrollments: Record<string, StudentEnrollment[]> = {};
            if (registrationsSnap.exists()) {
                const regs = registrationsSnap.val();
                for (const userId in regs) {
                    for (const semesterId in regs[userId]) {
                        const registration = regs[userId][semesterId];
                        if (registration.status === 'Completed' || registration.status === 'Pending Payment') {
                            registration.courses?.forEach((courseId: string) => {
                                if (!courseEnrollments[courseId]) {
                                    courseEnrollments[courseId] = [];
                                }
                                const studentData = userMap.get(userId);
                                if (studentData) {
                                     courseEnrollments[courseId].push({ 
                                         uid: userId, 
                                         name: studentData.name, 
                                         id: studentData.id, 
                                         semesterName: registration.semesterName || 'Unknown' 
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
            toast({
                variant: 'destructive',
                title: 'Missing Fields',
                description: 'Please provide at least a Course Name and Course Code.',
            });
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
                updates[`/courses/${editingCourse.id}`] = {
                    ...editingCourse,
                    ...courseData
                };
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
            
            // Update programme links
            programmes.forEach(prog => {
                const isSelected = selectedProgrammes[prog.id];
                const isCurrentlyLinked = prog.courseIds && prog.courseIds[courseId!];
                
                if (isSelected && !isCurrentlyLinked) {
                    updates[`/programmes/${prog.id}/courseIds/${courseId!}`] = true;
                } else if (!isSelected && isCurrentlyLinked) {
                    updates[`/programmes/${prog.id}/courseIds/${courseId!}`] = null;
                }
            });
            
            await update(ref(db), updates);

            toast({ title: editingCourse ? 'Course Updated' : 'Course Added' });
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
                title: `Course ${status === 'archived' ? 'Archived' : 'Restored'}`,
                description: `The course has been successfully moved to ${status === 'archived' ? 'archives' : 'active courses'}.`,
            });
        } catch (error: any) {
             toast({
                variant: 'destructive',
                title: `Failed to ${status === 'archived' ? 'archive' : 'restore'} course`,
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

    const handleViewStudents = (course: Course) => {
        setSelectedCourseForList(course);
        setViewingStudents((course.enrolledStudents || []).sort((a,b) => a.semesterName.localeCompare(b.semesterName) || a.name.localeCompare(b.name)));
        setIsStudentListOpen(true);
    };

    const handleDownloadClassList = () => {
        if (!selectedCourseForList) return;
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text(`Class List: ${selectedCourseForList.name} (${selectedCourseForList.code})`, 14, 22);
        doc.setFontSize(11);
        doc.text(`Total Enrolled: ${viewingStudents.length}`, 14, 30);
        
        autoTable(doc, {
            startY: 35,
            head: [['Student ID', 'Full Name', 'Active Semester']],
            body: viewingStudents.map(s => [s.id, s.name, s.semesterName]),
            theme: 'striped',
            headStyles: { fillColor: [34, 34, 34] }
        });
        
        doc.save(`ClassList_${selectedCourseForList.code}_${new Date().toISOString().split('T')[0]}.pdf`);
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
            if (!acc[yearKey]) {
                acc[yearKey] = [];
            }
            acc[yearKey].push(course);
            return acc;
        }, {} as Record<string, Course[]>);
    }, [courses, activeTab, searchTerm, yearFilter]);

    return (
        <Card className="shadow-lg border-0">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <CardTitle className="font-headline text-2xl">Academic Course Management</CardTitle>
                    <CardDescription>Configure course details, credits, and programme assignments.</CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={(isOpen) => { setIsDialogOpen(isOpen); if (!isOpen) resetForm(); }}>
                    <DialogTrigger asChild>
                        <Button>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add New Course
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl">
                        <form onSubmit={handleFormSubmit}>
                            <DialogHeader>
                                <DialogTitle className="font-headline">{editingCourse ? 'Edit Course' : 'Create New Course'}</DialogTitle>
                                <DialogDescription>
                                    Define academic parameters and assign a lecturer.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid max-h-[70vh] gap-6 overflow-y-auto py-4 pr-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label htmlFor="courseName">Course Name *</Label>
                                        <Input id="courseName" placeholder="e.g., Clinical Nursing II" value={courseName} onChange={e => setCourseName(e.target.value)} disabled={formLoading} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="courseCode">Course Code *</Label>
                                        <Input id="courseCode" placeholder="e.g., NUR-201" value={courseCode} onChange={e => setCourseCode(e.target.value)} disabled={formLoading} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1">
                                        <Label htmlFor="courseCredits">Credits (Optional)</Label>
                                        <Input id="courseCredits" type="number" placeholder="e.g., 3" value={courseCredits} onChange={e => setCourseCredits(e.target.value)} disabled={formLoading}/>
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="courseCost">Cost (ZMW) (Optional)</Label>
                                        <Input id="courseCost" type="number" placeholder="e.g., 1500" value={courseCost} onChange={e => setCourseCost(e.target.value)} disabled={formLoading}/>
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="courseYear">Academic Year (Optional)</Label>
                                        <Input id="courseYear" type="number" placeholder="e.g., 1" value={courseYear} onChange={e => setCourseYear(e.target.value)} disabled={formLoading}/>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="lecturer">Lecturer (Optional)</Label>
                                    <Select onValueChange={setSelectedLecturerId} value={selectedLecturerId} disabled={formLoading}>
                                        <SelectTrigger><SelectValue placeholder="Select a lecturer" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Unassigned / No Lecturer</SelectItem>
                                            {lecturers.map(lecturer => ( <SelectItem key={lecturer.uid} value={lecturer.uid}>{lecturer.name}</SelectItem> ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center space-x-2 py-2 p-4 border rounded-md bg-primary/5">
                                    <Switch id="separate-instance" checked={separateInstance} onCheckedChange={setSeparateInstance} />
                                    <div className="space-y-0.5">
                                        <Label htmlFor="separate-instance" className="text-sm font-bold">Make separate instance per intake</Label>
                                        <p className="text-[10px] text-muted-foreground italic leading-tight">If enabled, this course will have independent session schedules for each intake cohort.</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Assign to Programmes (Optional)</Label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-md border p-4 max-h-48 overflow-y-auto bg-muted/20">
                                        {programmes.map(prog => (
                                            <div key={prog.id} className="flex items-center gap-2">
                                                <Checkbox
                                                    id={`prog-${prog.id}`}
                                                    checked={!!selectedProgrammes[prog.id]}
                                                    onCheckedChange={() => handleProgrammeSelection(prog.id)}
                                                />
                                                <Label htmlFor={`prog-${prog.id}`} className="font-normal text-sm cursor-pointer">{prog.name}</Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <DialogFooter className="pt-4 border-t">
                                <DialogClose asChild>
                                    <Button variant="outline" type="button">Cancel</Button>
                                </DialogClose>
                                <Button type="submit" disabled={formLoading}>
                                    {formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingCourse ? 'Save Changes' : 'Create Course'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
                    <TabsList>
                        <TabsTrigger value="active">Active Catalog</TabsTrigger>
                        <TabsTrigger value="archived">Archived / Legacy</TabsTrigger>
                    </TabsList>
                </Tabs>
                <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 border rounded-lg bg-muted/10">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search code or name..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 bg-background"
                        />
                    </div>
                    <Select value={yearFilter} onValueChange={setYearFilter}>
                        <SelectTrigger className="w-full md:w-[180px] bg-background">
                            <SelectValue placeholder="Year Filter" />
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
                    <Accordion type="multiple" defaultValue={Object.keys(filteredAndGroupedCourses)} className="w-full space-y-4">
                        {loading ? (
                            Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-md"/>)
                        ) : Object.keys(filteredAndGroupedCourses).length > 0 ? (
                           Object.entries(filteredAndGroupedCourses).sort(([a],[b]) => {
                               const numA = parseInt(a.replace('Year ', ''));
                               const numB = parseInt(b.replace('Year ', ''));
                               if (isNaN(numA)) return 1;
                               if (isNaN(numB)) return -1;
                               return numA - numB;
                           }).map(([year, courses]) => (
                               <AccordionItem value={year} key={year} className="border rounded-lg bg-card overflow-hidden">
                                   <AccordionTrigger className="font-bold text-lg px-4 hover:no-underline">{year} Courses <Badge variant="outline" className="ml-2">{courses.length}</Badge></AccordionTrigger>
                                   <AccordionContent className="px-0">
                                       <Table>
                                           <TableHeader>
                                                <TableRow className="bg-muted/30">
                                                   <TableHead className="pl-4">Code</TableHead>
                                                   <TableHead>Name</TableHead>
                                                   <TableHead>Lecturer(s)</TableHead>
                                                   <TableHead>Students</TableHead>
                                                   {activeTab === 'archived' && <TableHead>Archive Reason</TableHead>}
                                                   <TableHead className="text-right pr-4">Actions</TableHead>
                                               </TableRow>
                                           </TableHeader>
                                           <TableBody>
                                               {courses.map((course) => (
                                                   <TableRow key={course.id}>
                                                       <TableCell className="font-mono text-xs pl-4">{course.code}</TableCell>
                                                       <TableCell>
                                                           <div className="flex flex-col">
                                                               <span className="font-medium">{course.name}</span>
                                                               {course.credits && <span className="text-[10px] text-muted-foreground">{course.credits} Credits</span>}
                                                           </div>
                                                       </TableCell>
                                                       <TableCell className="text-sm">{course.lecturerName}</TableCell>
                                                       <TableCell>
                                                           <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => handleViewStudents(course)}>
                                                               <Users className="h-3 w-3 mr-1"/> {course.studentCount || 0}
                                                           </Button>
                                                       </TableCell>
                                                       {activeTab === 'archived' && <TableHead className="text-xs italic">{course.archiveReason || 'N/A'}</TableHead>}
                                                       <TableCell className="text-right pr-4">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    {activeTab === 'active' ? (
                                                                        <>
                                                                        <DropdownMenuItem onClick={() => openEditDialog(course)}><Pencil className="mr-2 h-4 w-4"/>Edit Details</DropdownMenuItem>
                                                                        <DropdownMenuItem onClick={() => handleViewStudents(course)}><Users className="mr-2 h-4 w-4"/>View Class List</DropdownMenuItem>
                                                                        <DropdownMenuSeparator />
                                                                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { setArchivingCourse(course); setIsArchiveDialogOpen(true); }}>
                                                                            <Trash2 className="mr-2 h-4 w-4"/>Archive Course
                                                                        </DropdownMenuItem>
                                                                        </>
                                                                    ) : (
                                                                        <DropdownMenuItem onClick={() => handleUpdateCourseStatus(course.id, 'active')}><Undo2 className="mr-2 h-4 w-4"/>Restore Course</DropdownMenuItem>
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
                            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                <BookCopy className="h-12 w-12 opacity-20 mb-4" />
                                <p>No {activeTab} courses found matching the filters.</p>
                            </div>
                        )}
                    </Accordion>

                     <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Archive Course?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This course will be moved to the legacy tab. Please provide a reason for archiving.
                            </AlertDialogDescription>
                             <div className="space-y-2 pt-2">
                                <Label htmlFor="archiveReason">Reason for Archiving</Label>
                                <Input 
                                    id="archiveReason" 
                                    placeholder="e.g., Curriculum update, End of cycle" 
                                    value={archiveReason}
                                    onChange={(e) => setArchiveReason(e.target.value)}
                                />
                            </div>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => { setArchivingCourse(null); setArchiveReason(''); }}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleArchiveSubmit} className="bg-destructive hover:bg-destructive/90">
                                Confirm Archive
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <Dialog open={isStudentListOpen} onOpenChange={setIsStudentListOpen}>
                    <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
                        <DialogHeader>
                            <div className="flex justify-between items-center pr-8">
                                <div>
                                    <DialogTitle>Enrolled Students</DialogTitle>
                                    <DialogDescription>List of students currently enrolled in {selectedCourseForList?.name}.</DialogDescription>
                                </div>
                                <Button onClick={handleDownloadClassList} size="sm" variant="outline" className="shrink-0"><Download className="mr-2 h-4 w-4"/>Download List</Button>
                            </div>
                        </DialogHeader>
                        <div className="flex-1 overflow-auto rounded-md border mt-4">
                            <Table>
                                <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                                    <TableRow>
                                        <TableHead className="pl-4">Student ID</TableHead>
                                        <TableHead>Full Name</TableHead>
                                        <TableHead className="pr-4 text-right">Active Semester</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {viewingStudents.length > 0 ? viewingStudents.map(s => (
                                        <TableRow key={s.uid}>
                                            <TableCell className="font-mono text-xs pl-4">{s.id}</TableCell>
                                            <TableCell className="font-medium text-sm">{s.name}</TableCell>
                                            <TableCell className="text-xs pr-4 text-right">{s.semesterName}</TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={3} className="h-32 text-center text-muted-foreground italic">No students enrolled.</TableCell>
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
