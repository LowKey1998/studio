"use client";
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle, Trash2, Clock, Bot, Search, ChevronsUpDown, Info, Calendar as CalendarIcon, MapPin, GraduationCap, X, UserCheck } from 'lucide-react';
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

type Semester = { id: string; name: string; intakeId: string; startDate?: string; endDate?: string; status: 'Open' | 'Closed' | 'Archived'; };
type Course = { id: string; name: string; code: string; status: string; lecturerId: string; lecturerIds?: string[]; };
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
    
    // Searchable Course Select state
    const [courseSearch, setCourseSearch] = React.useState('');
    const [isCoursePopoverOpen, setIsCoursePopoverOpen] = React.useState(false);

    const { toast } = useToast();

    // Reactive data fetching with onValue
    React.useEffect(() => {
        setLoading(true);
        const semestersRef = ref(db, 'semesters');
        const coursesRef = ref(db, 'courses');
        const roomsRef = ref(db, 'settings/rooms');
        const intakesRef = ref(db, 'intakes');
        const timetablesRef = ref(db, 'timetables');
        const usersRef = ref(db, 'users');
        const settingsRef = ref(db, 'settings/teachingTimes');

        const unsubscribe = onValue(timetablesRef, (snapshot) => {
            const tData = snapshot.val() || {};
            
            // Get atomic values for other collections to prevent complex nesting
            Promise.all([
                get(semestersRef), get(coursesRef), get(intakesRef), get(usersRef), get(settingsRef), get(roomsRef)
            ]).then(([sSnap, cSnap, iSnap, uSnap, stSnap, rSnap]) => {
                const sData = sSnap.val() || {};
                const cData = cSnap.val() || {};
                const iData = iSnap.val() || {};
                const uData = uSnap.val() || {};
                const stData = stSnap.val() || {};
                const rmData = rSnap.val() || {};

                setSemesters(Object.keys(sData).map(id => ({ id, ...sData[id] })));
                setAllCourses(Object.keys(cData).map(id => ({ id, ...cData[id] })).filter(c => c.status === 'active'));
                setIntakes(Object.entries(iData).map(([id, data]: [string, any]) => ({ id, ...data })));
                setUsers(uData);
                setRooms(Object.entries(rmData).map(([id, data]: [string, any]) => ({ id, ...data })));
                setTeachingTimes({
                    days: stData.days || defaultDays,
                    slots: (stData.slots || []).sort((a: TimeSlot, b: TimeSlot) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
                });

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

        return () => unsubscribe();
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

    const handleSaveEntry = async () => {
        if (!selectedCourseId || !selectedIntakeId || !day || !startTime || !endTime) {
            toast({ variant: 'destructive', title: 'Missing required fields' });
            return;
        }
        setSaving(true);
        try {
            const intakeName = intakes.find(i => i.id === selectedIntakeId)?.name || 'Master';
            const data = { 
                day, 
                startTime, 
                endTime, 
                venue: venue || 'TBA',
                intakeName 
            };

            if (editingEntry) {
                const entryRef = ref(db, `timetables/${editingEntry.semesterId}/${editingEntry.courseId}/${editingEntry.id}`);
                await update(entryRef, data);
                toast({ title: "Entry Updated" });
            } else {
                const entryRef = push(ref(db, `timetables/master/${selectedCourseId}`));
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
        setEditingEntry(null);
        setSelectedCourseId('');
        setSelectedIntakeId('');
        setDay('');
        setStartTime('');
        setEndTime('');
        setVenue('');
        setCourseSearch('');
    };

    const handleCellClick = (selectedDay: string, slot: TimeSlot) => {
        setEditingEntry(null);
        setDay(selectedDay);
        setStartTime(slot.startTime);
        setEndTime(slot.endTime);
        if (intakeFilter !== 'all') {
            setSelectedIntakeId(intakeFilter);
        }
        setIsAddOpen(true);
    };

    const handleEditClick = (entry: TimetableEntry) => {
        setEditingEntry(entry);
        setSelectedCourseId(entry.courseId);
        const intake = intakes.find(i => i.name === entry.intakeName);
        setSelectedIntakeId(intake?.id || '');
        setDay(entry.day);
        setStartTime(entry.startTime);
        setEndTime(entry.endTime);
        setVenue(entry.venue);
        setIsAddOpen(true);
    };

    const filteredTimetable = React.useMemo(() => {
        return masterTimetable.filter(entry => {
            const roomMatch = roomFilter === 'all' || entry.venue === roomFilter;
            const intakeMatch = intakeFilter === 'all' || entry.intakeName === intakes.find(i => i.id === intakeFilter)?.name;
            const searchMatch = !searchTerm || entry.courseName.toLowerCase().includes(searchTerm.toLowerCase()) || entry.courseCode.toLowerCase().includes(searchTerm.toLowerCase());
            return roomMatch && intakeMatch && searchMatch;
        });
    }, [masterTimetable, roomFilter, intakeFilter, searchTerm, intakes]);

    const searchedCourses = React.useMemo(() => {
        if (!courseSearch) return allCourses;
        const lower = courseSearch.toLowerCase();
        return allCourses.filter(c => c.name.toLowerCase().includes(lower) || c.code.toLowerCase().includes(lower));
    }, [allCourses, courseSearch]);

    if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-12 w-1/3"/><Skeleton className="h-96 w-full"/></div>;

    const displayDays = teachingTimes.days.length > 0 ? teachingTimes.days : defaultDays;
    const hasSlots = teachingTimes.slots.length > 0;

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
                        <Dialog open={isAddOpen} onOpenChange={(o) => { setIsAddOpen(o); if(!o) resetAddForm(); }}>
                            <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/> Add Session</Button></DialogTrigger>
                            <DialogContent className="sm:max-w-lg">
                                <DialogHeader><DialogTitle>{editingEntry ? 'Edit Schedule Entry' : 'Manual Schedule Entry'}</DialogTitle></DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="space-y-1">
                                        <Label>Target Intake</Label>
                                        <Select value={selectedIntakeId} onValueChange={setSelectedIntakeId}>
                                            <SelectTrigger><SelectValue placeholder="Select intake..."/></SelectTrigger>
                                            <SelectContent>
                                                {intakes.map((i) => <SelectItem key={i.id || i.name} value={i.id}>{i.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Select Course</Label>
                                        <Popover open={isCoursePopoverOpen} onOpenChange={setIsCoursePopoverOpen}>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full justify-between font-normal">
                                                    {selectedCourseId ? allCourses.find(c => c.id === selectedCourseId)?.name : "Find a course..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                                <div className="flex flex-col">
                                                    <div className="p-2 border-b">
                                                        <div className="relative">
                                                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                                            <Input 
                                                                placeholder="Search code or name..." 
                                                                className="pl-8 h-9" 
                                                                value={courseSearch}
                                                                onChange={(e) => setCourseSearch(e.target.value)}
                                                            />
                                                        </div>
                                                    </div>
                                                    <ScrollArea className="h-64">
                                                        <div className="p-1">
                                                            {searchedCourses.length > 0 ? searchedCourses.map((c) => (
                                                                <Button
                                                                    key={c.id}
                                                                    variant="ghost"
                                                                    className="w-full justify-start text-xs h-auto py-2"
                                                                    onClick={() => {
                                                                        setSelectedCourseId(c.id);
                                                                        setIsCoursePopoverOpen(false);
                                                                    }}
                                                                >
                                                                    <div className="text-left">
                                                                        <div className="font-bold">{c.code}</div>
                                                                        <div className="text-muted-foreground">{c.name}</div>
                                                                    </div>
                                                                </Button>
                                                            )) : (
                                                                <div className="p-4 text-center text-xs text-muted-foreground">No courses found</div>
                                                            )}
                                                        </div>
                                                    </ScrollArea>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <Label>Day</Label>
                                            <Select value={day} onValueChange={setDay}><SelectTrigger><SelectValue placeholder="Day..."/></SelectTrigger><SelectContent>{displayDays.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label>Room/Venue (Optional)</Label>
                                            <Select value={venue} onValueChange={setVenue}>
                                                <SelectTrigger><SelectValue placeholder="Select Room (Optional)"/></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="TBA">None / TBA</SelectItem>
                                                    {rooms.map(r => <SelectItem key={r.id || r.name} value={r.name}>{r.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <Label>Start Time (24h)</Label>
                                            <Input placeholder="e.g. 14:00" value={startTime} onChange={e => setStartTime(e.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label>End Time (24h)</Label>
                                            <Input placeholder="e.g. 16:00" value={endTime} onChange={e => setEndTime(e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                                    <Button onClick={handleSaveEntry} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Save Entry</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4 overflow-x-auto">
                    <div className="flex flex-wrap gap-4 items-end bg-muted/30 p-4 rounded-lg">
                        <div className="flex-1 min-w-[200px]">
                            <Label>Search Course</Label>
                            <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/><Input placeholder="Search name or code..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
                        </div>
                        <div className="w-48">
                            <Label>Filter Room</Label>
                            <Select value={roomFilter} onValueChange={setRoomFilter}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Rooms</SelectItem>
                                    {rooms.map(r => <SelectItem key={r.id || r.name} value={r.name}>{r.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-48">
                            <Label>Filter Intake</Label>
                            <Select value={intakeFilter} onValueChange={setIntakeFilter}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Intakes</SelectItem>
                                    {intakes.map(i => <SelectItem key={i.id || i.name} value={i.id}>{i.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {!hasSlots ? (
                        <Alert variant="secondary">
                            <Info className="h-4 w-4" />
                            <AlertTitle>Matrix View Unavailable</AlertTitle>
                            <AlertDescription>
                                To see the professional grid view (Days as rows, Times as columns), please define specific **Time Slots** in the <Link href="/admin/academics/teaching-times" className="underline text-primary">Teaching Times Setup</Link>.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <div className="border rounded-lg overflow-hidden bg-muted/10 min-w-[800px]">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                                        <TableHead className="w-32 border-r font-bold text-center">DAY</TableHead>
                                        {teachingTimes.slots.map((slot, index) => (
                                            <TableHead key={slot.id || index} className="text-center font-bold border-r">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xs">{slot.startTime} - {slot.endTime}</span>
                                                </div>
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {displayDays.map(dayName => (
                                        <TableRow key={dayName}>
                                            <TableCell className="font-bold text-xs uppercase tracking-wider text-center border-r bg-muted/20">{dayName}</TableCell>
                                            {teachingTimes.slots.map((slot, sIdx) => {
                                                const slotStart = timeToMinutes(slot.startTime);
                                                const slotEnd = timeToMinutes(slot.endTime);
                                                
                                                const sessionsInSlot = filteredTimetable.filter(e => 
                                                    e.day === dayName && 
                                                    timeToMinutes(e.startTime) >= slotStart && 
                                                    timeToMinutes(e.startTime) < slotEnd
                                                );

                                                return (
                                                    <TableCell 
                                                        key={`${dayName}-${slot.id || sIdx}`} 
                                                        className="p-2 border-r align-top min-h-[100px] cursor-pointer hover:bg-primary/5 transition-colors group relative"
                                                        onClick={() => sessionsInSlot.length === 0 && handleCellClick(dayName, slot)}
                                                    >
                                                        <div className="space-y-2">
                                                            {sessionsInSlot.map((entry, eIdx) => (
                                                                <div 
                                                                    key={`${entry.id}-${eIdx}`} 
                                                                    className="group relative p-2 rounded-md border bg-background hover:bg-primary/5 transition-colors border-primary/20 shadow-sm"
                                                                    onClick={(e) => { e.stopPropagation(); handleEditClick(entry); }}
                                                                >
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="icon" 
                                                                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-background border opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                                                        onClick={(e) => { e.stopPropagation(); handleDeleteEntry(entry); }}
                                                                    >
                                                                        <X className="h-3 w-3 text-destructive" />
                                                                    </Button>
                                                                    <div className="flex flex-col gap-1">
                                                                        <p className="font-bold text-[10px] text-primary leading-tight line-clamp-2">{entry.courseCode}: {entry.courseName}</p>
                                                                        <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                                                                            <MapPin className="h-2.5 w-2.5" /> {entry.venue}
                                                                        </div>
                                                                        <Badge variant="secondary" className="text-[8px] h-3 py-0 px-1 w-fit">{entry.intakeName}</Badge>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {sessionsInSlot.length === 0 && (
                                                                <div className="opacity-0 group-hover:opacity-100 flex items-center justify-center py-4">
                                                                    <PlusCircle className="h-4 w-4 text-muted-foreground/50" />
                                                                </div>
                                                            )}
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