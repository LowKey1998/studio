
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, Trash2, FileText, X, Search, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, get, set, push, onValue, remove, update } from 'firebase/database';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Course = {
    id: string;
    name: string;
    code: string;
    year: number;
};

type Programme = {
    id: string;
    name: string;
    courseIds?: Record<string, boolean>;
};

type Lecturer = {
    uid: string;
    name: string;
};


export default function ProgrammesPage() {
    const [programmes, setProgrammes] = React.useState<Programme[]>([]);
    const [allCourses, setAllCourses] = React.useState<Course[]>([]);
    const [lecturers, setLecturers] = React.useState<Lecturer[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [formLoading, setFormLoading] = React.useState(false);
    
    // Edit Programme Dialog State
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingProgramme, setEditingProgramme] = React.useState<Programme | null>(null);
    const [programmeName, setProgrammeName] = React.useState('');
    const [selectedCourses, setSelectedCourses] = React.useState<Record<string, boolean>>({});
    const [courseSearchTerm, setCourseSearchTerm] = React.useState('');
    
    // Create Course Dialog State
    const [isCourseDialogOpen, setIsCourseDialogOpen] = React.useState(false);
    const [courseName, setCourseName] = React.useState('');
    const [courseCode, setCourseCode] = React.useState('');
    const [courseCost, setCourseCost] = React.useState('');
    const [courseYear, setCourseYear] = React.useState('');
    const [selectedLecturerId, setSelectedLecturerId] = React.useState('');
    const [courseFormLoading, setCourseFormLoading] = React.useState(false);


    const { toast } = useToast();
    
    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [usersSnap, coursesSnap, programmesSnap] = await Promise.all([
                get(ref(db, 'users')),
                get(ref(db, 'courses')),
                get(ref(db, 'programmes'))
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
            
            // Fetch Courses
            setAllCourses(coursesSnap.exists() ? Object.keys(coursesSnap.val()).map(key => ({ id: key, ...coursesSnap.val()[key] })) : []);
            
            // Fetch Programmes
            setProgrammes(programmesSnap.exists() ? Object.keys(programmesSnap.val()).map(key => ({ id: key, ...programmesSnap.val()[key] })) : []);

        } catch(e) {
            console.error(e);
            toast({ variant: "destructive", title: "Failed to load data" });
        } finally {
            setLoading(false);
        }
    }, [toast]);


    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const resetDialog = () => {
        setIsDialogOpen(false);
        setEditingProgramme(null);
        setProgrammeName('');
        setSelectedCourses({});
        setCourseSearchTerm('');
    };

    const resetCourseForm = () => {
        setCourseName('');
        setCourseCode('');
        setCourseCost('');
        setCourseYear('');
        setSelectedLecturerId('');
    };

    const handleOpenDialog = (programme: Programme | null = null) => {
        if (programme) {
            setEditingProgramme(programme);
            setProgrammeName(programme.name);
            setSelectedCourses(programme.courseIds || {});
        } else {
            setEditingProgramme(null);
            setProgrammeName('');
            setSelectedCourses({});
        }
        setIsDialogOpen(true);
    };

    const handleCourseSelection = (courseId: string) => {
        setSelectedCourses(prev => {
            const newSelection = { ...prev };
            if (newSelection[courseId]) {
                delete newSelection[courseId];
            } else {
                newSelection[courseId] = true;
            }
            return newSelection;
        });
    };

    const handleFormSubmit = async () => {
        if (!programmeName) {
            toast({ variant: 'destructive', title: 'Programme name is required.' });
            return;
        }
        setFormLoading(true);
        try {
            const programmeData = {
                name: programmeName,
                courseIds: selectedCourses,
            };

            if (editingProgramme) {
                await update(ref(db, `programmes/${editingProgramme.id}`), programmeData);
                toast({ title: 'Programme Updated', description: `"${programmeName}" has been updated.` });
            } else {
                const newProgrammeRef = push(ref(db, 'programmes'));
                await set(newProgrammeRef, programmeData);
                toast({ title: 'Programme Created', description: `"${programmeName}" has been successfully created.` });
            }
            resetDialog();
            fetchData();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Operation Failed', description: error.message });
        } finally {
            setFormLoading(false);
        }
    };
    
     const handleCreateCourse = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!courseName || !courseCode || !selectedLecturerId || !courseCost || !courseYear) {
            toast({ variant: 'destructive', title: 'Missing Fields', description: 'Please fill out all fields to add a course.' });
            return;
        }
        setCourseFormLoading(true);
        try {
            const courseData = {
                name: courseName,
                code: courseCode,
                cost: Number(courseCost),
                year: Number(courseYear),
                lecturerId: selectedLecturerId,
                status: 'active' as 'active',
            };
            const newCourseRef = push(ref(db, 'courses'));
            await set(newCourseRef, courseData);
            
            toast({ variant: 'success', title: 'Course Added' });
            fetchData(); // Refetch all data to update the course list
            resetCourseForm();
            setIsCourseDialogOpen(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to add course', description: error.message });
        } finally {
            setCourseFormLoading(false);
        }
    };

    const handleDeleteProgramme = async (programmeId: string) => {
        if (!window.confirm("Are you sure you want to delete this programme? This action cannot be undone.")) return;
        try {
            await remove(ref(db, `programmes/${programmeId}`));
            toast({ title: 'Programme Deleted' });
            fetchData();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Deletion Failed', description: error.message });
        }
    }
    
    const filteredAndGroupedCourses = React.useMemo(() => {
        const filtered = allCourses.filter(course => 
            course.name.toLowerCase().includes(courseSearchTerm.toLowerCase()) ||
            course.code.toLowerCase().includes(courseSearchTerm.toLowerCase())
        );

        return filtered.reduce((acc, course) => {
            const yearKey = `Year ${course.year}`;
            if (!acc[yearKey]) acc[yearKey] = [];
            acc[yearKey].push(course);
            return acc;
        }, {} as Record<string, Course[]>);
    }, [allCourses, courseSearchTerm]);

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div className="space-y-1">
                    <CardTitle className="font-headline text-2xl">Programme Management</CardTitle>
                    <CardDescription>Create academic programmes and assign courses to them.</CardDescription>
                </div>
                <Button onClick={() => handleOpenDialog()}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Programme
                </Button>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                ) : programmes.length > 0 ? (
                    <div className="space-y-4">
                        {programmes.map(prog => (
                            <Card key={prog.id}>
                                <CardHeader className="flex-row items-center justify-between">
                                    <div className="space-y-1">
                                        <CardTitle>{prog.name}</CardTitle>
                                        <CardDescription>{Object.keys(prog.courseIds || {}).length} courses</CardDescription>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" onClick={() => handleOpenDialog(prog)}><Pencil className="mr-2 h-4 w-4"/>Edit</Button>
                                        <Button variant="destructive" size="icon" onClick={() => handleDeleteProgramme(prog.id)}><Trash2 className="h-4 w-4"/></Button>
                                    </div>
                                </CardHeader>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 text-muted-foreground">
                        <FileText className="mx-auto h-12 w-12" />
                        <h3 className="mt-4 text-lg font-semibold">No Programmes Found</h3>
                        <p className="mt-2 text-sm">Create the first programme to get started.</p>
                    </div>
                )}
            </CardContent>

            <Dialog open={isDialogOpen} onOpenChange={resetDialog}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingProgramme ? 'Edit' : 'Create'} Programme</DialogTitle>
                        <DialogDescription>
                            Enter a name for the programme and select the courses it contains.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-1">
                            <Label htmlFor="programme-name">Programme Name</Label>
                            <Input
                                id="programme-name"
                                value={programmeName}
                                onChange={(e) => setProgrammeName(e.target.value)}
                                placeholder="e.g., Bachelor of Science in Computer Science"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Courses</Label>
                                <Dialog open={isCourseDialogOpen} onOpenChange={setIsCourseDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Create New Course</Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <form onSubmit={handleCreateCourse}>
                                        <DialogHeader>
                                            <DialogTitle>Add New Course</DialogTitle>
                                            <DialogDescription>
                                                Create a new course that can be immediately assigned to this programme.
                                            </DialogDescription>
                                        </DialogHeader>
                                         <div className="grid gap-4 py-4">
                                            <div className="space-y-1">
                                                <Label htmlFor="courseName">Name</Label>
                                                <Input id="courseName" value={courseName} onChange={e => setCourseName(e.target.value)} disabled={courseFormLoading} />
                                            </div>
                                            <div className="space-y-1">
                                                <Label htmlFor="courseCode">Code</Label>
                                                <Input id="courseCode" value={courseCode} onChange={e => setCourseCode(e.target.value)} disabled={courseFormLoading} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <Label htmlFor="courseCost">Cost (ZMW)</Label>
                                                    <Input id="courseCost" type="number" value={courseCost} onChange={e => setCourseCost(e.target.value)} disabled={courseFormLoading}/>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor="courseYear">Year</Label>
                                                    <Input id="courseYear" type="number" value={courseYear} onChange={e => setCourseYear(e.target.value)} disabled={courseFormLoading}/>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label htmlFor="lecturer">Lecturer</Label>
                                                <Select onValueChange={setSelectedLecturerId} value={selectedLecturerId} disabled={courseFormLoading}>
                                                    <SelectTrigger><SelectValue placeholder="Select a lecturer" /></SelectTrigger>
                                                    <SelectContent>
                                                        {lecturers.map(lecturer => ( <SelectItem key={lecturer.uid} value={lecturer.uid}>{lecturer.name}</SelectItem> ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
                                            <Button type="submit" disabled={courseFormLoading}>
                                                {courseFormLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Add Course'}
                                            </Button>
                                        </DialogFooter>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Search by course name or code..." 
                                    className="pl-8 mb-2"
                                    value={courseSearchTerm}
                                    onChange={(e) => setCourseSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="max-h-[40vh] overflow-y-auto rounded-md border p-4">
                               <Accordion type="multiple" defaultValue={Object.keys(filteredAndGroupedCourses)} className="w-full">
                                    {Object.keys(filteredAndGroupedCourses).length > 0 ? Object.entries(filteredAndGroupedCourses).map(([year, courses]) => (
                                        <AccordionItem value={year} key={year}>
                                            <AccordionTrigger>{year}</AccordionTrigger>
                                            <AccordionContent>
                                                <div className="space-y-2">
                                                    {courses.map(course => (
                                                        <div key={course.id} className="flex items-center gap-2 rounded-md p-2 hover:bg-accent">
                                                            <Checkbox
                                                                id={`course-${course.id}`}
                                                                checked={!!selectedCourses[course.id]}
                                                                onCheckedChange={() => handleCourseSelection(course.id)}
                                                            />
                                                            <Label htmlFor={`course-${course.id}`} className="flex-1 cursor-pointer">
                                                                {course.name} <span className="text-muted-foreground">({course.code})</span>
                                                            </Label>
                                                        </div>
                                                    ))}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    )) : <p className="text-sm text-muted-foreground text-center py-4">No courses found. Try creating one.</p>}
                                </Accordion>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button type="button" onClick={handleFormSubmit} disabled={formLoading}>
                            {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingProgramme ? 'Save Changes' : 'Create Programme'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
