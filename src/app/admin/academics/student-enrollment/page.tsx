'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus, Search, Trash2, Check, Info, Users, MapPin, CalendarDays, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, get, update } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { calculateAcademicState } from '@/lib/semester-utils';
import Link from 'next/link';

type Intake = { id: string; name: string; };
type Semester = { id: string; name: string; status: 'Open' | 'Closed' | 'Archived'; intakeId: string; year: number; semesterInYear: number; };
type Course = { id: string; name: string; code: string; cost: number; };
type Student = { uid: string; id: string; name: string; email: string; intakeId?: string; programmeId?: string; };
type TimeSlot = { id: string; startTime: string; endTime: string; };

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

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const timeToMinutes = (time: string) => {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

export default function StudentEnrollmentPage() {
    const [intakes, setIntakes] = React.useState<Intake[]>([]);
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [allCourses, setAllCourses] = React.useState<Record<string, Course>>({});
    const [allStudents, setAllStudents] = React.useState<Student[]>([]);
    const [masterTimetable, setMasterTimetable] = React.useState<TimetableEntry[]>([]);
    const [teachingTimes, setTeachingTimes] = React.useState<{ days: string[], slots: TimeSlot[] }>({ days: daysOfWeek, slots: [] });
    const [calendarSettings, setCalendarSettings] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);

    // Selection state
    const [selectedIntake, setSelectedIntake] = React.useState('');
    const [activeSession, setActiveSession] = React.useState<TimetableEntry | null>(null);
    const [enrolledStudents, setEnrolledStudents] = React.useState<Student[]>([]);
    const [actionLoading, setActionLoading] = React.useState<string | null>(null);
    const [searchStudent, setSearchStudent] = React.useState('');
    const [studentIntakeFilter, setStudentIntakeFilter] = React.useState('all');

    const { toast } = useToast();

    const fetchEnrolledStudents = React.useCallback(async (courseId: string, semesterId: string) => {
        setActionLoading('fetching');
        try {
            const regsSnap = await get(ref(db, 'registrations'));
            if (regsSnap.exists()) {
                const regs = regsSnap.val();
                const uids: string[] = [];
                for (const userId in regs) {
                    if (regs[userId][semesterId]?.courses?.includes(courseId)) {
                        uids.push(userId);
                    }
                }
                setEnrolledStudents(allStudents.filter(s => uids.includes(s.uid)));
            } else {
                setEnrolledStudents([]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setActionLoading(null);
        }
    }, [allStudents]);

    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [intakeSnap, semSnap, coursesSnap, usersSnap, settingsSnap, timetablesSnap, calendarSnap] = await Promise.all([
                get(ref(db, 'intakes')),
                get(ref(db, 'semesters')),
                get(ref(db, 'courses')),
                get(ref(db, 'users')),
                get(ref(db, 'settings/teachingTimes')),
                get(ref(db, 'timetables')),
                get(ref(db, 'settings/academicCalendar'))
            ]);

            const iData = intakeSnap.val() || {};
            const sData = semSnap.val() || {};
            const cData = coursesSnap.val() || {};
            const uData = usersSnap.val() || {};
            const tData = timetablesSnap.val() || {};
            const settingsData = settingsSnap.val() || {};
            
            setCalendarSettings(calendarSnap.val());
            
            const intakeList = Object.entries(iData).map(([id, data]: [string, any]) => ({ id, ...data })).sort((a,b) => b.name.localeCompare(a.name));
            setIntakes(intakeList);
            setSemesters(Object.entries(sData).map(([id, data]: [string, any]) => ({ id, ...data })));
            setAllCourses(cData);
            
            const studentsList: Student[] = [];
            for (const uid in uData) {
                if (uData[uid].role === 'Student') {
                    studentsList.push({ uid, ...uData[uid] });
                }
            }
            setAllStudents(studentsList);

            setTeachingTimes({
                days: settingsData.days || daysOfWeek,
                slots: (settingsData.slots || []).sort((a: TimeSlot, b: TimeSlot) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
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

        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Data Loading Error' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleEnrollStudent = async (uid: string) => {
        if (!activeSession) return;
        const { courseId, semesterId } = activeSession;
        const selectedIntakeData = intakes.find(i => i.id === selectedIntake);
        
        setActionLoading(uid);
        try {
            const regRef = ref(db, `registrations/${uid}/${semesterId}`);
            const regSnap = await get(regRef);
            
            let currentCourses = [];
            if (regSnap.exists()) {
                currentCourses = regSnap.val().courses || [];
            }

            if (currentCourses.includes(courseId)) {
                toast({ title: 'Already enrolled' });
                setActionLoading(null);
                return;
            }

            const updatedCourses = [...currentCourses, courseId];
            const student = allStudents.find(s => s.uid === uid);

            await update(regRef, { 
                courses: updatedCourses,
                programmeId: student?.programmeId || regSnap.val()?.programmeId || '',
                intakeId: selectedIntake || student?.intakeId || '',
                status: regSnap.exists() ? regSnap.val().status : 'Completed',
                registrationDate: regSnap.exists() ? regSnap.val().registrationDate : new Date().toISOString(),
                semesterName: semesters.find(s => s.id === semesterId)?.name || ''
            });

            toast({ title: 'Student Enrolled Successfully' });
            fetchEnrolledStudents(courseId, semesterId);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Enrollment Failed', description: e.message });
        } finally {
            setActionLoading(null);
        }
    };

    const handleRemoveStudent = async (uid: string) => {
        if (!activeSession || !window.confirm("Remove student from this course?")) return;
        const { courseId, semesterId } = activeSession;

        setActionLoading(uid);
        try {
            const regRef = ref(db, `registrations/${uid}/${semesterId}`);
            const regSnap = await get(regRef);
            if (regSnap.exists()) {
                const currentCourses = regSnap.val().courses || [];
                const updatedCourses = currentCourses.filter((id: string) => id !== courseId);
                
                // If this was the only course, we could either keep the record or remove it.
                // Keeping the status/dates is usually safer for audit purposes.
                await update(regRef, { courses: updatedCourses });
                
                toast({ title: 'Student Removed' });
                // Refresh local list
                setEnrolledStudents(prev => prev.filter(s => s.uid !== uid));
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Removal Failed' });
        } finally {
            setActionLoading(null);
        }
    };

    const selectedIntakeData = intakes.find(i => i.id === selectedIntake);
    const intakeName = selectedIntakeData?.name;
    
    const calculatedState = React.useMemo(() => {
        if (!intakeName || !calendarSettings) return null;
        const yearMatch = intakeName.match(/\d{4}/);
        const monthMatch = intakeName.match(/[A-Z]{3}/);
        if (!yearMatch || !monthMatch) return null;

        const startMonth = monthMatch[0] === 'JAN' ? '01' : '07';
        const intakeStartStr = `${yearMatch[0]}-${startMonth}-01`;
        
        return calculateAcademicState(
            intakeStartStr, 
            new Date(), 
            calendarSettings.standardCycles, 
            Object.values(calendarSettings.anomalies || {})
        );
    }, [intakeName, calendarSettings]);

    const filteredTimetable = React.useMemo(() => {
        if (!selectedIntake || !intakeName) return [];
        return masterTimetable.filter(entry => entry.intakeName === intakeName);
    }, [masterTimetable, selectedIntake, intakeName]);

    const availableStudents = allStudents.filter(s => 
        !enrolledStudents.some(e => e.uid === s.uid) &&
        (s.name.toLowerCase().includes(searchStudent.toLowerCase()) || s.id.toLowerCase().includes(searchStudent.toLowerCase())) &&
        (studentIntakeFilter === 'all' || s.intakeId === studentIntakeFilter)
    );

    if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-12 w-1/3"/><Skeleton className="h-96 w-full"/></div>;

    const displayDays = teachingTimes.days.length > 0 ? teachingTimes.days : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const hasSlots = teachingTimes.slots.length > 0;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2"><Users /> Student Enrollment Management</CardTitle>
                        <CardDescription>Select an Intake to view its schedule and manage student classes.</CardDescription>
                    </div>
                    <Button variant="outline" asChild><Link href="/admin/academics/semester-setup">Academic Calendar Rules</Link></Button>
                </CardHeader>
                <CardContent>
                    <div className="grid md:grid-cols-2 gap-4 max-w-2xl">
                        <div className="space-y-1">
                            <Label className="font-semibold">Select Intake</Label>
                            <Select value={selectedIntake} onValueChange={(val) => { setSelectedIntake(val); setActiveSession(null); }}>
                                <SelectTrigger><SelectValue placeholder="Select an intake..." /></SelectTrigger>
                                <SelectContent>
                                    {intakes.map(i => (
                                        <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {calculatedState && (
                            <div className="flex items-end">
                                <Badge variant="secondary" className="h-10 px-4 text-sm gap-2">
                                    <CalendarDays className="h-4 w-4"/> Current: Year {calculatedState.year}, Sem {calculatedState.semester}
                                </Badge>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {selectedIntake && !hasSlots && (
                <Alert variant="secondary">
                    <Info className="h-4 w-4" />
                    <AlertTitle>Matrix View Unavailable</AlertTitle>
                    <AlertDescription>
                        Please define standard time slots in "Teaching Times Setup" under Academics to enable the grid view.
                    </AlertDescription>
                </Alert>
            )}

            {selectedIntake && hasSlots && (
                <Card>
                    <CardHeader><CardTitle>{intakeName} Timetable Grid</CardTitle></CardHeader>
                    <CardContent className="overflow-x-auto">
                        <div className="border rounded-lg overflow-hidden bg-muted/10 min-w-[800px]">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
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
                                                    <TableCell key={`${dayName}-${slot.id || sIdx}`} className="p-2 border-r align-top min-h-[100px]">
                                                        <div className="space-y-2">
                                                            {sessionsInSlot.map((entry, eIdx) => (
                                                                <div 
                                                                    key={eIdx} 
                                                                    className={cn(
                                                                        "cursor-pointer group relative p-2 rounded-md border bg-background hover:bg-primary/5 transition-all border-primary/20 shadow-sm",
                                                                        activeSession?.id === entry.id && "ring-2 ring-primary border-transparent shadow-md"
                                                                    )}
                                                                    onClick={() => {
                                                                        setActiveSession(entry);
                                                                        fetchEnrolledStudents(entry.courseId, entry.semesterId);
                                                                    }}
                                                                >
                                                                    <div className="flex flex-col gap-1">
                                                                        <p className="font-bold text-[10px] text-primary leading-tight line-clamp-2">{entry.courseCode}: {entry.courseName}</p>
                                                                        <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                                                                            <MapPin className="h-2.5 w-2.5" /> {entry.venue}
                                                                        </div>
                                                                        <Badge variant="secondary" className="text-[8px] h-3 py-0 px-1 w-fit">{entry.semesterName.split(' ').slice(-2).join(' ')}</Badge>
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
                    </CardContent>
                </Card>
            )}

            <Dialog open={!!activeSession} onOpenChange={(open) => !open && setActiveSession(null)}>
                <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Enrollment: {activeSession && activeSession.courseName}</DialogTitle>
                        <DialogDescription>Add or remove students for this session in {activeSession && activeSession.semesterName}.</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-hidden grid md:grid-cols-2 gap-6 py-4">
                        <div className="flex flex-col gap-4 border rounded-lg p-4 bg-muted/10">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold flex items-center gap-2"><UserPlus className="h-4 w-4 text-primary"/> Available Students</h3>
                                <div className="w-32">
                                    <Select value={studentIntakeFilter} onValueChange={setStudentIntakeFilter}>
                                        <SelectTrigger className="h-8 text-xs">
                                            <Filter className="h-3 w-3 mr-1" />
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Intakes</SelectItem>
                                            {intakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Search students..." className="pl-8 bg-background" value={searchStudent} onChange={e => setSearchStudent(e.target.value)} />
                            </div>
                            <ScrollArea className="flex-1">
                                <div className="space-y-2 pr-4">
                                    {availableStudents.map(s => (
                                        <div key={s.uid} className="flex items-center justify-between p-3 border rounded-md bg-background hover:bg-muted transition-colors">
                                            <div className="text-sm">
                                                <p className="font-bold">{s.name}</p>
                                                <p className="text-xs text-muted-foreground">{s.id}</p>
                                            </div>
                                            <Button size="sm" variant="outline" onClick={() => handleEnrollStudent(s.uid)} disabled={!!actionLoading}>
                                                {actionLoading === s.uid ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4"/>}
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>

                        <div className="flex flex-col gap-4 border rounded-lg p-4">
                            <h3 className="font-bold flex items-center gap-2"><Users className="h-4 w-4 text-primary"/> Enrolled Students ({enrolledStudents.length})</h3>
                            <ScrollArea className="flex-1">
                                <div className="space-y-2 pr-4">
                                    {enrolledStudents.map(s => (
                                        <div key={s.uid} className="flex items-center justify-between p-3 border rounded-md hover:bg-muted transition-colors">
                                            <div className="text-sm">
                                                <p className="font-bold">{s.name}</p>
                                                <p className="text-xs text-muted-foreground">{s.id}</p>
                                            </div>
                                            <Button size="icon" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => handleRemoveStudent(s.uid)} disabled={!!actionLoading}>
                                                {actionLoading === s.uid ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4"/>}
                                            </Button>
                                        </div>
                                    ))}
                                    {enrolledStudents.length === 0 && (
                                        <div className="text-center py-12 text-muted-foreground">No students enrolled yet.</div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Done</Button></DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}