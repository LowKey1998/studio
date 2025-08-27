
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle, Trash2, GripVertical, Check, ChevronsUpDown, Info, MinusCircle, Pencil, Copy, Route, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, onValue, set, push, remove, update, get, serverTimestamp } from 'firebase/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

// --- TYPE DEFINITIONS ---
type Intake = { id: string; name: string; };
type Programme = { id: string; name: string; };
type Course = { id: string; name: string; code: string; year: number; status: 'active' | 'archived'; };
type Semester = { id: string; name: string; year: number; semesterInYear: number; intakeId: string; };
type CoursePathHistoryItem = { reason: string; oldCourses: string[]; newCourses: string[]; timestamp: any; };
type CoursePathSemester = { courses: string[]; history?: Record<string, CoursePathHistoryItem>; };
type CoursePath = { id: string; intakeId: string; programmeId: string; semesters: Record<string, CoursePathSemester> }; // Key is now semesterId
type NewSemesterEntry = { year: number | ''; semesterInYear: number | '' };

// --- MAIN PAGE COMPONENT ---
export default function CoursePathsPage() {
    const [intakes, setIntakes] = React.useState<Intake[]>([]);
    const [programmes, setProgrammes] = React.useState<Programme[]>([]);
    const [courses, setCourses] = React.useState<Course[]>([]);
    const [allSemesters, setAllSemesters] = React.useState<Semester[]>([]);
    const [coursePaths, setCoursePaths] = React.useState<CoursePath[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [activeTab, setActiveTab] = React.useState('intakes');
    const { toast } = useToast();

    // Dialog States
    const [isIntakeDialogOpen, setIsIntakeDialogOpen] = React.useState(false);
    const [editingIntake, setEditingIntake] = React.useState<Intake | null>(null);
    const [intakeName, setIntakeName] = React.useState('');
    const [savingIntake, setSavingIntake] = React.useState(false);
    
    const [isSemesterDialogOpen, setIsSemesterDialogOpen] = React.useState(false);
    const [newSemesters, setNewSemesters] = React.useState<NewSemesterEntry[]>([{ year: 1, semesterInYear: 1 }]);

    // Course Path State
    const [selectedIntake, setSelectedIntake] = React.useState('');
    const [selectedProgramme, setSelectedProgramme] = React.useState('');
    const [semesterCourses, setSemesterCourses] = React.useState<Record<string, Course[]>>({}); // Key is semesterId
    const [availableCourses, setAvailableCourses] = React.useState<Course[]>([]);
    const [activeCourse, setActiveCourse] = React.useState<Course | null>(null);
    const [targetSemester, setTargetSemester] = React.useState('');

    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = React.useState(false);
    const [viewingHistory, setViewingHistory] = React.useState<CoursePathHistoryItem[]>([]);

    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
    
    // --- Data Fetching ---
    React.useEffect(() => {
        const refs = [
            ref(db, 'intakes'),
            ref(db, 'programmes'),
            ref(db, 'courses'),
            ref(db, 'coursePaths'),
            ref(db, 'semesters')
        ];

        const fetchData = async () => {
            setLoading(true);
            try {
                const snapshots = await Promise.all(refs.map(r => get(r)));
                const [intakesSnap, programmesSnap, coursesSnap, coursePathsSnap, semestersSnap] = snapshots;

                const intakesData = intakesSnap.exists() ? intakesSnap.val() : {};
                setIntakes(Object.keys(intakesData).map(id => ({ id, ...intakesData[id] })).sort((a,b) => b.name.localeCompare(a.name)));
                
                const programmesData = programmesSnap.exists() ? programmesSnap.val() : {};
                setProgrammes(Object.keys(programmesData).map(id => ({ id, ...programmesData[id] })));
                
                const coursesData = coursesSnap.exists() ? coursesSnap.val() : {};
                setCourses(Object.keys(coursesData).map(id => ({ id, ...coursesData[id] })));

                const coursePathsData = coursePathsSnap.exists() ? coursePathsSnap.val() : {};
                setCoursePaths(Object.keys(coursePathsData).map(id => ({ id, ...coursePathsData[id] })));

                const semestersData = semestersSnap.exists() ? semestersSnap.val() : {};
                setAllSemesters(Object.keys(semestersData).map(id => ({ id, ...semestersData[id] })));
            } catch (error) {
                console.error("Failed to fetch initial data:", error);
                toast({ variant: "destructive", title: "Error", description: "Failed to load page data."});
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        
        const unsubs = refs.map((r, i) => onValue(r, (snapshot) => {
             const data = snapshot.val() || {};
            const list = Object.keys(data).map(id => ({ id, ...data[id] }));
             switch(i) {
                case 0: setIntakes(list.sort((a,b) => b.name.localeCompare(a.name))); break;
                case 1: setProgrammes(list); break;
                case 2: setCourses(list); break;
                case 3: setCoursePaths(list); break;
                case 4: setAllSemesters(list); break;
            }
        }));

        return () => unsubs.forEach(unsub => unsub());

    }, [toast]);

    // --- Course Path Logic ---
    const currentPath = React.useMemo(() => {
        return coursePaths.find(p => p.intakeId === selectedIntake && p.programmeId === selectedProgramme);
    }, [coursePaths, selectedIntake, selectedProgramme]);
    
    const semestersForPath = React.useMemo(() => {
        if (!selectedIntake) return [];
        return allSemesters.filter(s => s.intakeId === selectedIntake).sort((a,b) => a.year - b.year || a.semesterInYear - b.semesterInYear);
    }, [allSemesters, selectedIntake]);


    React.useEffect(() => {
        const newSemesterCourses: Record<string, Course[]> = {};
        const assignedCourseIds = new Set<string>();

        if (currentPath && currentPath.semesters) {
            Object.entries(currentPath.semesters).forEach(([semesterId, semesterData]) => {
                const semesterCourseIds = semesterData.courses || [];
                newSemesterCourses[semesterId] = semesterCourseIds
                    .map(id => {
                        assignedCourseIds.add(id);
                        return courses.find(c => c.id === id);
                    })
                    .filter((c): c is Course => !!c);
            });
        }
        
        setSemesterCourses(newSemesterCourses);
        const activeCourses = courses.filter(c => c.status === 'active');
        setAvailableCourses(activeCourses.filter(c => !assignedCourseIds.has(c.id)));
    }, [currentPath, courses]);
    
    const handleSaveCoursePath = async () => {
        if (!selectedIntake || !selectedProgramme) return;
        setLoading(true);

        try {
            const pathSemesters: Record<string, CoursePathSemester> = {}; // key is semesterId
            let isAnySemesterChanged = false;

            for (const semester of semestersForPath) {
                const semId = semester.id;
                const newCourseIds = new Set((semesterCourses[semId] || []).map(c => c.id));
                const oldCourseIds = new Set(currentPath?.semesters?.[semId]?.courses || []);
                
                if (newCourseIds.size !== oldCourseIds.size || [...newCourseIds].some(id => !oldCourseIds.has(id))) {
                    isAnySemesterChanged = true;
                    break;
                }
            }
            
            let changeReason = '';
            if (isAnySemesterChanged && currentPath) {
                const reason = prompt("Optional: Provide a reason for updating the course path(s) (e.g., 'Curriculum update 2024'). This will be applied to all changed semesters.");
                changeReason = reason || '';
            }
            
            for (const semester of semestersForPath) {
                const semId = semester.id;
                const crs = semesterCourses[semId] || [];
                const newCourses = crs.map(c => c.id);
                const oldCourses = currentPath?.semesters?.[semId]?.courses || [];
                let history = currentPath?.semesters?.[semId]?.history || {};

                const hasChanged = JSON.stringify([...oldCourses].sort()) !== JSON.stringify([...newCourses].sort());

                if (hasChanged && isAnySemesterChanged && currentPath) {
                    const historyEntry: CoursePathHistoryItem = { reason: changeReason || "No reason provided", oldCourses, newCourses, timestamp: serverTimestamp() };
                    const historyKey = push(ref(db)).key!;
                    history[historyKey] = historyEntry;
                }
                pathSemesters[semId] = { courses: newCourses, history };
            }

            const pathData = { intakeId: selectedIntake, programmeId: selectedProgramme, semesters: pathSemesters };

            if (currentPath) {
                await update(ref(db, `coursePaths/${currentPath.id}`), pathData);
            } else {
                await push(ref(db, 'coursePaths'), pathData);
            }
            toast({ title: 'Success', description: 'Course path saved successfully.' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
        } finally {
            setLoading(false);
        }
    };
    
    // --- Intake & Semester Logic ---
    const handleOpenIntakeDialog = (intake: Intake | null) => {
        if(intake) { setEditingIntake(intake); setIntakeName(intake.name); } 
        else { setEditingIntake(null); setIntakeName(''); }
        setIsIntakeDialogOpen(true);
    };

    const handleSaveIntake = async () => {
        if (!intakeName.trim()) return;
        setSavingIntake(true);
        try {
            if(editingIntake){
                await update(ref(db, `intakes/${editingIntake.id}`), { name: intakeName.trim() });
                toast({ title: 'Intake updated.' });
            } else {
                await push(ref(db, 'intakes'), { name: intakeName.trim() });
                toast({ title: 'Intake created.' });
            }
            setIsIntakeDialogOpen(false); setIntakeName(''); setEditingIntake(null);
        } catch (e: any) { toast({ variant: 'destructive', title: 'Failed to save intake.' });
        } finally { setSavingIntake(false); }
    };

    const handleDeleteIntake = async (id: string) => {
        try {
            const coursePathsSnapshot = await get(ref(db, 'coursePaths'));
            const allPaths: CoursePath[] = coursePathsSnapshot.exists() ? Object.entries(coursePathsSnapshot.val()).map(([pathId, pathData]) => ({id: pathId, ...(pathData as any)})) : [];
            const pathsToDelete = allPaths.filter(p => p.intakeId === id);
            const updates: Record<string, null> = {};
            pathsToDelete.forEach(p => { if (p.id) updates[`/coursePaths/${p.id}`] = null; });
            updates[`/intakes/${id}`] = null;
            await update(ref(db), updates);
            toast({ title: 'Intake deleted successfully.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Delete Failed', description: 'Could not delete the intake.' });
        }
    };

     const handleAddSemester = async () => {
        const intake = intakes.find(i => i.id === selectedIntake);
        if (!intake) return;
        
        const validSemesters = newSemesters.filter(s => s.year && s.semesterInYear);
        if(validSemesters.length === 0) {
            toast({ variant: 'destructive', title: 'No valid semesters to add.' });
            return;
        }

        setSavingIntake(true);
        try {
            const updates: Record<string, any> = {};
            validSemesters.forEach(sem => {
                const semesterName = `${intake.name} Year ${sem.year} Semester ${sem.semesterInYear}`;
                const newRef = push(ref(db, 'semesters'));
                updates[newRef.key!] = { name: semesterName, intakeId: intake.id, year: Number(sem.year), semesterInYear: Number(sem.semesterInYear), status: 'Closed' };
            });

            await update(ref(db, 'semesters'), updates);
            toast({ title: `${validSemesters.length} Semester(s) Created` });
            setIsSemesterDialogOpen(false);
            setNewSemesters([{ year: 1, semesterInYear: 1 }]);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Failed to create semester' });
        } finally {
            setSavingIntake(false);
        }
    };
    
    const handleNewSemesterChange = (index: number, field: 'year' | 'semesterInYear', value: string) => {
        const updated = [...newSemesters];
        updated[index] = { ...updated[index], [field]: value === '' ? '' : Number(value) };
        setNewSemesters(updated);
    };

    const addNewSemesterField = () => setNewSemesters(prev => [...prev, { year: '', semesterInYear: '' }]);
    const removeNewSemesterField = (index: number) => setNewSemesters(prev => prev.filter((_, i) => i !== index));

    
    // --- DnD and UI Logic ---
    const findContainer = (id: string) => {
        if (id === 'available') return 'available';
        if (availableCourses.some(c => c.id === id)) return 'available';
        for (const semesterId in semesterCourses) { if (semesterCourses[semesterId]?.some(c => c.id === id)) return semesterId; }
        return null;
    };
    
    const handleAddCourseToSemester = (courseId: string) => {
        if (!targetSemester) { toast({ variant: 'destructive', title: 'No Target Semester Selected' }); return; }
        const courseToAdd = availableCourses.find(c => c.id === courseId);
        if (!courseToAdd) return;
        setAvailableCourses(prev => prev.filter(c => c.id !== courseId));
        setSemesterCourses(prev => {
            const newSemesters = { ...prev };
            const targetList = newSemesters[targetSemester] ? [...newSemesters[targetSemester]] : [];
            targetList.push(courseToAdd);
            newSemesters[targetSemester] = targetList;
            return newSemesters;
        });
    };

    const handleDragStart = (event: DragStartEvent) => {
        const course = courses.find((c) => c.id === event.active.id as string);
        setActiveCourse(course || null);
    }

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveCourse(null);
        const { active, over } = event;
        if (!over) return;
        const activeId = active.id as string;
        const activeContainer = findContainer(activeId);
        const overContainer = findContainer(over.id as string) || over.id as string;
        if (!activeContainer || !overContainer || activeContainer === overContainer) return;
        const activeItem = courses.find(c => c.id === activeId);
        if(!activeItem) return;

        setAvailableCourses(prev => activeContainer === 'available' ? prev.filter(c => c.id !== activeId) : prev);
        setSemesterCourses(prev => {
            const newSemesters = { ...prev };
            if (activeContainer !== 'available') {
                newSemesters[activeContainer] = newSemesters[activeContainer].filter(c => c.id !== activeId);
            }
            if (overContainer === 'available') {
                 setAvailableCourses(currentAvail => [...currentAvail, activeItem]);
            } else {
                 if (!newSemesters[overContainer]) newSemesters[overContainer] = [];
                 newSemesters[overContainer].push(activeItem);
            }
            return newSemesters;
        });
    };

    const openHistoryDialog = (historyItems: CoursePathHistoryItem[]) => {
        setViewingHistory(historyItems.sort((a, b) => b.timestamp - a.timestamp));
        setIsHistoryDialogOpen(true);
    };

    const groupedSemesters = semestersForPath.reduce((acc, sem) => {
        const yearKey = `Year ${sem.year}`;
        if(!acc[yearKey]) acc[yearKey] = [];
        acc[yearKey].push(sem);
        return acc;
    }, {} as Record<string, Semester[]>);


    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline text-2xl">Intakes & Course Paths</CardTitle>
                <CardDescription>Define student intakes and map out the required courses for each programme, semester by semester.</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                        <TabsTrigger value="intakes">Manage Intakes</TabsTrigger>
                        <TabsTrigger value="paths">Manage Course Paths</TabsTrigger>
                    </TabsList>
                    <TabsContent value="intakes" className="pt-4">
                        <Card>
                            <CardHeader className="flex-row items-center justify-between">
                                <div><CardTitle>Intakes</CardTitle><CardDescription>A list of all student intake periods.</CardDescription></div>
                                <Button onClick={() => handleOpenIntakeDialog(null)}><PlusCircle className="mr-2 h-4"/>New Intake</Button>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader><TableRow><TableHead>Intake Name</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {loading ? <TableRow><TableCell colSpan={2}><Skeleton className="h-10 w-full"/></TableCell></TableRow> :
                                        intakes.length > 0 ? intakes.map(i => (
                                            <TableRow key={i.id}><TableCell>{i.name}</TableCell><TableCell className="text-right">
                                                <Button variant="outline" size="sm" className="mr-2" onClick={() => { setSelectedIntake(i.id); setActiveTab('paths'); }}>
                                                    <Route className="mr-2 h-4 w-4" />
                                                    Course Path
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleOpenIntakeDialog(i)}><Pencil className="h-4 w-4"/></Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action will permanently delete the intake "{i.name}" and all of its associated course paths. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteIntake(i.id)}>Yes, delete it</AlertDialogAction></AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </TableCell></TableRow>
                                        )) : <TableRow><TableCell colSpan={2} className="text-center h-24">No intakes created.</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="paths" className="pt-4">
                        <Card>
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <CardTitle>Course Path Builder</CardTitle>
                                        <CardDescription>Select an intake and programme, then drag courses into the correct semesters.</CardDescription>
                                    </div>
                                    <Dialog open={isSemesterDialogOpen} onOpenChange={setIsSemesterDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button variant="secondary" disabled={!selectedIntake}>
                                                <PlusCircle className="mr-2 h-4 w-4"/>Add Semester
                                            </Button>
                                        </DialogTrigger>
                                         <DialogContent>
                                            <DialogHeader><DialogTitle>Add New Semesters for {intakes.find(i => i.id === selectedIntake)?.name}</DialogTitle></DialogHeader>
                                            <div className="py-4 max-h-[60vh] overflow-y-auto pr-4 space-y-2">
                                                {newSemesters.map((sem, index) => (
                                                    <div key={index} className="flex items-center gap-2">
                                                        <div className="flex-1"><Label>Year</Label><Input type="number" min="1" value={sem.year} onChange={e => handleNewSemesterChange(index, 'year', e.target.value)}/></div>
                                                        <div className="flex-1"><Label>Semester in Year</Label><Input type="number" min="1" max="3" value={sem.semesterInYear} onChange={e => handleNewSemesterChange(index, 'semesterInYear', e.target.value)}/></div>
                                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeNewSemesterField(index)} disabled={newSemesters.length <= 1} className="self-end"><Trash2 className="h-4 w-4"/></Button>
                                                    </div>
                                                ))}
                                                <Button type="button" variant="outline" onClick={addNewSemesterField}><PlusCircle className="h-4 w-4 mr-2"/>Add Another</Button>
                                            </div>
                                            <DialogFooter>
                                                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                                                <Button onClick={handleAddSemester} disabled={savingIntake}>{savingIntake && <Loader2 className="animate-spin mr-2 h-4"/>}Create Semesters</Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <Select value={selectedIntake} onValueChange={setSelectedIntake}><SelectTrigger><SelectValue placeholder="Select an Intake..."/></SelectTrigger><SelectContent>{intakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select>
                                    <Select value={selectedProgramme} onValueChange={setSelectedProgramme}><SelectTrigger><SelectValue placeholder="Select a Programme..."/></SelectTrigger><SelectContent>{programmes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
                                </div>
                                {selectedIntake && selectedProgramme ? (
                                    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
                                    <div className="grid md:grid-cols-3 gap-4">
                                        <div className="md:col-span-2 space-y-4">
                                            {Object.entries(groupedSemesters).map(([year, sems]) => (
                                                <div key={year} className="space-y-4 p-4 border rounded-lg">
                                                    <h3 className="font-bold text-xl">{year}</h3>
                                                    <div className="grid md:grid-cols-2 gap-4">
                                                        {sems.map(sem => (
                                                            <SemesterColumn 
                                                                key={sem.id}
                                                                semester={sem}
                                                                courses={semesterCourses[sem.id] || []} 
                                                                currentPath={currentPath} 
                                                                onHistoryClick={openHistoryDialog} 
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="md:col-span-1">
                                            <AvailableCoursesColumn 
                                                courses={availableCourses}
                                                targetSemester={targetSemester}
                                                setTargetSemester={setTargetSemester}
                                                onAddCourse={handleAddCourseToSemester}
                                                semestersForPath={semestersForPath}
                                            />
                                        </div>
                                    </div>
                                    <DragOverlay>
                                        {activeCourse ? <DraggableCourseItem id={activeCourse.id} course={activeCourse} /> : null}
                                    </DragOverlay>
                                    </DndContext>
                                ) : <Alert><Info className="h-4 w-4"/><AlertTitle>Select Intake &amp; Programme</AlertTitle><AlertDescription>Please select an intake and a programme to begin building a course path.</AlertDescription></Alert>}
                            </CardContent>
                            <CardFooter className="justify-end">
                                <Button onClick={handleSaveCoursePath} disabled={loading || !selectedIntake || !selectedProgramme}>Save Course Path</Button>
                            </CardFooter>
                        </Card>
                    </TabsContent>
                </Tabs>
                 <Dialog open={isIntakeDialogOpen} onOpenChange={(open) => { if (!open) setEditingIntake(null); setIsIntakeDialogOpen(open);}}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>{editingIntake ? 'Edit' : 'Create New'} Intake</DialogTitle></DialogHeader>
                        <div className="py-4"><Input placeholder="e.g., 2024JAN" value={intakeName} onChange={e => setIntakeName(e.target.value.toUpperCase())} /></div>
                        <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSaveIntake} disabled={savingIntake}>{savingIntake && <Loader2 className="animate-spin mr-2 h-4"/>}Save Intake</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
                 <Dialog open={isHistoryDialogOpen} onOpenChange={() => { setIsHistoryDialogOpen(false); setViewingHistory([]); }}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader><DialogTitle>Semester Change History</DialogTitle></DialogHeader>
                        <div className="max-h-[60vh] overflow-y-auto pr-4 space-y-4">
                            {viewingHistory.map((item, index) => (
                                <div key={index} className="p-3 border rounded-lg">
                                    <p className="font-semibold">{item.reason}</p>
                                    <p className="text-sm text-muted-foreground">{new Date(item.timestamp).toLocaleString()}</p>
                                    <div className="grid grid-cols-2 gap-4 mt-2 text-xs">
                                        <div><p className="font-bold">Removed:</p><ul>{(item.oldCourses || []).filter(c => !(item.newCourses || []).includes(c)).map(id => <li key={id}>- {courses.find(c=>c.id===id)?.name}</li>)}</ul></div>
                                        <div><p className="font-bold">Added:</p><ul>{(item.newCourses || []).filter(c => !(item.oldCourses || []).includes(c)).map(id => <li key={id}>+ {courses.find(c=>c.id===id)?.name}</li>)}</ul></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}

// --- Draggable Course Item Component ---
function DraggableCourseItem({ id, course, onAdd }: { id: string, course?: Course | null, onAdd?: () => void}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    if (!course) return null;
    return (
        <div ref={setNodeRef} style={style} className={cn("p-2 border rounded-md bg-card flex items-center gap-2 touch-none", isDragging && "opacity-50")}>
            <button {...attributes} {...listeners} className="cursor-grab p-1"><GripVertical className="h-5 w-5 text-muted-foreground"/></button>
            <div className="flex-grow">
                <p className="text-sm font-medium">{course.name}</p>
                <p className="text-xs text-muted-foreground">{course.code}</p>
            </div>
            {onAdd && (
                <Button variant="ghost" size="icon" onClick={onAdd} className="h-8 w-8">
                    <PlusCircle className="h-4 w-4 text-primary"/>
                </Button>
            )}
        </div>
    )
}

// --- Semester Column Component ---
function SemesterColumn({ semester, courses, currentPath, onHistoryClick }: { semester: Semester, courses: Course[], currentPath: CoursePath | undefined, onHistoryClick: (history: CoursePathHistoryItem[]) => void }) {
    const { setNodeRef } = useSortable({ id: semester.id, data: { type: 'container', id: semester.id } });
    const history = currentPath?.semesters?.[semester.id]?.history;
    const historyItems = history ? Object.values(history) : [];

    return (
        <div ref={setNodeRef} className="space-y-2 p-2 border rounded-lg min-h-[150px] bg-muted/50">
             <div className="flex justify-between items-center">
                <h3 className="font-bold text-center">{semester.name.split(' ').slice(-2).join(' ')}</h3>
                {historyItems.length > 0 && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onHistoryClick(historyItems)}>
                        <History className="h-4 w-4 text-blue-600"/>
                    </Button>
                )}
            </div>
            <SortableContext id={semester.id} items={courses.map(c => c.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                    {courses.map(course => <DraggableCourseItem key={course.id} id={course.id} course={course} />)}
                </div>
            </SortableContext>
        </div>
    );
}

// --- Available Courses Column Component ---
function AvailableCoursesColumn({ courses, targetSemester, setTargetSemester, onAddCourse, semestersForPath }: {
    courses: Course[];
    targetSemester: string;
    setTargetSemester: (id: string) => void;
    onAddCourse: (courseId: string) => void;
    semestersForPath: Semester[];
}) {
    const { setNodeRef } = useSortable({ id: 'available', data: { type: 'container', id: 'available' } });
    return (
        <Card ref={setNodeRef}>
            <CardHeader>
                <CardTitle>Available Courses</CardTitle>
                <div className="pt-2 space-y-1">
                    <Label htmlFor="target-semester">Target Semester</Label>
                    <Select value={targetSemester} onValueChange={setTargetSemester}>
                        <SelectTrigger id="target-semester">
                            <SelectValue placeholder="Select semester to add to..." />
                        </SelectTrigger>
                        <SelectContent>
                            {semestersForPath.map(sem => (
                                <SelectItem key={sem.id} value={sem.id}>
                                   {sem.name}
                                </SelectItem>
                           ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="max-h-[600px] overflow-y-auto space-y-2">
                <SortableContext id="available" items={courses.map(c => c.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                         {courses.map(course => <DraggableCourseItem key={course.id} id={course.id} course={course} onAdd={() => onAddCourse(course.id)} />)}
                         {courses.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">All courses assigned.</p>}
                    </div>
                </SortableContext>
            </CardContent>
        </Card>
    )
}
    
