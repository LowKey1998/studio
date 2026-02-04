
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle, Trash2, Clock, Bot, Search, ChevronsUpDown, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, get, set, push, onValue, remove } from 'firebase/database';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { generateFullTimetable } from '@/ai/flows/generate-timetable';
import { useSearchParams } from 'next/navigation';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type Course = {
    id: string;
    name: string;
    code: string;
};

type Semester = {
    id: string;
    name: string;
    status: 'Open' | 'Closed' | 'Archived';
};

type Room = {
    id: string;
    name: string;
    capacity: number;
};

type TimetableEntry = {
    id: string;
    day: string;
    startTime: string;
    endTime: string;
    venue: string;
};

type CoursePath = {
    id: string;
    intakeId: string;
    programmeId: string;
    semesters: Record<string, { courses: string[] }>;
};

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function SearchableSemesterSelect({ 
    options, 
    value, 
    onValueChange, 
    placeholder, 
    disabled = false 
}: {
    options: Semester[];
    value: string | undefined;
    onValueChange: (value: string) => void;
    placeholder: string;
    disabled?: boolean;
}) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');

    const filteredOptions = React.useMemo(() => {
        if (!search) return options;
        return options.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
    }, [options, search]);

    const selectedLabel = React.useMemo(() => {
        if (!value) return placeholder;
        return options.find(s => s.id === value)?.name || placeholder;
    }, [value, options, placeholder]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between" disabled={disabled}>
                    <span className="truncate">{selectedLabel}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" side="bottom" align="start">
                <div className="p-2">
                    <Input 
                        placeholder="Search semesters..."
                        className="h-9"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <Separator />
                <ScrollArea className="h-[200px]">
                    <div className="p-1">
                    {filteredOptions.length > 0 ? filteredOptions.map(option => (
                        <Button 
                            key={option.id}
                            variant="ghost" 
                            className="w-full justify-start h-auto py-2 px-2 text-left"
                            onClick={() => {
                                onValueChange(option.id);
                                setOpen(false);
                                setSearch('');
                            }}
                        >
                            {option.name}
                        </Button>
                    )) : <p className="p-2 text-center text-sm text-muted-foreground">No results found.</p>}
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}

export default function TimetableManagementPage() {
    const searchParams = useSearchParams();
    const semesterFromParams = searchParams.get('semester');

    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [generating, setGenerating] = React.useState(false);
    
    // Raw data state
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [allCourses, setAllCourses] = React.useState<Record<string, Omit<Course, 'id'>>>({});
    const [allCoursePaths, setAllCoursePaths] = React.useState<CoursePath[]>([]);
    const [rooms, setRooms] = React.useState<Room[]>([]);

    // Filtered/selected state
    const [selectedSemesterId, setSelectedSemesterId] = React.useState<string>(semesterFromParams || '');
    const [coursesForSemester, setCoursesForSemester] = React.useState<Course[]>([]);
    const [selectedCourse, setSelectedCourse] = React.useState<string>('');
    const [timetable, setTimetable] = React.useState<TimetableEntry[]>([]);
    
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);

    // Form state
    const [day, setDay] = React.useState('');
    const [startTime, setStartTime] = React.useState('');
    const [endTime, setEndTime] = React.useState('');
    const [venue, setVenue] = React.useState('');

    const { toast } = useToast();

    // Fetch all data on mount
    React.useEffect(() => {
        setLoading(true);
        const fetchData = async () => {
            try {
                 const [semestersSnap, roomsSnap, coursesSnap, coursePathsSnap] = await Promise.all([
                    get(ref(db, 'semesters')),
                    get(ref(db, 'settings/rooms')),
                    get(ref(db, 'courses')),
                    get(ref(db, 'coursePaths'))
                ]);

                const list: Semester[] = [];
                if (semestersSnap.exists()) {
                    const data = semestersSnap.val();
                    Object.keys(data).forEach(key => list.push({ id: key, ...data[key] }));
                    setSemesters(list.sort((a, b) => b.name.localeCompare(a.name)));
                }

                setRooms(roomsSnap.exists() ? Object.values(roomsSnap.val()) : []);
                setAllCourses(coursesSnap.exists() ? coursesSnap.val() : {});
                setAllCoursePaths(coursePathsSnap.exists() ? Object.values(coursePathsSnap.val()) : []);

                if (semesterFromParams) {
                    setSelectedSemesterId(semesterFromParams);
                } else if (list.length > 0) {
                    // We'll set the initial selected semester in the useEffect that filters semesters
                }

            } catch (error) {
                toast({ variant: 'destructive', title: "Failed to load initial data."})
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [semesterFromParams, toast]);

    // Calculate semesters that actually have courses
    const semestersWithCourses = React.useMemo(() => {
        return semesters.filter(sem => {
            return allCoursePaths.some(path => 
                path.semesters && 
                path.semesters[sem.id] && 
                path.semesters[sem.id].courses && 
                path.semesters[sem.id].courses.length > 0
            );
        });
    }, [semesters, allCoursePaths]);

    // Set default selected semester if none set
    React.useEffect(() => {
        if (!selectedSemesterId && semestersWithCourses.length > 0) {
            setSelectedSemesterId(semestersWithCourses[0].id);
        }
    }, [selectedSemesterId, semestersWithCourses]);

    // Filter courses when semester or raw data changes
    React.useEffect(() => {
        if (!selectedSemesterId || allCoursePaths.length === 0 || Object.keys(allCourses).length === 0) {
            setCoursesForSemester([]);
            return;
        }

        const courseIdsInSemester = new Set<string>();
        allCoursePaths.forEach(path => {
            if(path.semesters && path.semesters[selectedSemesterId]) {
                 path.semesters[selectedSemesterId].courses.forEach(cid => courseIdsInSemester.add(cid));
            }
        });

        const filtered = Array.from(courseIdsInSemester)
            .map(cid => allCourses[cid] ? { id: cid, ...allCourses[cid] } : null)
            .filter((c): c is Course => c !== null)
            .sort((a, b) => a.name.localeCompare(b.name));
            
        setCoursesForSemester(filtered);
        if (filtered.length > 0 && !selectedCourse) {
            setSelectedCourse(filtered[0].id);
        }
    }, [selectedSemesterId, allCoursePaths, allCourses, selectedCourse]);


     // Fetch timetable entries for the selected course
     React.useEffect(() => {
        if (!selectedCourse || !selectedSemesterId) {
            setTimetable([]);
            return;
        }
        const timetableRef = ref(db, `timetables/${selectedSemesterId}/${selectedCourse}`);
        const unsubscribe = onValue(timetableRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setTimetable(Object.keys(data).map(key => ({ id: key, ...data[key] })));
            } else {
                setTimetable([]);
            }
        });
        return () => unsubscribe();
    }, [selectedCourse, selectedSemesterId]);
    
    const resetForm = () => {
        setDay('');
        setStartTime('');
        setEndTime('');
        setVenue('');
    };

    const handleAddEntry = async () => {
        if (!day || !startTime || !endTime || !venue) {
            toast({ variant: 'destructive', title: 'Missing fields' });
            return;
        }
        setSaving(true);
        try {
            const timetableRef = ref(db, `timetables/${selectedSemesterId}/${selectedCourse}`);
            const newEntryRef = push(timetableRef);
            await set(newEntryRef, { day, startTime, endTime, venue });
            toast({ title: 'Timetable Entry Added' });
            resetForm();
            setIsDialogOpen(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to add entry', description: error.message });
        } finally {
            setSaving(false);
        }
    };
    
    const handleDeleteEntry = async (entryId: string) => {
        if (!confirm('Are you sure you want to delete this timetable entry?')) return;
        try {
            const entryRef = ref(db, `timetables/${selectedSemesterId}/${selectedCourse}/${entryId}`);
            await remove(entryRef);
            toast({ title: 'Entry deleted' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to delete entry', description: error.message });
        }
    };
    
    const handleAutoGenerate = async () => {
        setGenerating(true);
        try {
            const result = await generateFullTimetable();
            toast({ title: "Timetable Generation Complete", description: result.message });
        } catch(e: any) {
            toast({ variant: 'destructive', title: "Generation Failed", description: e.message });
        } finally {
            setGenerating(false);
        }
    }


    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="font-headline text-2xl">Course Timetable Management</CardTitle>
                        <CardDescription>Create and manage class schedules for each course per semester.</CardDescription>
                    </div>
                    <Button onClick={handleAutoGenerate} disabled={generating} className="w-full md:w-auto">
                        {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Bot className="mr-2 h-4 w-4"/>}
                        Auto-Generate Timetable
                    </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="semester-select">Select Semester</Label>
                            <SearchableSemesterSelect 
                                value={selectedSemesterId}
                                onValueChange={setSelectedSemesterId}
                                options={semestersWithCourses}
                                placeholder="Search semesters..."
                                disabled={loading}
                            />
                            
                            <div className="bg-yellow-50 border-2 border-orange-500 rounded-lg p-4 flex gap-3 items-start mt-4">
                                <Info className="h-5 w-5 text-orange-600 mt-0.5" />
                                <div>
                                    <h4 className="font-bold text-orange-800">Semester Filtering</h4>
                                    <p className="text-orange-700 text-sm">
                                        Only semesters with courses defined in <strong>Intakes / Course Paths</strong> are shown. If a semester is missing, ensure it has courses mapped to it first.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="course-select">Select Course</Label>
                            <Select value={selectedCourse} onValueChange={setSelectedCourse} disabled={coursesForSemester.length === 0}>
                                <SelectTrigger id="course-select"><SelectValue placeholder="Select a course..." /></SelectTrigger>
                                <SelectContent>{coursesForSemester.map(c => (<SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>))}</SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="border rounded-lg p-4 space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <h3 className="font-semibold text-lg">Schedule for {coursesForSemester.find(c => c.id === selectedCourse)?.code || '...'}</h3>
                            <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
                                <DialogTrigger asChild><Button disabled={!selectedCourse}><PlusCircle className="mr-2 h-4 w-4"/> Add Entry</Button></DialogTrigger>
                                <DialogContent>
                                    <DialogHeader><DialogTitle>New Schedule Entry</DialogTitle></DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <Label>Day of Week</Label>
                                                <Select value={day} onValueChange={setDay}><SelectTrigger><SelectValue placeholder="Select Day"/></SelectTrigger><SelectContent>{daysOfWeek.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label>Venue</Label>
                                                <Select value={venue} onValueChange={setVenue}><SelectTrigger><SelectValue placeholder="Select Room..."/></SelectTrigger><SelectContent>{rooms.map(r => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}</SelectContent></Select>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <Label>Start Time</Label>
                                                <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                                            </div>
                                            <div className="space-y-1">
                                                <Label>End Time</Label>
                                                <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
                                            </div>
                                        </div>
                                    </div>
                                    <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleAddEntry} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Add Entry</Button></DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>

                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Day</TableHead>
                                        <TableHead>Time</TableHead>
                                        <TableHead>Venue</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {timetable.length > 0 ? (
                                        timetable.map(entry => (
                                            <TableRow key={entry.id}>
                                                <TableCell>{entry.day}</TableCell>
                                                <TableCell>{entry.startTime} - {entry.endTime}</TableCell>
                                                <TableCell>{entry.venue}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteEntry(entry.id)}>
                                                        <Trash2 className="h-4 w-4 text-destructive"/>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center">
                                                {loading ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /> : selectedCourse ? <span className="text-muted-foreground">No manual schedule set for this course.</span> : <span className="text-muted-foreground">Select a course to view its schedule.</span>}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
