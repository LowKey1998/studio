"use client";
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle, Trash2, Clock, Bot, Search, ChevronsUpDown, Info, Calendar as CalendarIcon, MapPin, GraduationCap, X, UserCheck, CalendarDays } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, get, set, push, onValue, remove, update } from 'firebase/database';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { generateFullTimetable } from '@/ai/flows/generate-timetable';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';

type TimeSlot = {
    id: string;
    startTime: string;
    endTime: string;
};

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

type Semester = { id: string; name: string; intakeId: string; year: number; semesterInYear: number; status: 'Open' | 'Closed' | 'Archived'; };
type Course = { id: string; name: string; code: string; status: string; lecturerId: string; lecturerIds?: string[]; separateInstance?: boolean; };
type Room = { id: string; name: string; capacity: number; };
type Intake = { id: string; name: string; };

const defaultDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

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
    const [allCourses, setAllCourses] = React.useState<Course[]>([]);
    const [rooms, setRooms] = React.useState<Room[]>([]);
    const [intakes, setIntakes] = React.useState<Intake[]>([]);
    const [users, setUsers] = React.useState<Record<string, any>>({});
    const [teachingTimes, setTeachingTimes] = React.useState<{ days: string[], slots: TimeSlot[] }>({ days: defaultDays, slots: [] });
    const [calendarSettings, setCalendarSettings] = React.useState<any>(null);

    // Filter states
    const [roomFilter, setRoomFilter] = React.useState('all');
    const [intakeFilter, setIntakeFilter] = React.useState('all');
    const [searchTerm, setSearchTerm] = React.useState('');

    // Add/Edit Entry state
    const [isAddOpen, setIsAddOpen] = React.useState(false);
    const [editingEntry, setEditingEntry] = React.useState<TimetableEntry | null>(null);
    const [selectedCourseId, setSelectedCourseId] = React.useState('');
    const [selectedIntakeId, setSelectedIntakeId] = React.useState('');
    const [day, setDay] = React.useState('');
    const [startTime, setStartTime] = React.useState('');
    const [endTime, setEndTime] = React.useState('');
    const [venue, setVenue] = React.useState('');
    
    const [courseSearch, setCourseSearch] = React.useState('');
    const [isCoursePopoverOpen, setIsCoursePopoverOpen] = React.useState(false);

    const { toast } = useToast();

    React.useEffect(() => {
        setLoading(true);
        const refs = [
            ref(db, 'semesters'),
            ref(db, 'courses'),
            ref(db, 'settings/rooms'),
            ref(db, 'intakes'),
            ref(db, 'timetables'),
            ref(db, 'users'),
            ref(db, 'settings/teachingTimes'),
            ref(db, 'settings/academicCalendar')
        ];

        const unsubs = refs.map((r, i) => onValue(r, (snapshot) => {
            const data = snapshot.val() || {};
            switch(i) {
                case 0: setSemesters(Object.keys(data).map(id => ({ id, ...data[id] }))); break;
                case 1: setAllCourses(Object.keys(data).map(id => ({ id, ...data[id] })).filter(c => c.status === 'active')); break;
                case 2: setRooms(Object.entries(data).map(([id, d]: [string, any]) => ({ id, ...d }))); break;
                case 3: setIntakes(Object.entries(data).map(([id, d]: [string, any]) => ({ id, ...d }))); break;
                case 4: break; // Handled below
                case 5: setUsers(data); break;
                case 6: setTeachingTimes({
                    days: data.days || defaultDays,
                    slots: (data.slots || []).sort((a: TimeSlot, b: TimeSlot) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
                }); break;
                case 7: setCalendarSettings(data); break;
            }
        }));

        const unsubT = onValue(ref(db, 'timetables'), (snapshot) => {
            const tData = snapshot.val() || {};
            get(ref(db, 'semesters')).then(sSnap => {
                get(ref(db, 'courses')).then(cSnap => {
                    get(ref(db, 'intakes')).then(iSnap => {
                        const sData = sSnap.val() || {};
                        const cData = cSnap.val() || {};
                        const iData = iSnap.val() || {};
                        
                        const entries: TimetableEntry[] = [];
                        for (const semId in tData) {
                            const semInfo = sData[semId] || { name: 'Master' };
                            const intakeInfo = semInfo.intakeId ? iData[semInfo.intakeId] : null;

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
                                        intakeName: entry.intakeName || intakeInfo?.name || 'N/A',
                                        ...entry
                                    });
                                });
                            }
                        }
                        setMasterTimetable(entries);
                        setLoading(false);
                    });
                });
            });
        });

        return () => {
            unsubs.forEach(unsub => unsub());
            unsubT();
        };
    }, []);

    const filteredTimetable = React.useMemo(() => {
        return masterTimetable.filter(entry => {
            const matchesRoom = roomFilter === 'all' || entry.venue === roomFilter;
            const matchesIntake = intakeFilter === 'all' || entry.intakeName === intakes.find(i => i.id === intakeFilter)?.name;
            const matchesSearch = !searchTerm || 
                entry.courseName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                entry.courseCode.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesRoom && matchesIntake && matchesSearch;
        });
    }, [masterTimetable, roomFilter, intakeFilter, searchTerm, intakes]);

    const searchedCourses = React.useMemo(() => {
        if (!courseSearch) return allCourses;
        return allCourses.filter(c => 
            c.name.toLowerCase().includes(courseSearch.toLowerCase()) || 
            c.code.toLowerCase().includes(courseSearch.toLowerCase())
        );
    }, [allCourses, courseSearch]);

    const handleSaveEntry = async () => {
        if (!selectedCourseId || !selectedIntakeId || !day || !startTime || !endTime) {
            toast({ variant: 'destructive', title: 'Missing required fields' });
            return;
        }
        setSaving(true);
        try {
            const intake = intakes.find(i => i.id === selectedIntakeId);
            const intakeName = intake?.name || 'Master';
            const intakeStartStr = intake ? parseIntakeDate(intake.name) : null;
            let targetSemesterId = 'master';
            if (intakeStartStr && calendarSettings) {
                const state = calculateAcademicState(intakeStartStr, new Date(), calendarSettings.standardCycles, Object.values(calendarSettings.anomalies || {}));
                const matchedSem = semesters.find(s => s.intakeId === selectedIntakeId && s.year === state.year && s.semesterInYear === state.semester);
                if (matchedSem) targetSemesterId = matchedSem.id;
            }

            const data = { day, startTime, endTime, venue: venue || 'TBA', intakeName };

            if (editingEntry) {
                const entryRef = ref(db, `timetables/${editingEntry.semesterId}/${editingEntry.courseId}/${editingEntry.id}`);
                await update(entryRef, data);
                toast({ title: "Entry Updated" });
            } else {
                const entryRef = push(ref(db, `timetables/${targetSemesterId}/${selectedCourseId}`));
                await set(entryRef, data);
                toast({ title: "Entry Added" });
            }
            setIsAddOpen(false);
            resetAddForm();
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Failed to save entry" });
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
        setEditingEntry(null); setSelectedCourseId(''); setSelectedIntakeId(''); setDay(''); setStartTime(''); setEndTime(''); setVenue(''); setCourseSearch('');
    };

    const intakeStanding = React.useMemo(() => {
        if (intakeFilter === 'all' || !calendarSettings) return null;
        const intake = intakes.find(i => i.id === intakeFilter);
        if (!intake) return null;
        const intakeStartStr = parseIntakeDate(intake.name);
        if (!intakeStartStr) return null;
        return calculateAcademicState(intakeStartStr, new Date(), calendarSettings.standardCycles, Object.values(calendarSettings.anomalies || {}));
    }, [intakeFilter, intakes, calendarSettings]);

    const mergedSessions = React.useMemo(() => {
        const sessions: Record<string, { entry: TimetableEntry; lecturerNames: string; participants: { semesterId: string; name: string; standing: string }[] }> = {};
        
        filteredTimetable.forEach(entry => {
            const course = allCourses.find(c => c.id === entry.courseId);
            const key = course?.separateInstance 
                ? `${entry.courseId}-${entry.day}-${entry.startTime}-${entry.venue}-${entry.semesterId}`
                : `${entry.courseId}-${entry.day}-${entry.startTime}-${entry.venue}`;

            if (!sessions[key]) {
                const lecturerNames = (course?.lecturerIds || [])
                    .map(uid => users[uid]?.name)
                    .filter(Boolean)
                    .join(', ') || users[course?.lecturerId || '']?.name || 'Unassigned';

                sessions[key] = { entry, lecturerNames, participants: [] };
            }
            
            const sem = semesters.find(s => s.id === entry.semesterId);
            const intake = intakes.find(i => i.id === sem?.intakeId);
            const standing = sem ? `Y${sem.year}S${sem.semesterInYear}` : 'N/A';
            
            if (!sessions[key].participants.find(p => p.semesterId === entry.semesterId)) {
                sessions[key].participants.push({
                    semesterId: entry.semesterId,
                    name: intake?.name || entry.intakeName || 'N/A',
                    standing
                });
            }
        });
        
        return Object.values(sessions);
    }, [filteredTimetable, allCourses, semesters, intakes, users]);

    const displayDays = teachingTimes.days.length > 0 ? teachingTimes.days : defaultDays;
    const hasSlots = teachingTimes.slots.length > 0;

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="font-headline text-2xl">Timetable Management</CardTitle>
                        <CardDescription>Manage shared and separate sessions across all intakes.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={async () => { setGenerating(true); try { await generateFullTimetable(); toast({ title: "Success" }); } catch(e:any) { toast({ variant:'destructive', title: "Failed", description: e.message }); } finally { setGenerating(false); } }} disabled={generating}>
                            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Bot className="mr-2 h-4 w-4"/>} Auto-Generate
                        </Button>
                        <Dialog open={isAddOpen} onOpenChange={(o) => { setIsAddOpen(o); if(!o) resetAddForm(); }}>
                            <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/> Add Session</Button></DialogTrigger>
                            <DialogContent className="sm:max-w-lg">
                                <DialogHeader><DialogTitle>{editingEntry ? 'Edit Schedule Entry' : 'Manual Schedule Entry'}</DialogTitle></DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="space-y-1"><Label>Target Intake</Label><Select value={selectedIntakeId} onValueChange={setSelectedIntakeId}><SelectTrigger><SelectValue placeholder="Select intake..."/></SelectTrigger><SelectContent>{intakes.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
                                    <div className="space-y-1"><Label>Select Course</Label><Popover open={isCoursePopoverOpen} onOpenChange={setIsCoursePopoverOpen}><PopoverTrigger asChild><Button variant="outline" className="w-full justify-between font-normal">{selectedCourseId ? allCourses.find(c => c.id === selectedCourseId)?.name : "Find a course..."}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></PopoverTrigger><PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0"><div className="flex flex-col"><div className="p-2 border-b"><Input placeholder="Search..." value={courseSearch} onChange={(e) => setCourseSearch(e.target.value)}/></div><ScrollArea className="h-64"><div className="p-1">{searchedCourses.map((c) => (<Button key={c.id} variant="ghost" className="w-full justify-start text-xs h-auto py-2" onClick={() => { setSelectedCourseId(c.id); setIsCoursePopoverOpen(false); }}><div className="text-left"><div className="font-bold">{c.code}</div><div className="text-muted-foreground">{c.name}</div></div></Button>))}</div></ScrollArea></div></PopoverContent></Popover></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1"><Label>Day</Label><Select value={day} onValueChange={setDay}><SelectTrigger><SelectValue placeholder="Day..."/></SelectTrigger><SelectContent>{displayDays.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></div>
                                        <div className="space-y-1"><Label>Room</Label><Select value={venue} onValueChange={setVenue}><SelectTrigger><SelectValue placeholder="Room (Optional)"/></SelectTrigger><SelectContent><SelectItem value="TBA">None / TBA</SelectItem>{rooms.map(r => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}</SelectContent></Select></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1"><Label>Start Time</Label><Input placeholder="e.g. 14:00" value={startTime} onChange={e => setStartTime(e.target.value)} /></div>
                                        <div className="space-y-1"><Label>End Time</Label><Input placeholder="e.g. 16:00" value={endTime} onChange={e => setEndTime(e.target.value)} /></div>
                                    </div>
                                </div>
                                <DialogFooter><Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button><Button onClick={handleSaveEntry} disabled={saving}>Save Entry</Button></DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-4 items-end bg-muted/30 p-4 rounded-lg">
                        <div className="flex-1 min-w-[200px]"><Label>Search Course</Label><div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/><Input placeholder="Search..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div></div>
                        <div className="w-48"><Label>Filter Room</Label><Select value={roomFilter} onValueChange={setRoomFilter}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Rooms</SelectItem>{rooms.map(r => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}</SelectContent></Select></div>
                        <div className="w-48"><Label>Filter Intake</Label><Select value={intakeFilter} onValueChange={setIntakeFilter}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Intakes</SelectItem>{intakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
                        {intakeFilter !== 'all' && intakeStanding && (
                            <Badge variant="secondary" className="h-10 px-4 text-sm font-bold border-primary/20 bg-primary/5"><CalendarDays className="mr-2 h-4 w-4"/>Standing: Year {intakeStanding.year}, Sem {intakeStanding.semester}</Badge>
                        )}
                    </div>

                    {!hasSlots ? (
                        <Alert variant="secondary"><Info className="h-4 w-4" /><AlertTitle>Matrix View Unavailable</AlertTitle><AlertDescription>Define **Time Slots** in Teaching Times Setup to enable the grid view.</AlertDescription></Alert>
                    ) : (
                        <div className="border rounded-lg overflow-hidden bg-muted/10 min-w-[800px]">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="w-32 border-r font-bold text-center">DAY</TableHead>
                                        {teachingTimes.slots.map((slot, index) => (<TableHead key={index} className="text-center font-bold border-r text-xs">{slot.startTime} - {slot.endTime}</TableHead>))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {displayDays.map(dayName => (
                                        <TableRow key={dayName}>
                                            <TableCell className="font-bold text-xs uppercase text-center border-r bg-muted/20">{dayName}</TableCell>
                                            {teachingTimes.slots.map((slot, sIdx) => {
                                                const slotStart = timeToMinutes(slot.startTime);
                                                const slotEnd = timeToMinutes(slot.endTime);
                                                const sessionsInSlot = mergedSessions.filter(s => 
                                                    s.entry.day === dayName && 
                                                    timeToMinutes(s.entry.startTime) >= slotStart && 
                                                    timeToMinutes(s.entry.startTime) < slotEnd
                                                );

                                                return (
                                                    <TableCell key={sIdx} className="p-2 border-r align-top min-h-[100px] hover:bg-primary/5 transition-colors group relative">
                                                        <div className="space-y-2">
                                                            {sessionsInSlot.map((s, eIdx) => (
                                                                <div key={eIdx} className="p-2 rounded-md border bg-background border-primary/20 shadow-sm relative">
                                                                    <div className="flex justify-between items-start gap-1">
                                                                        <Link href={`/staff/courses/${s.entry.courseId}`} className="flex-1 group">
                                                                            <p className="font-bold text-[10px] text-primary leading-tight line-clamp-2 group-hover:underline" title={s.entry.courseName}>{s.entry.courseCode}: {s.entry.courseName}</p>
                                                                            <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-1"><MapPin className="h-2 w-2" /> {s.entry.venue}</div>
                                                                            <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-0.5"><UserCheck className="h-2 w-2" /> {s.lecturerNames}</div>
                                                                        </Link>
                                                                        <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={(e) => { e.preventDefault(); handleDeleteEntry(s.entry); }}><X className="h-3 w-3" /></Button>
                                                                    </div>
                                                                    <div className="mt-2 flex flex-wrap gap-1 border-t pt-1">
                                                                        {s.participants.map(p => (
                                                                            <Badge 
                                                                                key={p.semesterId} 
                                                                                variant="secondary" 
                                                                                className="text-[8px] h-4"
                                                                            >
                                                                                {p.name} ({p.standing})
                                                                            </Badge>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}