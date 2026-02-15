"use client";
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth, createNotification, getRegistrarIds } from '@/lib/firebase';
import { ref, get, set, onValue, update, serverTimestamp, remove } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Info, MapPin, UserCheck, Users, CalendarDays, Layers, ChevronLeft, ChevronRight, Video, Loader2, Clock, Search, ChevronsUpDown, Pencil, X, RotateCcw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { format, parseISO, startOfWeek, addWeeks, subWeeks, getDay, isToday } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

type TimeSlot = {
    id: string;
    startTime: string;
    endTime: string;
};

type TimetableEntry = {
    id: string;
    day: string;
    startTime: string;
    endTime: string;
    venue: string;
    courseId: string;
    courseCode: string;
    courseName: string;
    semesterId: string;
    semesterName: string;
    lecturerNames: string;
    studentCount: number;
    intakeName: string;
    isLiveSession?: boolean;
    isLiveRequested?: boolean;
};

type MergedEntry = {
    key: string;
    entry: TimetableEntry;
    totalStudents: number;
    participants: { name: string; standing: string; count: number }[];
};

const calendarDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const timeToMinutes = (time: string) => {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

export default function StaffTimetablePage() {
    const [mergedTimetable, setMergedTimetable] = React.useState<MergedEntry[]>([]);
    const [teachingTimes, setTeachingTimes] = React.useState<{ days: string[], slots: TimeSlot[] }>({ days: calendarDays.slice(1, 6), slots: [] });
    const [loading, setLoading] = React.useState(true);
    const [actionLoading, setActionLoading] = React.useState<string | null>(null);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [currentUserProfile, setCurrentUserProfile] = React.useState<any>(null);
    
    const [viewWeek, setViewWeek] = React.useState(new Date());
    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            setCurrentUser(user);
            if(user) {
                get(ref(db, `users/${user.uid}`)).then(s => setCurrentUserProfile(s.val()));
            }
        });
        return () => unsubscribe();
    }, []);

    const fetchData = React.useCallback(async () => {
        if (!currentUser?.uid) return;
        setLoading(true);
        try {
            const [coursesSnap, timetablesSnap, settingsSnap, usersSnap, regsSnap, semestersSnap, intakesSnap] = await Promise.all([
                get(ref(db, 'courses')),
                get(ref(db, 'timetables')),
                get(ref(db, 'settings/teachingTimes')),
                get(ref(db, 'users')),
                get(ref(db, 'registrations')),
                get(ref(db, 'semesters')),
                get(ref(db, 'intakes'))
            ]);

            const cData = coursesSnap.val() || {};
            const tData = timetablesSnap.val() || {};
            const settingsData = settingsSnap.val() || {};
            const usersData = usersSnap.val() || {};
            const regsData = regsSnap.val() || {};
            const sData = semestersSnap.val() || {};
            const iData = intakesSnap.val() || {};

            setTeachingTimes({
                days: settingsData.days || calendarDays.slice(1, 6),
                slots: (settingsData.slots || []).sort((a: TimeSlot, b: TimeSlot) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
            });

            const counts: Record<string, Record<string, number>> = {};
            for (const userId in regsData) {
                for (const semId in regsData[userId]) {
                    const reg = regsData[userId][semId];
                    if (reg.status === 'Completed' || reg.status === 'Pending Payment') {
                        if (reg.courses) {
                            if (!counts[semId]) counts[semId] = {};
                            const coursesArr = Array.isArray(reg.courses) ? reg.courses : Object.keys(reg.courses || {});
                            coursesArr.forEach((cid: string) => { counts[semId][cid] = (counts[semId][cid] || 0) + 1; });
                        }
                    }
                }
            }

            const myCourseIds = new Set<string>();
            Object.entries(cData).forEach(([id, c]: [string, any]) => {
                const lIds = c.lecturerIds || [];
                if ((Array.isArray(lIds) && lIds.includes(currentUser.uid)) || (c.lecturerId === currentUser.uid)) {
                    myCourseIds.add(id);
                }
            });

            const activeSemesterIds = new Set<string>();
            Object.keys(sData).forEach(sId => {
                const s = sData[sId];
                if (s.status === 'Archived') return;
                activeSemesterIds.add(sId);
            });

            const rawEntries: TimetableEntry[] = [];
            for (const semId in tData) {
                if (!activeSemesterIds.has(semId) && semId !== 'master') continue;
                const semInfo = sData[semId] || { name: semId === 'master' ? 'Master Template' : 'Ad-hoc' };
                
                for (const cId in tData[semId]) {
                    if (myCourseIds.has(cId)) {
                        const courseInfo = cData[cId];
                        const lecturerNames = (courseInfo.lecturerIds || [])
                            .map((uid: string) => usersData[uid]?.name)
                            .filter(Boolean)
                            .join(', ') || usersData[courseInfo.lecturerId]?.name || 'Unassigned';

                        Object.entries(tData[semId][cId]).forEach(([entryId, entry]: [string, any]) => {
                            rawEntries.push({
                                ...entry,
                                id: entryId,
                                courseId: cId,
                                courseCode: courseInfo.code,
                                courseName: courseInfo.name,
                                semesterId: semId,
                                semesterName: semInfo.name,
                                lecturerNames,
                                intakeName: entry.intakeName || iData[semInfo.intakeId]?.name || 'N/A'
                            });
                        });
                    }
                }
            }

            const mergedMap = new Map<string, MergedEntry>();
            rawEntries.forEach(entry => {
                const course = cData[entry.courseId];
                const key = course?.separateInstance ? `${entry.courseId}-${entry.day}-${entry.startTime}-${entry.venue}-${entry.semesterId}` : `${entry.courseId}-${entry.day}-${entry.startTime}-${entry.venue}`;

                if (!mergedMap.has(key)) {
                    mergedMap.set(key, { key, entry, totalStudents: 0, participants: [] });
                }

                const merged = mergedMap.get(key)!;
                const sem = sData[entry.semesterId];
                const standing = sem ? `Y${sem.year}S${sem.semesterInYear}` : 'N/A';
                
                let count = 0;
                if (entry.semesterId !== 'master') {
                    count = counts[entry.semesterId]?.[entry.courseId] || 0;
                } else {
                    if (course?.separateInstance) {
                        const matchingIntakeId = Object.keys(iData).find(id => iData[id].name === entry.intakeName);
                        Object.keys(sData).forEach(sId => { if (sData[sId].intakeId === matchingIntakeId && activeSemesterIds.has(sId)) count += counts[sId]?.[entry.courseId] || 0; });
                    } else {
                        Object.keys(sData).forEach(sId => { if (activeSemesterIds.has(sId)) count += counts[sId]?.[entry.courseId] || 0; });
                    }
                }

                if (!merged.participants.find(p => p.name === entry.intakeName && p.standing === standing)) {
                    merged.participants.push({ name: entry.intakeName, standing, count });
                    merged.totalStudents += count;
                }
            });

            setMergedTimetable(Array.from(mergedMap.values()));
        } catch (error) { console.error(error); } finally { setLoading(false); }
    }, [currentUser]);

    React.useEffect(() => {
        if (!currentUser) return;
        fetchData();
        const unsubT = onValue(ref(db, 'timetables'), (snapshot) => {
            if(snapshot.exists()) fetchData();
        });
        return () => unsubT();
    }, [currentUser, fetchData]);

    const handleRequestLive = async (merged: MergedEntry, date: Date) => {
        if (!currentUser || !currentUserProfile) return;
        const dateStr = format(date, 'yyyy-MM-dd');
        const actionKey = `${merged.key}-${dateStr}`;
        setActionLoading(actionKey);
        try {
            const updates: Record<string, any> = {};
            updates[`timetables/${merged.entry.semesterId}/${merged.entry.courseId}/${merged.entry.id}/dateRequests/${dateStr}`] = {
                status: 'Requested',
                timestamp: serverTimestamp()
            };
            
            await update(ref(db), updates);
            toast({ title: 'Request Sent', description: `Live session requested for ${format(date, 'PPP')}.` });
            setActionLoading(null);

            const registrarIds = await getRegistrarIds();
            if (registrarIds.length > 0) {
                await createNotification(
                    registrarIds, 
                    `${currentUserProfile.name} requested a Live Session for ${merged.entry.courseCode} on ${format(date, 'PPP')}.`,
                    '/admin/timetable'
                );
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Request Failed', description: e.message });
            setActionLoading(null);
        }
    };

    const handleUnrequestLive = async (merged: MergedEntry, date: Date) => {
        if (!currentUser) return;
        const dateStr = format(date, 'yyyy-MM-dd');
        const actionKey = `${merged.key}-${dateStr}`;
        setActionLoading(actionKey);
        try {
            const path = `timetables/${merged.entry.semesterId}/${merged.entry.courseId}/${merged.entry.id}/dateRequests/${dateStr}`;
            await remove(ref(db, path));
            toast({ title: 'Request Canceled', description: 'Session reverted to standard schedule.' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Action Failed', description: e.message });
        } finally {
            setActionLoading(null);
        }
    };

    const currentWeekInterval = React.useMemo(() => {
        const start = startOfWeek(viewWeek, { weekStartsOn: 1 });
        return [0, 1, 2, 3, 4, 5, 6].map(i => {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            return d;
        });
    }, [viewWeek]);

    const hasSlots = teachingTimes.slots.length > 0;

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl flex items-center gap-2"><CalendarDays className="h-6 w-6 text-primary"/> Active Teaching Schedule</CardTitle>
                    <CardDescription>Your weekly classes. Navigation is date-specific to handle varying session types.</CardDescription>
                </CardHeader>
            </Card>

            <div className="flex items-center justify-between px-2 py-2 bg-primary/5 border rounded-lg shadow-sm">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="sm" onClick={() => setViewWeek(subWeeks(viewWeek, 1))}><ChevronLeft className="h-4 w-4 mr-1"/> Prev Week</Button>
                    <div className="font-bold text-sm uppercase tracking-widest text-primary">
                        {format(currentWeekInterval[0], 'MMM dd')} - {format(currentWeekInterval[6], 'MMM dd, yyyy')}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setViewWeek(addWeeks(viewWeek, 1))}>Next Week <ChevronRight className="h-4 w-4 ml-1"/></Button>
                </div>
                <Badge variant="secondary" className="text-[10px] font-black uppercase">Cohort Schedule</Badge>
            </div>

            <Card className="shadow-lg">
                <CardContent className="overflow-x-auto pt-6">
                    {loading ? (
                        <Skeleton className="h-96 w-full" />
                    ) : !hasSlots ? (
                        <Alert><Info className="h-4 w-4" /><AlertTitle>Matrix View Unavailable</AlertTitle><AlertDescription>Institutional time slots have not been defined.</AlertDescription></Alert>
                    ) : (
                        <div className="border rounded-lg overflow-hidden bg-muted/10 min-w-[800px]">
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

                                        return (
                                            <TableRow key={date.toString()} className={cn(isDayToday && "bg-primary/5")}>
                                                <TableCell className={cn("font-bold text-xs border-r text-center", isDayToday ? "text-primary bg-primary/10" : "bg-muted/20")}>
                                                    <div className="flex flex-col">
                                                        <span className="uppercase text-[10px] opacity-70">{dayName}</span>
                                                        <span className="text-sm font-black">{format(date, 'MMM dd')}</span>
                                                    </div>
                                                </TableCell>
                                                {teachingTimes.slots.map((slot, sIdx) => {
                                                    const slotStart = timeToMinutes(slot.startTime);
                                                    const slotEnd = timeToMinutes(slot.endTime);
                                                    const sessionsInSlot = mergedTimetable.filter(m => m.entry.day === dayName && timeToMinutes(m.entry.startTime) >= slotStart && timeToMinutes(m.entry.startTime) < slotEnd);

                                                    return (
                                                        <TableCell key={sIdx} className="p-2 border-r align-top min-h-[100px]">
                                                            <div className="space-y-2">
                                                                {sessionsInSlot.map((m, eIdx) => {
                                                                    const dateRequest = (m.entry as any).dateRequests?.[dateStr];
                                                                    const isLiveRequestedOnDate = dateRequest?.status === 'Requested';
                                                                    const isLiveApprovedOnDate = dateRequest?.status === 'Approved' || m.entry.isLiveSession;

                                                                    return (
                                                                        <div key={eIdx} className={cn(
                                                                            "block p-2 rounded-md border bg-background shadow-sm transition-all",
                                                                            isLiveApprovedOnDate ? "border-blue-500 bg-blue-50/20 shadow-blue-100" : "border-primary/20",
                                                                            isLiveRequestedOnDate && "border-orange-400 bg-orange-50/20"
                                                                        )}>
                                                                            <div className="flex justify-between items-start">
                                                                                <p className="font-bold text-[10px] text-primary leading-tight line-clamp-2">{m.entry.courseCode}: {m.entry.courseName}</p>
                                                                                {isLiveApprovedOnDate ? <Video className="h-3 w-3 text-blue-600" /> : <Layers className="h-3 w-3 text-primary/40" />}
                                                                            </div>
                                                                            <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-1"><MapPin className="h-2.5 w-2.5" /> {isLiveApprovedOnDate ? "DIGITAL ROOM" : m.entry.venue}</div>
                                                                            <div className="flex items-center gap-1 text-[9px] font-bold text-green-600 mt-1"><Users className="h-2.5 w-2.5" /> {m.totalStudents} Students</div>
                                                                            
                                                                            {(!m.entry.isLiveSession) && (
                                                                                <div className="mt-2 pt-2 border-t flex items-center justify-between">
                                                                                    {isLiveApprovedOnDate ? (
                                                                                        <div className="flex items-center gap-1 w-full justify-between">
                                                                                            <Badge variant="outline" className="border-blue-500 bg-blue-50 text-blue-700 text-[8px] h-4">Live Approved</Badge>
                                                                                            <Button 
                                                                                                variant="ghost" 
                                                                                                size="icon" 
                                                                                                className="h-4 w-4 text-muted-foreground hover:text-destructive"
                                                                                                onClick={() => handleUnrequestLive(m, date)}
                                                                                                disabled={actionLoading === `${m.key}-${dateStr}`}
                                                                                            >
                                                                                                <RotateCcw className="h-3 w-3" />
                                                                                            </Button>
                                                                                        </div>
                                                                                    ) : isLiveRequestedOnDate ? (
                                                                                        <div className="flex items-center gap-1 w-full justify-between">
                                                                                            <Badge variant="secondary" className="bg-orange-100 text-orange-700 text-[8px] h-4">Requested</Badge>
                                                                                            <Button 
                                                                                                variant="ghost" 
                                                                                                size="icon" 
                                                                                                className="h-4 w-4 text-muted-foreground hover:text-destructive"
                                                                                                onClick={() => handleUnrequestLive(m, date)}
                                                                                                disabled={actionLoading === `${m.key}-${dateStr}`}
                                                                                            >
                                                                                                <X className="h-3 w-3" />
                                                                                            </Button>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <Button 
                                                                                            variant="ghost" 
                                                                                            size="sm" 
                                                                                            className="h-6 text-[9px] font-bold p-1 uppercase"
                                                                                            onClick={() => handleRequestLive(m, date)}
                                                                                            disabled={actionLoading === `${m.key}-${dateStr}`}
                                                                                        >
                                                                                            {actionLoading === `${m.key}-${dateStr}` ? <Loader2 className="h-3 w-3 animate-spin"/> : <Video className="h-3 w-3 mr-1"/>}
                                                                                            Request Live
                                                                                        </Button>
                                                                                    )}
                                                                                </div>
                                                                            )}

                                                                            <div className="mt-2 flex flex-wrap gap-1 border-t pt-1">
                                                                                {m.participants.map((p, pIdx) => (<Badge key={pIdx} variant="secondary" className="text-[8px] h-4 px-1">{p.name} ({p.standing}): {p.count}</Badge>))}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
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
        </div>
    );
}