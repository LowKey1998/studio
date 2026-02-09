'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle, Trash2, Clock, Bot, Search, ChevronsUpDown, Info, Calendar as CalendarIcon, MapPin, GraduationCap, X } from 'lucide-react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';

type TimetableEntry = {
    id: string;
    semesterId: string;
    courseId: string;
    courseCode: string;
    courseName: string;
    semesterName: string;
    intakeName: string;
    day: string;
    startTime: string;
    endTime: string;
    venue: string;
};

type Semester = { id: string; name: string; intakeId: string; startDate?: string; endDate?: string; status: 'Open' | 'Closed' | 'Archived'; };
type Course = { id: string; name: string; code: string; };
type Room = { id: string; name: string; capacity: number; };
type Intake = { id: string; name: string; };

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const timeToMinutes = (time: string) => {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

export default function TimetableManagementPage() {
    const [loading, setLoading] = React.useState(true);
    const [generating, setGenerating] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    
    const [masterTimetable, setMasterTimetable] = React.useState<TimetableEntry[]>([]);
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [courses, setCourses] = React.useState<Record<string, Course>>({});
    const [rooms, setRooms] = React.useState<Room[]>([]);
    const [intakes, setIntakes] = React.useState<Intake[]>([]);

    // Filter states
    const [roomFilter, setRoomFilter] = React.useState('all');
    const [intakeFilter, setIntakeFilter] = React.useState('all');
    const [searchTerm, setSearchTerm] = React.useState('');

    // Add Entry state
    const [isAddOpen, setIsAddOpen] = React.useState(false);
    const [selectedSemesterId, setSelectedSemesterId] = React.useState('');
    const [selectedCourseId, setSelectedCourseId] = React.useState('');
    const [day, setDay] = React.useState('');
    const [startTime, setStartTime] = React.useState('');
    const [endTime, setEndTime] = React.useState('');
    const [venue, setVenue] = React.useState('');

    const { toast } = useToast();

    React.useEffect(() => {
        setLoading(true);
        const fetchData = async () => {
            const [semSnap, coursesSnap, roomsSnap, intakesSnap, timetablesSnap] = await Promise.all([
                get(ref(db, 'semesters')),
                get(ref(db, 'courses')),
                get(ref(db, 'settings/rooms')),
                get(ref(db, 'intakes')),
                get(ref(db, 'timetables'))
            ]);

            const sData = semSnap.val() || {};
            const cData = coursesSnap.val() || {};
            const rData = roomsSnap.val() || {};
            const iData = intakesSnap.val() || {};
            const tData = timetablesSnap.val() || {};

            const semestersList = Object.keys(sData).map(id => ({ id, ...sData[id] }));
            setSemesters(semestersList);
            setCourses(cData);
            setRooms(Object.values(rData));
            setIntakes(Object.keys(iData).map(id => ({ id, ...iData[id] })));

            const entries: TimetableEntry[] = [];
            for (const semId in tData) {
                const semInfo = sData[semId];
                if (!semInfo) continue;
                const intakeInfo = iData[semInfo.intakeId];

                for (const cId in tData[semId]) {
                    const courseInfo = cData[cId];
                    if (!courseInfo) continue;

                    Object.entries(tData[semId][cId]).forEach(([entryId, entry]: [string, any]) => {
                        entries.push({
                            id: entryId,
                            semesterId: semId,
                            courseId: cId,
                            courseCode: courseInfo.code,
                            courseName: courseInfo.name,
                            semesterName: semInfo.name,
                            intakeName: intakeInfo?.name || 'N/A',
                            ...entry
                        });
                    });
                }
            }
            setMasterTimetable(entries);
            setLoading(false);
        };

        fetchData();
        const unsub = onValue(ref(db, 'timetables'), () => fetchData());
        return () => unsub();
    }, []);

    const handleAutoGenerate = async () => {
        setGenerating(true);
        try {
            const result = await generateFullTimetable();
            toast({ title: "Timetable Generated", description: result.message });
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Generation Failed", description: e.message });
        } finally {
            setGenerating(false);
        }
    };

    const handleAddEntry = async () => {
        if (!selectedSemesterId || !selectedCourseId || !day || !startTime || !endTime || !venue) {
            toast({ variant: 'destructive', title: 'Please fill all fields' });
            return;
        }
        setSaving(true);
        try {
            const entryRef = push(ref(db, `timetables/${selectedSemesterId}/${selectedCourseId}`));
            await set(entryRef, { day, startTime, endTime, venue });
            toast({ title: "Entry Added" });
            setIsAddOpen(false);
            resetAddForm();
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Failed to add entry" });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteEntry = async (entry: TimetableEntry) => {
        if (!confirm("Remove this session from the timetable?")) return;
        try {
            await remove(ref(db, `timetables/${entry.semesterId}/${entry.courseId}/${entry.id}`));
            toast({ title: "Session Removed" });
        } catch (e) {
            toast({ variant: 'destructive', title: "Removal failed" });
        }
    };

    const resetAddForm = () => {
        setSelectedSemesterId('');
        setSelectedCourseId('');
        setDay('');
        setStartTime('');
        setEndTime('');
        setVenue('');
    };

    const filteredTimetable = React.useMemo(() => {
        return masterTimetable.filter(entry => {
            const roomMatch = roomFilter === 'all' || entry.venue === roomFilter;
            const intakeMatch = intakeFilter === 'all' || entry.intakeName === intakeFilter;
            const searchMatch = !searchTerm || entry.courseName.toLowerCase().includes(searchTerm.toLowerCase()) || entry.courseCode.toLowerCase().includes(searchTerm.toLowerCase());
            return roomMatch && intakeMatch && searchMatch;
        });
    }, [masterTimetable, roomFilter, intakeFilter, searchTerm]);

    const coursesForSelectedSemester = React.useMemo(() => {
        if (!selectedSemesterId) return [];
        // Extract courses assigned to this semester from coursePaths
        const semesterData = semesters.find(s => s.id === selectedSemesterId);
        if (!semesterData) return [];
        
        // This is a heuristic: get all courses where lecturer or registration exists for this semester
        // Better way: get from coursePaths. For now, show all active courses
        return Object.entries(courses).filter(([id, data]) => data.status === 'active').map(([id, data]) => ({ id, ...data }));
    }, [selectedSemesterId, semesters, courses]);

    if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-12 w-1/3"/><Skeleton className="h-96 w-full"/></div>;

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="font-headline text-2xl">Master Timetable Management</CardTitle>
                        <CardDescription>View and manage schedules across all intakes and rooms.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleAutoGenerate} disabled={generating}>
                            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Bot className="mr-2 h-4 w-4"/>}
                            Auto-Generate
                        </Button>
                        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                            <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/> Add Session</Button></DialogTrigger>
                            <DialogContent className="sm:max-w-lg">
                                <DialogHeader><DialogTitle>Manual Schedule Entry</DialogTitle></DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="space-y-1">
                                        <Label>Semester</Label>
                                        <Select value={selectedSemesterId} onValueChange={setSelectedSemesterId}>
                                            <SelectTrigger><SelectValue placeholder="Select semester..."/></SelectTrigger>
                                            <SelectContent>{semesters.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Course</Label>
                                        <Select value={selectedCourseId} onValueChange={setSelectedCourseId} disabled={!selectedSemesterId}>
                                            <SelectTrigger><SelectValue placeholder="Select course..."/></SelectTrigger>
                                            <SelectContent>{coursesForSelectedSemester.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <Label>Day</Label>
                                            <Select value={day} onValueChange={setDay}><SelectTrigger><SelectValue placeholder="Day..."/></SelectTrigger><SelectContent>{daysOfWeek.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label>Room/Venue</Label>
                                            <Select value={venue} onValueChange={setVenue}><SelectTrigger><SelectValue placeholder="Room..."/></SelectTrigger><SelectContent>{rooms.map(r => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}</SelectContent></Select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1"><Label>Start Time</Label><Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} /></div>
                                        <div className="space-y-1"><Label>End Time</Label><Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} /></div>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                                    <Button onClick={handleAddEntry} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 animate-spin"/>}Save Entry</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-4 items-end bg-muted/30 p-4 rounded-lg">
                        <div className="flex-1 min-w-[200px]">
                            <Label>Search Course</Label>
                            <div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground"/><Input placeholder="Search name or code..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
                        </div>
                        <div className="w-48">
                            <Label>Filter Room</Label>
                            <Select value={roomFilter} onValueChange={setRoomFilter}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent><SelectItem value="all">All Rooms</SelectItem>{rooms.map(r => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="w-48">
                            <Label>Filter Intake</Label>
                            <Select value={intakeFilter} onValueChange={setIntakeFilter}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent><SelectItem value="all">All Intakes</SelectItem>{intakes.map(i => <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-px border bg-border overflow-hidden rounded-lg">
                        {daysOfWeek.map(day => (
                            <div key={day} className="bg-card min-h-screen">
                                <h3 className="font-bold text-center p-3 border-b bg-muted/50 uppercase tracking-wider text-xs">{day}</h3>
                                <div className="p-2 space-y-2">
                                    {filteredTimetable
                                        .filter(e => e.day === day)
                                        .sort((a,b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
                                        .map((entry, idx) => (
                                            <div key={idx} className="group relative p-3 rounded-lg border bg-primary/5 hover:bg-primary/10 transition-colors border-primary/20">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => handleDeleteEntry(entry)}
                                                >
                                                    <X className="h-3 w-3 text-destructive" />
                                                </Button>
                                                <p className="font-bold text-sm text-primary leading-tight">{entry.courseCode}: {entry.courseName}</p>
                                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-2">
                                                    <Clock className="h-3 w-3" /> {entry.startTime} - {entry.endTime}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-1">
                                                    <MapPin className="h-3 w-3" /> {entry.venue}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-1">
                                                    <GraduationCap className="h-3 w-3" /> {entry.intakeName}
                                                </div>
                                            </div>
                                        ))}
                                    {filteredTimetable.filter(e => e.day === day).length === 0 && (
                                        <p className="text-center text-[10px] text-muted-foreground pt-8 italic">No sessions</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
