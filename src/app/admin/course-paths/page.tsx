
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle, Trash2, GripVertical, Check, ChevronsUpDown, Info, MinusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, onValue, set, push, remove, update } from 'firebase/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay, DragStartEvent, DragOverEvent, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- TYPE DEFINITIONS ---
type Intake = { id: string; name: string; };
type Programme = { id: string; name: string; };
type Course = { id: string; name: string; code: string; year: number; };
type CoursePath = { id: string; intakeId: string; programmeId: string; semesters: Record<number, { courses: string[] }> };

// --- MAIN PAGE COMPONENT ---
export default function CoursePathsPage() {
    const [intakes, setIntakes] = React.useState<Intake[]>([]);
    const [programmes, setProgrammes] = React.useState<Programme[]>([]);
    const [courses, setCourses] = React.useState<Course[]>([]);
    const [coursePaths, setCoursePaths] = React.useState<CoursePath[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [activeTab, setActiveTab] = React.useState('intakes');
    const { toast } = useToast();

    // Intake Dialog State
    const [isIntakeDialogOpen, setIsIntakeDialogOpen] = React.useState(false);
    const [intakeName, setIntakeName] = React.useState('');
    const [savingIntake, setSavingIntake] = React.useState(false);

    // Course Path State
    const [selectedIntake, setSelectedIntake] = React.useState('');
    const [selectedProgramme, setSelectedProgramme] = React.useState('');
    const [numYears, setNumYears] = React.useState(4);
    const [semesterCourses, setSemesterCourses] = React.useState<Record<string, Course[]>>({});
    const [availableCourses, setAvailableCourses] = React.useState<Course[]>([]);
    const [activeId, setActiveId] = React.useState<string | null>(null);
    const [activeCourse, setActiveCourse] = React.useState<Course | null>(null);

    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
    
    // --- Data Fetching ---
    React.useEffect(() => {
        setLoading(true);
        const refs = [ ref(db, 'intakes'), ref(db, 'programmes'), ref(db, 'courses'), ref(db, 'coursePaths') ];
        const unsubs = refs.map((r, i) => onValue(r, (snapshot) => {
            const data = snapshot.val() || {};
            const list = Object.keys(data).map(id => ({ id, ...data[id] }));
            switch(i) {
                case 0: setIntakes(list); break;
                case 1: setProgrammes(list); break;
                case 2: setCourses(list); break;
                case 3: setCoursePaths(list); break;
            }
        }));
        setLoading(false);
        return () => unsubs.forEach(unsub => unsub());
    }, []);

    // --- Course Path Logic ---
    const currentPath = React.useMemo(() => {
        return coursePaths.find(p => p.intakeId === selectedIntake && p.programmeId === selectedProgramme);
    }, [coursePaths, selectedIntake, selectedProgramme]);

    React.useEffect(() => {
        const newSemesterCourses: Record<string, Course[]> = {};
        const assignedCourseIds = new Set<string>();

        if (currentPath && currentPath.semesters) {
            setNumYears(Math.ceil(Object.keys(currentPath.semesters).length / 2) || 4);
            for (const semesterNum in currentPath.semesters) {
                const semesterCourseIds = currentPath.semesters[semesterNum].courses;
                newSemesterCourses[semesterNum] = semesterCourseIds.map(id => {
                    assignedCourseIds.add(id);
                    return courses.find(c => c.id === id)!;
                }).filter(Boolean);
            }
        } else {
             setNumYears(4);
        }
        setSemesterCourses(newSemesterCourses);
        setAvailableCourses(courses.filter(c => !assignedCourseIds.has(c.id)));
    }, [currentPath, courses]);

    const handleSaveCoursePath = async () => {
        if (!selectedIntake || !selectedProgramme) return;
        setLoading(true);
        try {
            const pathData: Omit<CoursePath, 'id'> = {
                intakeId: selectedIntake,
                programmeId: selectedProgramme,
                semesters: Object.entries(semesterCourses).reduce((acc, [sem, crs]) => {
                    if (crs && crs.length > 0) acc[Number(sem)] = { courses: crs.map(c => c.id) };
                    return acc;
                }, {} as Record<number, { courses: string[] }>)
            };
            if (currentPath) {
                await update(ref(db, `coursePaths/${currentPath.id}`), pathData);
            } else {
                await push(ref(db, 'coursePaths'), pathData);
            }
            toast({ title: 'Success', description: 'Course path saved successfully.' });
        } catch (e: any) { toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
        } finally { setLoading(false); }
    };
    
    // --- Intake Logic ---
    const handleSaveIntake = async () => {
        if (!intakeName.trim()) return;
        setSavingIntake(true);
        try {
            await push(ref(db, 'intakes'), { name: intakeName.trim() });
            toast({ title: 'Intake created.' });
            setIsIntakeDialogOpen(false); setIntakeName('');
        } catch (e: any) { toast({ variant: 'destructive', title: 'Failed to create intake.' });
        } finally { setSavingIntake(false); }
    };

    const handleDeleteIntake = async (id: string) => {
        if (window.confirm('Are you sure? This will also delete associated course paths.')) {
            const pathsToDelete = coursePaths.filter(p => p.intakeId === id);
            const updates: Record<string, null> = {};
            pathsToDelete.forEach(p => updates[`/coursePaths/${p.id}`] = null);
            updates[`/intakes/${id}`] = null;
            await update(ref(db), updates);
            toast({ title: 'Intake deleted.' });
        }
    };
    
    // --- Drag and Drop Logic ---
    const findContainer = (id: string) => {
        if (id === 'available' || availableCourses.some(c => c.id === id)) {
            return 'available';
        }
        for (const semesterId in semesterCourses) {
            if (semesterId === id || semesterCourses[semesterId]?.some(c => c.id === id)) {
                return semesterId;
            }
        }
        return null;
    };


    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
        setActiveCourse(courses.find(c => c.id === event.active.id) || null);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setActiveCourse(null);
        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;
        
        const activeContainerId = findContainer(activeId);
        const overContainerId = findContainer(overId);
        
        if (!activeContainerId || !overContainerId || activeId === overContainerId) return;

        const movedItem = courses.find(c => c.id === activeId)!;

        // Remove from source
        if (activeContainerId === 'available') {
            setAvailableCourses(prev => prev.filter(c => c.id !== activeId));
        } else {
            setSemesterCourses(prev => {
                const newSemesters = { ...prev };
                newSemesters[activeContainerId] = newSemesters[activeContainerId].filter(c => c.id !== activeId);
                return newSemesters;
            });
        }
        
        // Add to destination
        if (overContainerId === 'available') {
            setAvailableCourses(prev => [...prev, movedItem]);
        } else {
            setSemesterCourses(prev => {
                const newSemesters = { ...prev };
                const overCourses = newSemesters[overContainerId] || [];
                const overIndex = overCourses.findIndex(c => c.id === overId);
                if (overIndex >= 0) {
                    overCourses.splice(overIndex, 0, movedItem);
                } else {
                    overCourses.push(movedItem);
                }
                newSemesters[overContainerId] = [...overCourses];
                return newSemesters;
            });
        }
    };
    

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
                                <Dialog open={isIntakeDialogOpen} onOpenChange={setIsIntakeDialogOpen}>
                                    <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4"/>New Intake</Button></DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader><DialogTitle>Create New Intake</DialogTitle></DialogHeader>
                                        <div className="py-4"><Input placeholder="e.g., 2024 January Intake" value={intakeName} onChange={e => setIntakeName(e.target.value)} /></div>
                                        <DialogFooter>
                                            <Button variant="outline" onClick={()=>setIsIntakeDialogOpen(false)}>Cancel</Button>
                                            <Button onClick={handleSaveIntake} disabled={savingIntake}>{savingIntake && <Loader2 className="animate-spin mr-2 h-4"/>}Save Intake</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader><TableRow><TableHead>Intake Name</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {intakes.length > 0 ? intakes.map(i => (
                                            <TableRow key={i.id}><TableCell>{i.name}</TableCell><TableCell className="text-right"><Button variant="destructive" size="icon" onClick={() => handleDeleteIntake(i.id)}><Trash2 className="h-4"/></Button></TableCell></TableRow>
                                        )) : <TableRow><TableCell colSpan={2} className="text-center h-24">No intakes created.</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="paths" className="pt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Course Path Builder</CardTitle>
                                <CardDescription>Select an intake and programme, then drag courses into the correct semesters.</CardDescription>
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
                                            {Array.from({ length: numYears }).map((_, yearIndex) => (
                                                <div key={yearIndex} className="space-y-4 p-4 border rounded-lg">
                                                    <div className="flex justify-between items-center">
                                                        <h3 className="font-bold text-xl">Year {yearIndex + 1}</h3>
                                                        <Button variant="ghost" size="icon" onClick={() => setNumYears(prev => Math.max(1, prev-1))} disabled={numYears <= 1}><MinusCircle className="h-5 w-5 text-destructive"/></Button>
                                                    </div>
                                                    <div className="grid md:grid-cols-2 gap-4">
                                                        <SemesterColumn semesterNum={1} year={yearIndex+1} courses={semesterCourses[String((yearIndex * 2) + 1)] || []} />
                                                        <SemesterColumn semesterNum={2} year={yearIndex+1} courses={semesterCourses[String((yearIndex * 2) + 2)] || []} />
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="flex justify-center gap-2">
                                                <Button onClick={() => setNumYears(prev => prev + 1)}><PlusCircle className="mr-2 h-4"/>Add Year</Button>
                                            </div>
                                        </div>
                                        <div className="md:col-span-1">
                                            <AvailableCoursesColumn courses={availableCourses} />
                                        </div>
                                    </div>
                                    <DragOverlay>{activeId ? <DraggableCourseItem id={activeId} course={activeCourse} isOverlay /> : null}</DragOverlay>
                                    </DndContext>
                                ) : <Alert><Info className="h-4 w-4"/><AlertTitle>Select Intake & Programme</AlertTitle><AlertDescription>Please select an intake and a programme to begin building a course path.</AlertDescription></Alert>}
                            </CardContent>
                            <CardFooter className="justify-end">
                                <Button onClick={handleSaveCoursePath} disabled={loading || !selectedIntake || !selectedProgramme}>Save Course Path</Button>
                            </CardFooter>
                        </Card>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}

// --- Draggable Course Item Component ---
function DraggableCourseItem({ id, course, isOverlay }: { id: string, course?: Course | null, isOverlay?: boolean }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    if (!course) return null;
    return (
        <div ref={setNodeRef} style={style} {...attributes} className={cn("p-2 border rounded-md bg-card flex items-center gap-2", isDragging && "opacity-50", isOverlay && "shadow-lg")}>
            <button {...listeners} className="cursor-grab touch-none"><GripVertical className="h-5 w-5 text-muted-foreground"/></button>
            <div>
                <p className="text-sm font-medium">{course.name}</p>
                <p className="text-xs text-muted-foreground">{course.code}</p>
            </div>
        </div>
    )
}

// --- Semester Column Component ---
function SemesterColumn({ semesterNum, courses, year }: { semesterNum: number, courses: Course[], year: number }) {
    const semesterId = String((year - 1) * 2 + semesterNum);
    const { setNodeRef } = useSortable({ id: semesterId, data: { type: 'container', id: semesterId } });
    return (
        <div className="space-y-2 p-2 border rounded-lg min-h-[150px] bg-muted/50">
            <h3 className="font-bold text-center">Semester {semesterNum}</h3>
            <SortableContext id={semesterId} items={courses.map(c => c.id)} strategy={verticalListSortingStrategy}>
                <div ref={setNodeRef} className="space-y-2">
                    {courses.map(course => <DraggableCourseItem key={course.id} id={course.id} course={course} />)}
                </div>
            </SortableContext>
        </div>
    );
}

// --- Available Courses Column Component ---
function AvailableCoursesColumn({ courses }: { courses: Course[] }) {
    const { setNodeRef } = useSortable({ id: 'available', data: { type: 'container', id: 'available' } });
    return (
        <Card>
            <CardHeader><CardTitle>Available Courses</CardTitle></CardHeader>
            <CardContent className="max-h-[600px] overflow-y-auto space-y-2">
                <SortableContext id="available" items={courses.map(c => c.id)} strategy={verticalListSortingStrategy}>
                    <div ref={setNodeRef} className="space-y-2">
                         {courses.map(course => <DraggableCourseItem key={course.id} id={course.id} course={course} />)}
                         {courses.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">All courses assigned.</p>}
                    </div>
                </SortableContext>
            </CardContent>
        </Card>
    )
}
