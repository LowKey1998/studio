"use client";
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle, Trash2, Clock, Bot, Search, ChevronsUpDown, Info, Calendar as CalendarIcon, MapPin, GraduationCap, X, UserCheck, CalendarDays, Users, Copy, Video, Monitor, Pencil, ChevronLeft, ChevronRight, Check, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth, createNotification, getRegistrarIds } from '@/lib/firebase';
import { ref, get, set, push, onValue, remove, update, serverTimestamp } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { generateFullTimetable } from '@/ai/flows/generate-timetable';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format, parseISO, startOfWeek, addWeeks, subWeeks, getDay, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from "@/components/ui/badge";
import Link from 'next/link';
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { useSearchParams, useRouter } from 'next/navigation';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
    isLiveSession?: boolean;
    isLiveRequested?: boolean;
};

type Semester = { id: string; name: string; intakeId: string; year: number; semesterInYear: number; status: 'Open' | 'Closed' | 'Archived'; };
type Course = { id: string; name: string; code: string; status: string; lecturerId: string; lecturerIds?: string[]; separateInstance?: boolean; };
type Room = { id: string; name: string; capacity: number; };
type Intake = { id: string; name: string; };

const calendarDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const timeToMinutes = (time: string) => {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

function TimetableManagementComponent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [loading, setLoading] = React.useState(true);
    const [generating, setGenerating] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    
    const [masterTimetable, setMasterTimetable] = React.useState<TimetableEntry[]>([]);
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [allCourses, setAllCourses] = React.useState<Course[]>([]);
    const [rooms, setRooms] = React.useState<Room[]>([]);
    const [intakes, setIntakes] = React.useState<Intake[]>([]);
    const [users, setUsers] = React.useState<Record<string, any>>({});
    const [studentCounts, setStudentCounts] = React.useState<Record<string, Record<string, number>>>({}); 
    const [teachingTimes, setTeachingTimes] = React.useState<{ days: string[], slots: TimeSlot[] }>({ days: calendarDays.slice(1, 6), slots: [] });
    const [calendarSettings, setCalendarSettings] = React.useState<any>(null);

    const [viewWeek, setViewWeek] = React.useState(new Date());
    const [viewTarget, setViewTarget] = React.useState(searchParams.get('intakeId') || 'master');
    const [roomFilter, setRoomFilter] = React.useState('all');
    const [intakeFilter, setIntakeFilter] = React.useState('all');
    const [searchTerm, setSearchTerm] = React.useState('');

    const [resolvedSemester, setResolvedSemester] = React.useState<Semester | null>(null);
    const [academicStanding, setAcademicStanding] = React.useState<string | null>(null);

    const [isAddOpen, setIsAddOpen] = React.useState(false);
    const [editingEntry, setEditingEntry] = React.useState<TimetableEntry | null>(null);
    const [selectedCourseId, setSelectedCourseId] = React.useState('');
    const [selectedIntakeId, setSelectedIntakeId] = React.useState('');
    const [day, setDay] = React.useState('');
    const [startTime, setStartTime] = React.useState('');
    const [endTime, setEndTime] = React.useState('');
    const [venue, setVenue] = React.useState('');
    const [isLiveSession, setIsLiveSession] = React.useState(false);
    
    const [courseSearch, setCourseSearch] = React.useState('');
    const [isCoursePopoverOpen, setIsCoursePopoverOpen] = React.useState(false);

    const [entryToDelete, setEntryToDelete] = React.useState<TimetableEntry | null>(null);

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
            ref(db, 'settings/academicCalendar'),
            ref(db, 'registrations')
        ];

        const unsubs = refs.map((r, i) => onValue(r, (snapshot) => {
            const data = snapshot.val() || {};
            switch(i) {
                case 0: setSemesters(Object.keys(data).map(id => ({ id, ...data[id] }))); break;
                case 1: setAllCourses(Object.keys(data).map(id => ({ id, ...data[id] })).filter(c => c.status === 'active')); break;
                case 2: setRooms(Object.entries(data).map(([id, d]: [string, any]) => ({ id, ...d }))); break;
                case 3: setIntakes(Object.entries(data).map(([id, d]: [string, any]) => ({ id, ...d }))); break;
                case 4: break; 
                case 5: setUsers(data); break;
                case 6: setTeachingTimes({
                    days: data.days || calendarDays.slice(1, 6),
                    slots: (data.slots || []).sort((a: TimeSlot, b: TimeSlot) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
                }); break;
                case 7: setCalendarSettings(data); break;
                case 8: {
                    const counts: Record<string, Record<string, number>> = {};
                    for (const userId in data) {
                        for (const semId in data[userId]) {
                            const reg = data[userId][semId];
                            if (reg.status === 'Completed' || reg.status === 'Pending Payment') {
                                if (!counts[semId]) counts[semId] = {};
                                const coursesArr = Array.isArray(reg.courses) ? reg.courses : (reg.courses ? Object.keys(reg.courses) : []);
                                coursesArr.forEach((cid: string) => {
                                    counts[semId][cid] = (counts[semId][cid] || 0) + 1;
                                });
                            }
                        }
                    }
                    setStudentCounts(counts);
                } break;
            }
            if(i === 8) setLoading(false);
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
                            const semInfo = sData[semId] || { name: semId === 'master' ? 'Master Schedule' : 'Manual Entry', status: 'Active' };
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
                    });
                });
            });
        });

        return () => {
            unsubs.forEach(unsub => unsub());
            unsubT();
        };
    }, []);

    React.useEffect(() => {
        if (viewTarget === 'master' || !calendarSettings) {
            setResolvedSemester(null);
            setAcademicStanding(null);
            return;
        }

        const intake = intakes.find(i => i.id === viewTarget);
        if (!intake) return;

        const startStr = parseIntakeDate(intake.name);
        if (startStr) {
            const state = calculateAcademicState(
                startStr,
                new Date(),
                calendarSettings.standardCycles,
                Object.values(calendarSettings.anomalies || {})
            );
            setAcademicStanding(`Year ${state.year}, Semester ${state.semester}`);
            
            const matched = semesters.find(s => 
                s.intakeId === intake.id && 
                s.year === state.year && 
                s.semesterInYear === state.semester
            );
            setResolvedSemester(matched || null);
        }
    }, [viewTarget, intakes, semesters, calendarSettings]);

    const effectiveSemesterId = React.useMemo(() => {
        if (viewTarget === 'master') return 'master';
        return resolvedSemester?.id || 'none';
    }, [viewTarget, resolvedSemester]);

    const filteredTimetable = React.useMemo(() => {
        return masterTimetable.filter(entry => {
            const matchesSemester = effectiveSemesterId === 'master' || entry.semesterId === effectiveSemesterId;
            const matchesRoom = roomFilter === 'all' || entry.venue === roomFilter;
            const matchesIntake = intakeFilter === 'all' || entry.intakeName === intakes.find(i => i.id === intakeFilter)?.name;
            const matchesSearch = !searchTerm || 
                entry.courseName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                entry.courseCode.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesSemester && matchesRoom && matchesIntake && matchesSearch;
        });
    }, [masterTimetable, effectiveSemesterId, roomFilter, intakeFilter, searchTerm, intakes]);

    const searchedCourses = React.useMemo(() => {
        if (!courseSearch) return allCourses;
        return allCourses.filter(c => 
            c.name.toLowerCase().includes(courseSearch.toLowerCase()) || 
            c.code.toLowerCase().includes(courseSearch.toLowerCase())
        );
    }, [allCourses, courseSearch]);

    const getActualCount = React.useCallback((courseId: string, semId: string, intakeName: string) => {
        const course = allCourses.find(c => c.id === courseId);
        if (!course) return 0;

        if (semId !== 'master') {
            return studentCounts[semId]?.[courseId] || 0;
        }

        if (course.separateInstance) {
            const matchingIntakeId = intakes.find(i => i.name === intakeName)?.id;
            if (!matchingIntakeId) return 0;
            
            let total = 0;
            semesters.forEach(s => {
                if (s.intakeId === matchingIntakeId && s.status !== 'Archived') {
                    total += studentCounts[s.id]?.[courseId] || 0;
                }
            });
            return total;
        }

        let total = 0;
        semesters.forEach(s => {
            if (s.status !== 'Archived') {
                total += studentCounts[s.id]?.[courseId] || 0;
            }
        });
        return total;
    }, [allCourses, studentCounts, semesters, intakes]);

    const handleSaveEntry = async () => {
        if (!selectedCourseId || !day || !startTime || !endTime) {
            toast({ variant: 'destructive', title: 'Missing required fields' });
            return;
        }
        setSaving(true);
        try {
            const intake = selectedIntakeId ? intakes.find(i => i.id === selectedIntakeId) : (resolvedSemester ? intakes.find(i => i.id === resolvedSemester.intakeId) : null);
            const intakeName = intake?.name || 'Master';

            const data = { 
                day, 
                startTime, 
                endTime, 
                venue: isLiveSession ? 'Online Session' : (venue || 'TBA'), 
                isLiveSession,
                isLiveRequested: false, 
                intakeName 
            };

            if (editingEntry) {
                const entryRef = ref(db, `timetables/${editingEntry.semesterId}/${editingEntry.courseId}/${editingEntry.id}`);
                await update(entryRef, data);
                toast({ title: "Entry Updated" });
            } else {
                const entryRef = push(ref(db, `timetables/${effectiveSemesterId}/${selectedCourseId}`));
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

    const handleApproveLive = async (entry: TimetableEntry, dateStr: string) => {
        setSaving(true);
        try {
            const path = `timetables/${entry.semesterId}/${entry.courseId}/${entry.id}/dateRequests/${dateStr}`;
            await update(ref(db, path), {
                status: 'Approved',
                approvedAt: serverTimestamp()
            });
            
            toast({ title: 'Live Session Approved' });
            
            const course = allCourses.find(c => c.id === entry.courseId);
            const lecturerId = course?.lecturerId;
            if (lecturerId) {
                await createNotification(
                    lecturerId,
                    `Your live session request for ${entry.courseCode} on ${dateStr} has been approved.`,
                    `/staff/courses/${entry.courseId}/live?semesterId=${entry.semesterId}`
                );
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Approval Failed' });
        } finally {
            setSaving(false);
        }
    };

    const handleRejectLive = async (entry: TimetableEntry, dateStr: string) => {
        if(!confirm("Are you sure you want to reject this live request and keep the session physical?")) return;
        setSaving(true);
        try {
            const path = `timetables/${entry.semesterId}/${entry.courseId}/${entry.id}/dateRequests/${dateStr}`;
            await remove(ref(db, path));
            toast({ title: 'Live Request Rejected' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Action Failed' });
        } finally {
            setSaving(false);
        }
    };

    const handleCopyFromMaster = async () => {
        if (effectiveSemesterId === 'master' || effectiveSemesterId === 'none') {
            toast({ variant: 'destructive', title: 'Invalid Selection', description: 'Please select a specific intake with an active semester to copy to.' });
            return;
        }
        
        setSaving(true);
        try {
            const masterSnap = await get(ref(db, 'timetables/master'));
            if (!masterSnap.exists()) {
                toast({ variant: 'destructive', title: 'Master Schedule Empty' });
                return;
            }

            const masterData = masterSnap.val();
            const targetRef = ref(db, `timetables/${effectiveSemesterId}`);
            await update(targetRef, masterData);
            toast({ title: 'Schedule Copied', description: `Master baseline loaded into ${resolvedSemester?.name}` });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Copy Failed', description: e.message });
        } finally {
            setSaving(false);
        }
    };

    const confirmDeleteEntry = async () => {
        if (!entryToDelete) return;
        try {
            await remove(ref(db, `timetables/${entryToDelete.semesterId}/${entryToDelete.courseId}/${entryToDelete.id}`));
            toast({ title: "Session Removed" });
        } catch (e) {
            toast({ variant: 'destructive', title: "Removal failed" });
        } finally {
            setEntryToDelete(null);
        }
    };

    const resetAddForm = () => {
        setEditingEntry(null); setSelectedCourseId(''); setSelectedIntakeId(''); setDay(''); setStartTime(''); setEndTime(''); setVenue(''); setCourseSearch(''); setIsLiveSession(false);
    };

    const handleCellClick = (dayName: string, slot: TimeSlot) => {
        if (effectiveSemesterId === 'none') return;
        resetAddForm();
        setDay(dayName);
        setStartTime(slot.startTime);
        setEndTime(slot.endTime);
        setIsAddOpen(true);
    };

    const currentWeekInterval = React.useMemo(() => {
        const start = startOfWeek(viewWeek, { weekStartsOn: 1 });
        return [0, 1, 2, 3, 4, 5, 6].map(i => {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            return d;
        });
    }, [viewWeek]);

    const mergedSessions = React.useMemo(() => {
        const sessions: Record<string, { entry: TimetableEntry; lecturerNames: string; totalStudents: number; participants: { semesterId: string; name: string; standing: string; count: number }[] }> = {};
        
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

                sessions[key] = { entry, lecturerNames, totalStudents: 0, participants: [] };
            }
            
            const sem = semesters.find(s => s.id === entry.semesterId);
            const intake = intakes.find(i => i.id === sem?.intakeId);
            const standing = sem ? `Y${sem.year}S${sem.semesterInYear}` : 'N/A';
            const count = getActualCount(entry.courseId, entry.semesterId, entry.intakeName);
            
            if (!sessions[key].participants.find(p => p.semesterId === entry.semesterId)) {
                sessions[key].participants.push({
                    semesterId: entry.semesterId,
                    name: intake?.name || entry.intakeName || 'N/A',
                    standing,
                    count
                });
                sessions[key].totalStudents += count;
            }
        });
        
        return Object.values(sessions);
    }, [filteredTimetable, allCourses, semesters, intakes, users, getActualCount]);

    const displayDays = teachingTimes.days.length > 0 ? teachingTimes.days : calendarDays.slice(1, 6);
    const hasSlots = teachingTimes.slots.length > 0;

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader>
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="font-headline text-2xl flex items-center gap-2"><CalendarDays className="h-6 w-6 text-primary"/> Timetable Management</CardTitle>
                            <CardDescription>Manage shared and separate sessions across all active semesters.</CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" onClick={handleCopyFromMaster} disabled={saving || viewTarget === 'master' || effectiveSemesterId === 'none'}>
                                <Copy className="mr-2 h-4 w-4"/> Load Master Baseline
                            </Button>
                            <Button variant="outline" onClick={async () => { setGenerating(true); try { await generateFullTimetable(); toast({ title: "Success" }); } catch(e:any) { toast({ variant:'destructive', title: "Failed", description: e.message }); } finally { setGenerating(false); } }} disabled={generating}>
                                {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Bot className="mr-2 h-4 w-4"/>} Auto-Generate
                            </Button>
                            <Dialog open={isAddOpen} onOpenChange={(o) => { setIsAddOpen(o); if(!o) resetAddForm(); }}>
                                <DialogTrigger asChild><Button disabled={effectiveSemesterId === 'none'}><PlusCircle className="mr-2 h-4 w-4"/> Add Session</Button></DialogTrigger>
                                <DialogContent className="sm:max-w-lg">
                                    <DialogHeader><DialogTitle>{editingEntry ? 'Edit' : `Add Entry to ${viewTarget === 'master' ? 'Master' : resolvedSemester?.name}`}</DialogTitle></DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        {viewTarget === 'master' && (
                                            <div className="space-y-1"><Label>Target Intake</Label><Select value={selectedIntakeId} onValueChange={setSelectedIntakeId}><SelectTrigger><SelectValue placeholder="Select intake..."/></SelectTrigger><SelectContent>{intakes.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
                                        )}
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
                                                            <Input placeholder="Search..." value={courseSearch} onChange={(e) => setCourseSearch(e.target.value)}/>
                                                        </div>
                                                        <ScrollArea className="h-64">
                                                            <div className="p-1">
                                                                {searchedCourses.map((c) => (
                                                                    <Button key={c.id} variant="ghost" className="w-full justify-start text-xs h-auto py-2" onClick={() => { setSelectedCourseId(c.id); setIsCoursePopoverOpen(false); }}>
                                                                        <div className="text-left">
                                                                            <div className="font-bold">{c.code}</div>
                                                                            <div className="text-muted-foreground">{c.name}</div>
                                                                        </div>
                                                                    </Button>
                                                                ))}
                                                            </div>
                                                        </ScrollArea>
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                        
                                        <div className="flex items-center space-x-2 py-2 p-4 border rounded-md bg-primary/5">
                                            <Switch id="is-live" checked={isLiveSession} onCheckedChange={setIsLiveSession} />
                                            <div className="space-y-0.5">
                                                <Label htmlFor="is-live" className="text-sm font-bold flex items-center gap-2">
                                                    <Video className="h-4 w-4 text-primary"/> Online Video Session
                                                </Label>
                                                <p className="text-[10px] text-muted-foreground leading-tight italic">Flags this session as an online class. Students can join via video call.</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1"><Label>Day</Label><Select value={day} onValueChange={setDay}><SelectTrigger><SelectValue placeholder="Day..."/></SelectTrigger><SelectContent>{calendarDays.slice(1, 6).map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></div>
                                            <div className="space-y-1">
                                                <Label>Venue</Label>
                                                {isLiveSession ? (
                                                    <div className="h-10 flex items-center px-3 border rounded-md bg-muted/50 text-xs font-bold text-primary italic">
                                                        <Monitor className="h-3 w-3 mr-2"/> DIGITAL ROOM
                                                    </div>
                                                ) : (
                                                    <Select value={venue} onValueChange={setVenue}><SelectTrigger><SelectValue placeholder="Room (Optional)"/></SelectTrigger><SelectContent><SelectItem value="TBA">None / TBA</SelectItem>{rooms.map(r => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}</SelectContent></Select>
                                                )}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1"><Label>Start Time</Label><Input placeholder="e.g. 14:00" value={startTime} onChange={e => setStartTime(e.target.value)} /></div>
                                            <div className="space-y-1"><Label>End Time</Label><Input placeholder="e.g. 16:00" value={endTime} onChange={e => setEndTime(e.target.value)} /></div>
                                        </div>
                                    </div>
                                    <DialogFooter><DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose><Button onClick={handleSaveEntry} disabled={saving}>Save Entry</Button></DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-4 items-end bg-muted/30 p-4 rounded-lg border">
                        <div className="w-72">
                            <Label className="text-xs font-black uppercase tracking-wider mb-1.5 block opacity-70">Viewing Schedule For</Label>
                            <Select value={viewTarget} onValueChange={setViewTarget}>
                                <SelectTrigger className="bg-background shadow-sm h-10 border-primary/20"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="master" className="font-bold text-primary">MASTER TEMPLATE (Baseline)</SelectItem>
                                    <Separator className="my-1"/>
                                    <div className="px-2 py-1.5 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Student Intakes</div>
                                    {intakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        {academicStanding && (
                            <Badge variant="secondary" className="h-10 px-4 gap-2 font-black uppercase tracking-widest text-[10px] border-primary/20 bg-primary/5 text-primary shadow-sm">
                                <GraduationCap className="h-4 w-4" />
                                {academicStanding}
                            </Badge>
                        )}
                        <div className="flex-1 min-w-[200px]"><Label className="text-xs font-black uppercase tracking-wider mb-1.5 block opacity-70">Search Course</Label><div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/><Input placeholder="Filter code or name..." className="pl-8 bg-background shadow-sm h-10 border-primary/20" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div></div>
                        <div className="w-48"><Label className="text-xs font-black uppercase tracking-wider mb-1.5 block opacity-70">Filter Room</Label><Select value={roomFilter} onValueChange={setRoomFilter}><SelectTrigger className="bg-background shadow-sm h-10 border-primary/20"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Rooms</SelectItem>{rooms.map(r => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}</SelectContent></Select></div>
                    </div>

                    {viewTarget !== 'master' && (
                        <div className="flex items-center justify-between px-2 py-2 bg-primary/5 border rounded-lg">
                            <div className="flex items-center gap-4">
                                <Button variant="outline" size="sm" onClick={() => setViewWeek(subWeeks(viewWeek, 1))}><ChevronLeft className="h-4 w-4 mr-1"/> Prev Week</Button>
                                <div className="font-bold text-sm uppercase tracking-widest text-primary">
                                    {format(currentWeekInterval[0], 'MMM dd')} - {format(currentWeekInterval[6], 'MMM dd, yyyy')}
                                </div>
                                <Button variant="outline" size="sm" onClick={() => setViewWeek(addWeeks(viewWeek, 1))}>Next Week <ChevronRight className="h-4 w-4 ml-1"/></Button>
                            </div>
                            <Badge variant="outline" className="text-[10px] font-black uppercase opacity-60">Calendar View</Badge>
                        </div>
                    )}

                    {viewTarget !== 'master' && !resolvedSemester && !loading && (
                        <Alert className="bg-orange-50 border-orange-200">
                            <AlertCircle className="h-4 w-4 text-orange-600" />
                            <AlertTitle className="font-bold text-orange-800">Semester Instance Not Found</AlertTitle>
                            <AlertDescription className="text-orange-700">
                                No active semester instance was found for **{intakes.find(i=>i.id===viewTarget)?.name}** at the resolved standing of **{academicStanding}**. Please create this semester in Registration Management to enable specific scheduling.
                            </AlertDescription>
                        </Alert>
                    )}

                    {!hasSlots ? (
                        <Alert variant="secondary"><Info className="h-4 w-4" /><AlertTitle>Matrix View Unavailable</AlertTitle><AlertDescription>Define **Time Slots** in Teaching Times Setup to enable the grid view.</AlertDescription></Alert>
                    ) : (
                        <div className="border rounded-lg overflow-hidden bg-muted/10 min-w-[800px] shadow-inner">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="w-32 border-r font-bold text-center">DATE & DAY</TableHead>
                                        {teachingTimes.slots.map((slot, index) => (<TableHead key={index} className="text-center font-bold border-r text-xs">{slot.startTime} - {slot.endTime}</TableHead>))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {currentWeekInterval.map(date => {
                                        const dayName = calendarDays[getDay(date)];
                                        const isDayToday = isToday(date);
                                        const dateStr = format(date, 'yyyy-MM-dd');
                                        const isEnabledDay = displayDays.includes(dayName);

                                        if (!isEnabledDay && viewTarget === 'master') return null;

                                        return (
                                            <TableRow key={date.toString()} className={cn(isDayToday && "bg-primary/5")}>
                                                <TableCell className={cn("font-bold text-xs border-r text-center", isDayToday ? "text-primary bg-primary/10" : "bg-muted/20")}>
                                                    <div className="flex flex-col">
                                                        <span className="uppercase text-[10px] opacity-70">{dayName}</span>
                                                        {viewTarget !== 'master' && <span className="text-sm font-black">{format(date, 'MMM dd')}</span>}
                                                    </div>
                                                </TableCell>
                                                {teachingTimes.slots.map((slot, sIdx) => {
                                                    const slotStart = timeToMinutes(slot.startTime);
                                                    const slotEnd = timeToMinutes(slot.endTime);
                                                    const sessionsInSlot = mergedSessions.filter(s => 
                                                        s.entry.day === dayName && 
                                                        timeToMinutes(s.entry.startTime) >= slotStart && 
                                                        timeToMinutes(s.entry.startTime) < slotEnd
                                                    );

                                                    return (
                                                        <TableCell 
                                                            key={sIdx} 
                                                            className="p-2 border-r align-top min-h-[100px] hover:bg-primary/5 transition-colors group relative cursor-pointer"
                                                            onClick={() => handleCellClick(dayName, slot)}
                                                        >
                                                            <div className="space-y-2">
                                                                {sessionsInSlot.map((s, eIdx) => {
                                                                    const dateRequest = (s.entry as any).dateRequests?.[dateStr];
                                                                    const isLiveRequestedOnDate = dateRequest?.status === 'Requested';
                                                                    const isLiveApprovedOnDate = dateRequest?.status === 'Approved' || s.entry.isLiveSession;

                                                                    return (
                                                                        <div 
                                                                            key={eIdx} 
                                                                            className={cn(
                                                                                "p-2 rounded-md border bg-background shadow-sm relative transition-all",
                                                                                isLiveApprovedOnDate ? "border-blue-500 bg-blue-50/20 shadow-blue-100" : "border-primary/20",
                                                                                isLiveRequestedOnDate && "border-orange-400 bg-orange-50/20"
                                                                            )}
                                                                            onClick={(e) => e.stopPropagation()} 
                                                                        >
                                                                            <div className="flex justify-between items-start gap-1">
                                                                                <div className="flex-1">
                                                                                    <div className="flex items-center gap-1">
                                                                                        <p className="font-bold text-[10px] text-primary leading-tight line-clamp-2" title={s.entry.courseName}>{s.entry.courseCode}: {s.entry.courseName}</p>
                                                                                        {isLiveApprovedOnDate && <Video className="h-3 w-3 text-blue-600 shrink-0"/>}
                                                                                        {isLiveRequestedOnDate && <AlertCircle className="h-3 w-3 text-orange-500 shrink-0" title="Live Link Requested"/>}
                                                                                    </div>
                                                                                    <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-1">
                                                                                        <MapPin className="h-2.5 w-2.5" /> {isLiveApprovedOnDate ? "DIGITAL ROOM" : s.entry.venue}
                                                                                    </div>
                                                                                    <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-0.5"><UserCheck className="h-2.5 w-2.5" /> {s.lecturerNames}</div>
                                                                                    <div className="flex items-center gap-1 text-[9px] font-bold text-green-600 mt-1"><Users className="h-2.5 w-2.5" /> {s.totalStudents} Students</div>
                                                                                </div>
                                                                                <div className="flex flex-col gap-1">
                                                                                    <Button 
                                                                                        variant="ghost" 
                                                                                        size="icon" 
                                                                                        className="h-5 w-5 hover:bg-primary/10" 
                                                                                        onClick={(e) => { e.stopPropagation(); setEditingEntry(s.entry); setDay(s.entry.day); setStartTime(s.entry.startTime); setEndTime(s.entry.endTime); setVenue(s.entry.venue); setIsLiveSession(!!s.entry.isLiveSession); setSelectedCourseId(s.entry.courseId); setIsAddOpen(true); }}
                                                                                    >
                                                                                        <Pencil className="h-3 w-3" />
                                                                                    </Button>
                                                                                    <Button 
                                                                                        variant="ghost" 
                                                                                        size="icon" 
                                                                                        className="h-5 w-5 text-destructive hover:bg-destructive/10" 
                                                                                        onClick={(e) => { e.stopPropagation(); setEntryToDelete(s.entry); }}
                                                                                    >
                                                                                        <X className="h-3 w-3" />
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                            
                                                                            {isLiveRequestedOnDate && (
                                                                                <div className="mt-2 pt-2 border-t flex gap-1">
                                                                                    <Button 
                                                                                        variant="outline" 
                                                                                        size="sm" 
                                                                                        className="flex-1 h-6 text-[8px] font-black uppercase bg-orange-100 text-orange-700 border-orange-200"
                                                                                        onClick={() => handleApproveLive(s.entry, dateStr)}
                                                                                        disabled={saving}
                                                                                    >
                                                                                        {saving ? <Loader2 className="h-2 w-2 animate-spin"/> : <Check className="h-2 w-2 mr-1"/>}
                                                                                        Approve
                                                                                    </Button>
                                                                                    <Button 
                                                                                        variant="outline" 
                                                                                        size="sm" 
                                                                                        className="flex-1 h-6 text-[8px] font-black uppercase bg-red-100 text-red-700 border-red-200"
                                                                                        onClick={() => handleRejectLive(s.entry, dateStr)}
                                                                                        disabled={saving}
                                                                                    >
                                                                                        {saving ? <Loader2 className="h-2 w-2 animate-spin"/> : <X className="h-2 w-2 mr-1"/>}
                                                                                        Reject
                                                                                    </Button>
                                                                                </div>
                                                                            )}

                                                                            <div className="mt-2 flex flex-wrap gap-1 border-t pt-1">
                                                                                {s.participants.map((p, idx) => (
                                                                                    <Badge 
                                                                                        key={idx} 
                                                                                        variant="secondary" 
                                                                                        className="text-[8px] h-4"
                                                                                    >
                                                                                        {p.name} ({p.standing}): {p.count}
                                                                                    </Badge>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                                {sessionsInSlot.length === 0 && (
                                                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <PlusCircle className="h-6 w-6 text-primary/40" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    );
                                                })}
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={!!entryToDelete} onOpenChange={(o) => !o && setEntryToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Session from Timetable?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove <strong>{entryToDelete?.courseName} ({entryToDelete?.courseCode})</strong> scheduled for <strong>{entryToDelete?.day} at {entryToDelete?.startTime}</strong> in <strong>{entryToDelete?.venue}</strong>. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteEntry} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove Session</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

export default function TimetableManagementPage() {
    return (
        <React.Suspense fallback={<Skeleton className="h-screen w-full" />}>
            <TimetableManagementComponent />
        </React.Suspense>
    );
}