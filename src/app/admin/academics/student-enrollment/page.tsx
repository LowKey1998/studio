'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus, Search, Trash2, Check, Info, Users, MapPin, CalendarDays, Filter, Settings2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, get, update, set } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogCancel, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter, 
    AlertDialogHeader, 
    AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { calculateAcademicState } from '@/lib/semester-utils';
import Link from 'next/link';
import { sendEmail } from '@/ai/flows/send-email-flow';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

type Intake = { id: string; name: string; };
type Semester = { id: string; name: string; status: 'Open' | 'Closed' | 'Archived'; intakeId: string; year: number; semesterInYear: number; };
type Course = { id: string; name: string; code: string; cost: number; };
type Student = { uid: string; id: string; name: string; email: string; intakeId?: string; programmeId?: string; };
type EnrolledStudent = Student & { enrolledInSemester: string; semesterId: string; };
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
    const [enrolledStudents, setEnrolledStudents] = React.useState<EnrolledStudent[]>([]);
    const [actionLoading, setActionLoading] = React.useState<string | null>(null);
    const [searchStudent, setSearchStudent] = React.useState('');
    const [studentIntakeFilter, setIntakeFilter] = React.useState('all');
    
    // Multi-select state
    const [selectedUids, setSelectedUids] = React.useState<Record<string, boolean>>({});
    
    // Email Template state
    const [isConfigOpen, setIsConfigOpen] = React.useState(false);
    const [enrollmentTemplate, setEnrollmentTemplate] = React.useState({
        subject: 'Class Enrollment Notification: [CourseCode]',
        body: `<h2>Class Enrollment Notification</h2>\n<p>Hello [Name],</p>\n<p>You have been <strong>enrolled in</strong> the following course:</p>\n<p><strong>Course:</strong> [CourseName] ([CourseCode])<br/>\n<strong>Time:</strong> [Day] at [Time]</p>\n<p>You can view your updated classes and timetable on the student portal:<br/>\n<a href="https://edutrack36.vercel.app">https://edutrack36.vercel.app</a></p>\n<p><strong>User ID:</strong> [UserID]</p>\n<p>Best regards,<br/>The Administration</p>`
    });
    const [removalTemplate, setRemovalTemplate] = React.useState({
        subject: 'Class Removal Notification: [CourseCode]',
        body: `<h2>Class Removal Notification</h2>\n<p>Hello [Name],</p>\n<p>You have been <strong>removed from</strong> the following course:</p>\n<p><strong>Course:</strong> [CourseName] ([CourseCode])<br/>\n<strong>Time:</strong> [Day] at [Time]</p>\n<p>If you believe this is an error, please contact the Registrar's office.</p>\n<p>You can view your current classes on the student portal:<br/>\n<a href="https://edutrack36.vercel.app">https://edutrack36.vercel.app</a></p>\n<p><strong>User ID:</strong> [UserID]</p>\n<p>Best regards,<br/>The Administration</p>`
    });

    const [studentToRemove, setStudentToRemove] = React.useState<EnrolledStudent | null>(null);

    const { toast } = useToast();

    const fetchEnrolledStudents = React.useCallback(async (courseId: string) => {
        setActionLoading('fetching');
        try {
            const actualRegsSnap = await get(ref(db, 'registrations'));
            const enrollmentList: EnrolledStudent[] = [];
            if (actualRegsSnap.exists()) {
                const regs = actualRegsSnap.val();
                for (const userId in regs) {
                    const student = allStudents.find(s => s.uid === userId);
                    if (!student) continue;

                    for (const semId in regs[userId]) {
                        if (regs[userId][semId].courses?.includes(courseId)) {
                            const semInfo = semesters.find(s => s.id === semId);
                            enrollmentList.push({
                                ...student,
                                enrolledInSemester: semInfo ? `Year ${semInfo.year}, Sem ${semInfo.semesterInYear}` : "Unknown Semester",
                                semesterId: semId
                            });
                        }
                    }
                }
            }
            setEnrolledStudents(enrollmentList);
        } catch (e) {
            console.error(e);
        } finally {
            setActionLoading(null);
        }
    }, [allStudents, semesters]);

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

    const performEnrollmentAction = async (type: 'enroll' | 'remove', studentOrStudents: Student | Student[]) => {
        if (!activeSession || !calendarSettings) return;
        
        const students = Array.isArray(studentOrStudents) ? studentOrStudents : [studentOrStudents];
        if (students.length === 0) return;

        setActionLoading(type === 'enroll' ? 'bulk-enroll' : students[0].uid);
        
        try {
            for (const student of students) {
                const studentIntake = intakes.find(i => i.id === (student.intakeId || selectedIntake));
                if (!studentIntake) continue;

                const yearMatch = studentIntake.name.match(/\d{4}/);
                const monthMatch = studentIntake.name.match(/[A-Z]{3}/);
                if (!yearMatch || !monthMatch) continue;

                const startMonth = monthMatch[0] === 'JAN' ? '01' : '07';
                const intakeStartStr = `${yearMatch[0]}-${startMonth}-01`;
                
                const state = calculateAcademicState(
                    intakeStartStr, 
                    new Date(), 
                    calendarSettings.standardCycles, 
                    Object.values(calendarSettings.anomalies || {})
                );

                const targetSemester = semesters.find(s => 
                    s.intakeId === studentIntake.id && 
                    s.year === state.year && 
                    s.semesterInYear === state.semester
                );

                if (!targetSemester) {
                    console.warn(`No target semester object found for Intake ${studentIntake.name}, Yr ${state.year}, Sem ${state.semester}`);
                    continue;
                }

                const regRef = ref(db, `registrations/${student.uid}/${targetSemester.id}`);
                const regSnap = await get(regRef);
                
                if (type === 'enroll') {
                    let currentCourses = [];
                    if (regSnap.exists()) {
                        currentCourses = regSnap.val().courses || [];
                    }
                    const updatedCourses = [...new Set([...currentCourses, activeSession.courseId])];

                    await update(regRef, { 
                        courses: updatedCourses,
                        programmeId: student?.programmeId || regSnap.val()?.programmeId || '',
                        intakeId: student.intakeId || selectedIntake,
                        status: regSnap.exists() ? regSnap.val().status : 'Completed',
                        registrationDate: regSnap.exists() ? regSnap.val().registrationDate : new Date().toISOString(),
                        semesterName: targetSemester.name
                    });
                } else {
                    const studentToRemoveEnrolled = student as EnrolledStudent;
                    const specificRegRef = ref(db, `registrations/${student.uid}/${studentToRemoveEnrolled.semesterId}`);
                    const specificRegSnap = await get(specificRegRef);
                    
                    if (specificRegSnap.exists()) {
                        const courses = specificRegSnap.val().courses || [];
                        const updatedCourses = courses.filter((id: string) => id !== activeSession.courseId);
                        await update(specificRegRef, { courses: updatedCourses });
                    }
                }

                const baseTemplate = type === 'enroll' ? enrollmentTemplate : removalTemplate;
                const replacePlaceholders = (text: string) => {
                    return text
                        .replace(/\[Name\]/g, student.name)
                        .replace(/\[CourseName\]/g, activeSession.courseName)
                        .replace(/\[CourseCode\]/g, activeSession.courseCode)
                        .replace(/\[Day\]/g, activeSession.day)
                        .replace(/\[Time\]/g, activeSession.startTime)
                        .replace(/\[UserID\]/g, student.id);
                };

                await sendEmail({
                    to: [student.email],
                    subject: replacePlaceholders(baseTemplate.subject),
                    body: replacePlaceholders(baseTemplate.body)
                });
            }

            toast({ 
                title: type === 'enroll' ? 'Enrollment Complete' : 'Removal Complete', 
                description: `${students.length} student(s) processed and notified.` 
            });
            
            if (type === 'enroll') setSelectedUids({});
            setStudentToRemove(null);
            await fetchEnrolledStudents(activeSession.courseId);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Action Failed', description: e.message });
        } finally {
            setActionLoading(null);
        }
    };

    const selectedIntakeData = intakes.find(i => i.id === selectedIntake);
    const intakeNameForState = selectedIntakeData?.name;
    
    const calculatedState = React.useMemo(() => {
        if (!intakeNameForState || !calendarSettings) return null;
        const yearMatch = intakeNameForState.match(/\d{4}/);
        const monthMatch = intakeNameForState.match(/[A-Z]{3}/);
        if (!yearMatch || !monthMatch) return null;

        const startMonth = monthMatch[0] === 'JAN' ? '01' : '07';
        const intakeStartStr = `${yearMatch[0]}-${startMonth}-01`;
        
        return calculateAcademicState(
            intakeStartStr, 
            new Date(), 
            calendarSettings.standardCycles, 
            Object.values(calendarSettings.anomalies || {})
        );
    }, [intakeNameForState, calendarSettings]);

    const filteredTimetable = React.useMemo(() => {
        if (!selectedIntake || !intakeNameForState) return [];
        return masterTimetable.filter(entry => entry.intakeName === intakeNameForState);
    }, [masterTimetable, selectedIntake, intakeNameForState]);

    const availableStudents = allStudents.filter(s => 
        !enrolledStudents.some(e => e.uid === s.uid) &&
        (s.name.toLowerCase().includes(searchStudent.toLowerCase()) || s.id.toLowerCase().includes(searchStudent.toLowerCase())) &&
        (studentIntakeFilter === 'all' || s.intakeId === studentIntakeFilter)
    );

    const handleSelectAll = (checked: boolean) => {
        const next: Record<string, boolean> = {};
        if (checked) {
            availableStudents.forEach(s => next[s.uid] = true);
        }
        setSelectedUids(next);
    };

    const handleToggleSelection = (uid: string) => {
        setSelectedUids(prev => ({ ...prev, [uid]: !prev[uid] }));
    };

    const selectedCount = Object.values(selectedUids).filter(Boolean).length;

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
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setIsConfigOpen(true)}><Settings2 className="mr-2 h-4 w-4"/>Email Templates</Button>
                        <Button variant="outline" asChild><Link href="/admin/academics/semester-setup">Calendar Rules</Link></Button>
                    </div>
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
                    <CardHeader><CardTitle>{intakeNameForState} Timetable Grid</CardTitle></CardHeader>
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
                                                                        "cursor-pointer group relative p-2 rounded-md border bg-background border-primary/20 shadow-sm transition-all",
                                                                        activeSession?.id === entry.id ? "ring-2 ring-primary border-transparent shadow-md" : "hover:bg-primary/5"
                                                                    )}
                                                                    onClick={() => {
                                                                        setActiveSession(entry);
                                                                        fetchEnrolledStudents(entry.courseId);
                                                                        setIntakeFilter(selectedIntake);
                                                                        setSelectedUids({});
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
                        <DialogDescription>Add or remove students for this session. Notifications are sent automatically.</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-hidden grid md:grid-cols-2 gap-6 py-4">
                        <div className="flex flex-col gap-4 border rounded-lg p-4 bg-muted/10">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Checkbox 
                                        checked={availableStudents.length > 0 && Object.keys(selectedUids).length === availableStudents.length} 
                                        onCheckedChange={handleSelectAll} 
                                    />
                                    <h3 className="font-bold flex items-center gap-2"><UserPlus className="h-4 w-4 text-primary"/> Available</h3>
                                </div>
                                <div className="w-32">
                                    <Select value={studentIntakeFilter} onValueChange={setIntakeFilter}>
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
                            
                            {selectedCount > 0 && (
                                <Button size="sm" onClick={() => performEnrollmentAction('enroll', availableStudents.filter(s => selectedUids[s.uid]))} disabled={actionLoading === 'bulk-enroll'}>
                                    {actionLoading === 'bulk-enroll' ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <UserPlus className="h-4 w-4 mr-2"/>}
                                    Enroll Selected ({selectedCount})
                                </Button>
                            )}

                            <ScrollArea className="flex-1">
                                <div className="space-y-2 pr-4">
                                    {availableStudents.map(s => (
                                        <div key={s.uid} className="flex items-center justify-between p-3 border rounded-md bg-background hover:bg-muted transition-colors">
                                            <div className="flex items-center gap-3">
                                                <Checkbox checked={!!selectedUids[s.uid]} onCheckedChange={() => handleToggleSelection(s.uid)} />
                                                <div className="text-sm">
                                                    <p className="font-bold">{s.name}</p>
                                                    <p className="text-xs text-muted-foreground">{s.id}</p>
                                                </div>
                                            </div>
                                            <Button size="sm" variant="outline" onClick={() => performEnrollmentAction('enroll', s)} disabled={!!actionLoading}>
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
                                                <Badge variant="secondary" className="mt-1 text-[9px] h-4">
                                                    {s.enrolledInSemester}
                                                </Badge>
                                            </div>
                                            <Button size="icon" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setStudentToRemove(s)} disabled={!!actionLoading}>
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

            <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
                <DialogContent className="max-w-3xl h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Notification Template Settings</DialogTitle>
                        <DialogDescription>Define the default messages sent automatically when students are enrolled or removed from a class.</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto py-4 pr-2">
                        <Accordion type="multiple" defaultValue={['enrollment', 'removal']} className="w-full">
                            <AccordionItem value="enrollment">
                                <AccordionTrigger className="font-bold">Enrollment Email Template</AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-2">
                                    <div className="space-y-1">
                                        <Label>Subject Line</Label>
                                        <Input value={enrollmentTemplate.subject} onChange={e => setEnrollmentTemplate(p => ({...p, subject: e.target.value}))}/>
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Body Content (HTML Supported)</Label>
                                        <Textarea rows={10} value={enrollmentTemplate.body} onChange={e => setEnrollmentTemplate(p => ({...p, body: e.target.value}))} className="font-mono text-xs"/>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="removal">
                                <AccordionTrigger className="font-bold">Removal Email Template</AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-2">
                                    <div className="space-y-1">
                                        <Label>Subject Line</Label>
                                        <Input value={removalTemplate.subject} onChange={e => setRemovalTemplate(p => ({...p, subject: e.target.value}))}/>
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Body Content (HTML Supported)</Label>
                                        <Textarea rows={10} value={removalTemplate.body} onChange={e => setRemovalTemplate(p => ({...p, body: e.target.value}))} className="font-mono text-xs"/>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                        <Alert className="mt-6 bg-muted/50 border-dashed">
                            <Info className="h-4 w-4" />
                            <AlertTitle>Dynamic Placeholders</AlertTitle>
                            <AlertDescription>
                                <p className="text-xs">Use the following tags to insert student/class details: <code className="bg-background px-1 rounded">[Name]</code>, <code className="bg-background px-1 rounded">[UserID]</code>, <code className="bg-background px-1 rounded">[CourseName]</code>, <code className="bg-background px-1 rounded">[CourseCode]</code>, <code className="bg-background px-1 rounded">[Day]</code>, <code className="bg-background px-1 rounded">[Time]</code>.</p>
                            </AlertDescription>
                        </Alert>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setIsConfigOpen(false)}>Close & Apply Settings</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!studentToRemove} onOpenChange={(open) => !open && setStudentToRemove(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Student from Class?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove <strong>{studentToRemove?.name}</strong> from <strong>{activeSession?.courseName}</strong>? A notification email will be sent automatically based on your template.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => studentToRemove && performEnrollmentAction('remove', studentToRemove)}
                        >
                            Proceed
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
