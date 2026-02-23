"use client";
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth, getRegistrarIds, createNotification } from '@/lib/firebase';
import { ref, get, onValue, push, serverTimestamp } from 'firebase/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Info, MapPin, UserCheck, Users, CalendarDays, Layers, ChevronLeft, ChevronRight, Video, Clock, PlusCircle, CheckCircle2, Loader2, BookCopy, FileCheck, Download, Calendar as CalendarIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { format, parseISO, startOfWeek, addWeeks, subWeeks, getDay, isToday } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type TimeSlot = {
    id: string;
    startTime: string;
    endTime: string;
};

type TimetableEntry = {
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
    examDate?: string;
    examTime?: string;
    examVenue?: string;
};

const calendarDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const timeToMinutes = (time: string) => {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

export default function StudentTimetablePage() {
    const { user, userProfile, loading: authLoading } = useAuth();
    const [timetable, setTimetable] = React.useState<TimetableEntry[]>([]);
    const [teachingTimes, setTeachingTimes] = React.useState<{ days: string[], slots: TimeSlot[] }>({ days: calendarDays.slice(1, 6), slots: [] });
    const [loading, setLoading] = React.useState(true);
    const [viewWeek, setViewWeek] = React.useState(new Date());
    const [academicStanding, setAcademicStanding] = React.useState<string>('');
    const [currentSemesterId, setCurrentSemesterId] = React.useState<string | null>(null);
    
    // Enrollment Request State
    const [isRequestOpen, setIsRequestOpen] = React.useState(false);
    const [availablePathCourses, setAvailablePathCourses] = React.useState<{id: string, name: string, code: string}[]>([]);
    const [selectedRequestCourse, setSelectedRequestCourse] = React.useState('');
    const [submittingRequest, setSubmittingRequest] = React.useState(false);

    const { toast } = useToast();

    const fetchData = React.useCallback(async () => {
        if (!user?.uid || !userProfile) return;
        setLoading(true);
        try {
            const [regsSnap, coursesSnap, timetablesSnap, settingsSnap, usersSnap, semestersSnap, intakesSnap, calendarSnap, pathSnap] = await Promise.all([
                get(ref(db, `registrations/${user.uid}`)),
                get(ref(db, 'courses')),
                get(ref(db, 'timetables')),
                get(ref(db, 'settings/teachingTimes')),
                get(ref(db, 'users')),
                get(ref(db, 'semesters')),
                get(ref(db, 'intakes')),
                get(ref(db, 'settings/academicCalendar')),
                get(ref(db, 'coursePaths'))
            ]);

            const allSemesters = semestersSnap.val() || {};
            const allIntakes = intakesSnap.val() || {};
            const calSettings = calendarSnap.val() || {};
            const studentIntake = userProfile.intakeId ? allIntakes[userProfile.intakeId] : null;
            const studentIntakeName = studentIntake?.name?.trim().toUpperCase();

            if (!studentIntake || !calSettings) {
                setTimetable([]);
                setLoading(false);
                return;
            }

            const intakeStartStr = parseIntakeDate(studentIntake.name);
            if (!intakeStartStr) {
                setTimetable([]);
                setLoading(false);
                return;
            }

            const state = calculateAcademicState(
                intakeStartStr, 
                new Date(), 
                calSettings.standardCycles, 
                Object.values(calSettings.anomalies || {})
            );
            
            const currentYear = state.year;
            const currentSemesterInYear = state.semester;
            setAcademicStanding(`Year ${currentYear}, Sem ${currentSemesterInYear}`);

            const matchingSemesterEntry = Object.entries(allSemesters).find(([_, s]: [string, any]) => {
                return s.intakeId === userProfile.intakeId && 
                       s.year === currentYear && 
                       s.semesterInYear === currentSemesterInYear;
            });
            
            const matchingSemId = matchingSemesterEntry ? matchingSemesterEntry[0] : null;
            setCurrentSemesterId(matchingSemId);

            if (!matchingSemId) {
                setTimetable([]);
                setLoading(false);
                return;
            }

            // Identify enrolled courses
            const enrolledCourseIds = new Set<string>();
            const userRegs = regsSnap.val() || {};
            const currentReg = userRegs[matchingSemId];
            
            if (currentReg && (currentReg.status === 'Completed' || currentReg.status === 'Pending Payment' || currentReg.status === 'Pending Approval')) {
                const coursesArr = Array.isArray(currentReg.courses) ? currentReg.courses : Object.keys(currentReg.courses || {});
                coursesArr.forEach((cid: string) => enrolledCourseIds.add(cid));
            }

            const cData = coursesSnap.val() || {};
            const tData = timetablesSnap.val() || {};
            const settingsData = settingsSnap.val() || {};
            const usersData = usersSnap.val() || {};

            setTeachingTimes({
                days: settingsData.days || calendarDays.slice(1, 6),
                slots: (settingsData.slots || []).sort((a: TimeSlot, b: TimeSlot) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
            });

            // Fetch available courses for this specific standing path for "Request Enrollment"
            const path = Object.values(pathSnap.val() || {}).find((p: any) => p.intakeId === userProfile.intakeId && p.programmeId === userProfile.programmeId) as any;
            if (path?.semesters?.[matchingSemId]) {
                const pathCids = path.semesters[matchingSemId].courses || [];
                setAvailablePathCourses(pathCids.map((id: string) => ({ id, name: cData[id]?.name, code: cData[id]?.code })).filter((c: any) => c.name && !enrolledCourseIds.has(c.id)));
            }

            const sessionMap = new Map<string, TimetableEntry>();
            const relevantSemesterNodes = ['master', matchingSemId];

            relevantSemesterNodes.forEach(semId => {
                const isMaster = semId === 'master';
                const semesterSessions = tData[semId];
                if (!semesterSessions) return;

                for (const cid in semesterSessions) {
                    if (!enrolledCourseIds.has(cid)) continue;

                    const courseInfo = cData[cid];
                    if (!courseInfo) continue;

                    const entries = Object.values(semesterSessions[cid]) as any[];
                    entries.forEach(entry => {
                        let shouldInclude = false;
                        const entryIntake = entry.intakeName?.trim().toUpperCase();
                        const studentIntakeNameRef = studentIntakeName;

                        if (isMaster) {
                            shouldInclude = (studentIntakeNameRef && entryIntake === studentIntakeNameRef) || (entryIntake === 'MASTER');
                        } else {
                            shouldInclude = true;
                        }

                        if (shouldInclude) {
                            const sessionKey = `${cid}-${entry.day}-${entry.startTime}`;
                            const existing = sessionMap.get(sessionKey);

                            if (!existing || (semId !== 'master' && existing.semesterId === 'master')) {
                                const lecturerNames = (courseInfo.lecturerIds || [])
                                    .map((uid: string) => usersData[uid]?.name)
                                    .filter(Boolean)
                                    .join(', ') || usersData[courseInfo.lecturerId]?.name || 'Unassigned';

                                sessionMap.set(sessionKey, {
                                    ...entry,
                                    courseId: cid,
                                    courseCode: courseInfo.code,
                                    courseName: courseInfo.name,
                                    semesterId: semId,
                                    semesterName: allSemesters[semId]?.name || 'Current Standing',
                                    lecturerNames,
                                    studentCount: 0 
                                });
                            }
                        }
                    });
                }
            });

            setTimetable(Array.from(sessionMap.values()));
        } catch (error) {
            console.error("Timetable logic error:", error);
        } finally {
            setLoading(false);
        }
    }, [user, userProfile]);

    React.useEffect(() => {
        if (!authLoading && user && userProfile) fetchData();
    }, [user, userProfile, authLoading, fetchData]);

    const handleRequestEnrollment = async () => {
        if (!selectedRequestCourse || !currentSemesterId || !user || !userProfile) return;
        setSubmittingRequest(true);
        try {
            const course = availablePathCourses.find(c => c.id === selectedRequestCourse);
            const requestRef = push(ref(db, 'classEnrollmentRequests'));
            await set(requestRef, {
                userId: user.uid,
                studentId: userProfile.id,
                studentName: userProfile.name,
                courseId: selectedRequestCourse,
                courseCode: course?.code,
                courseName: course?.name,
                semesterId: currentSemesterId,
                status: 'Pending',
                timestamp: serverTimestamp()
            });

            const registrarIds = await getRegistrarIds();
            if (registrarIds.length > 0) {
                await createNotification(
                    registrarIds,
                    `${userProfile.name} has requested enrollment in ${course?.code}.`,
                    '/admin/approve-registrations'
                );
            }

            toast({ title: "Request Sent", description: "Your enrollment request has been submitted for approval." });
            setIsRequestOpen(false);
            setSelectedRequestCourse('');
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Request Failed" });
        } finally {
            setSubmittingRequest(false);
        }
    };

    const handleDownloadPdf = () => {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(18);
        doc.text(`My Weekly Timetable - ${academicStanding}`, 14, 22);
        doc.setFontSize(10);
        doc.text(`Intake: ${userProfile?.intakeName || 'N/A'}`, 14, 30);
        
        const head = [["Time", ...displayDays]];
        const body = teachingTimes.slots.map(slot => {
            const row = [ `${slot.startTime} - ${slot.endTime}` ];
            displayDays.forEach(day => {
                const sessions = timetable.filter(e => e.day === day && timeToMinutes(e.startTime) >= timeToMinutes(slot.startTime) && timeToMinutes(e.startTime) < timeToMinutes(slot.endTime));
                row.push(sessions.map(s => `${s.courseCode}: ${s.venue}`).join('\n'));
            });
            return row;
        });

        autoTable(doc, {
            head,
            body,
            startY: 40,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [44, 62, 80] },
        });

        doc.save('My_Timetable.pdf');
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
    const displayDays = teachingTimes.days.length > 0 ? teachingTimes.days : calendarDays.slice(1, 6);

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader>
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="font-headline text-2xl flex items-center gap-2"><CalendarDays className="h-6 w-6 text-primary"/> My Active Timetable</CardTitle>
                            <CardDescription>Your personalized schedule for the current session.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleDownloadPdf} disabled={loading || timetable.length === 0}>
                                <Download className="mr-2 h-4 w-4"/> Download PDF
                            </Button>
                            <Button onClick={() => setIsRequestOpen(true)} disabled={loading || availablePathCourses.length === 0} className="shadow-md">
                                <PlusCircle className="mr-2 h-4 w-4"/> Request Class Enrollment
                            </Button>
                        </div>
                    </div>
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
                {academicStanding && (
                    <Badge variant="secondary" className="gap-1.5 font-black uppercase tracking-widest text-[10px]">
                        <Clock className="h-3 w-3" />
                        {academicStanding}
                    </Badge>
                )}
            </div>

            <Card className="shadow-lg">
                <CardContent className="overflow-x-auto pt-6">
                    {loading ? (
                        <Skeleton className="h-96 w-full" />
                    ) : !hasSlots ? (
                        <Alert variant="secondary"><Info className="h-4 w-4" /><AlertTitle>Matrix View Unavailable</AlertTitle><AlertDescription>Institutional time slots have not been defined.</AlertDescription></Alert>
                    ) : timetable.length === 0 ? (
                        <div className="py-20 text-center text-muted-foreground border-2 border-dashed rounded-xl bg-muted/5">
                            <CalendarDays className="mx-auto h-12 w-12 opacity-20 mb-4" />
                            <h3 className="text-lg font-bold">No Classes Found</h3>
                            <p className="text-sm max-w-xs mx-auto">No enrolled courses scheduled for your current academic standing.</p>
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-hidden bg-muted/10 min-w-[800px] shadow-inner">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50 border-b">
                                        <TableHead className="w-32 border-r font-bold text-center">DATE & DAY</TableHead>
                                        {teachingTimes.slots.map((slot, index) => (<TableHead key={index} className="text-center font-bold border-r text-xs">{slot.startTime} - {slot.endTime}</TableHead>))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {currentWeekInterval.map(date => {
                                        const dayName = calendarDays[getDay(date)];
                                        const isDayToday = isToday(date);
                                        const dateStr = format(date, 'yyyy-MM-dd');
                                        if (!displayDays.includes(dayName)) return null;

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
                                                    const sessionsInSlot = timetable.filter(e => e.day === dayName && timeToMinutes(e.startTime) >= slotStart && timeToMinutes(e.startTime) < slotEnd);

                                                    return (
                                                        <TableCell key={sIdx} className="p-2 border-r align-top min-h-[100px]">
                                                            <div className="space-y-2">
                                                                {sessionsInSlot.map((entry, eIdx) => {
                                                                    const dateRequest = (entry as any).dateRequests?.[dateStr];
                                                                    const isLiveOnThisDate = dateRequest?.status === 'Approved' || entry.isLiveSession;

                                                                    return (
                                                                        <div key={eIdx} className="space-y-1.5">
                                                                            <Link 
                                                                                href={`/student/courses/${entry.courseId}`} 
                                                                                className={cn(
                                                                                    "block p-2 rounded-md border bg-background shadow-sm hover:ring-2 hover:ring-primary transition-all",
                                                                                    isLiveOnThisDate ? "border-blue-500 bg-blue-50/20 shadow-blue-100" : "border-primary/20"
                                                                                )}
                                                                            >
                                                                                <div className="flex justify-between items-start gap-1">
                                                                                    <p className="font-bold text-[10px] text-primary leading-tight line-clamp-2" title={entry.courseName}>{entry.courseCode}: {entry.courseName}</p>
                                                                                    {isLiveOnThisDate ? <Video className="h-3 w-3 text-blue-600" /> : <Layers className="h-3 w-3 text-primary/40" />}
                                                                                </div>
                                                                                <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-1"><MapPin className="h-2.5 w-2.5" /> {isLiveOnThisDate ? "DIGITAL ROOM" : entry.venue}</div>
                                                                                <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-0.5"><UserCheck className="h-2.5 w-2.5" /> {entry.lecturerNames}</div>
                                                                                <div className="mt-2 text-[9px] font-medium opacity-70 italic">{entry.semesterName}</div>
                                                                            </Link>
                                                                            
                                                                            {entry.examDate && (
                                                                                <div className="p-2 rounded-md border-2 border-red-200 bg-red-50 animate-in zoom-in fade-in duration-500 shadow-sm">
                                                                                    <div className="flex items-center gap-1.5 mb-1">
                                                                                        <FileCheck className="h-3 w-3 text-red-600" />
                                                                                        <span className="text-[9px] font-black uppercase text-red-800 tracking-tighter">Final Examination</span>
                                                                                    </div>
                                                                                    <div className="space-y-0.5">
                                                                                        <p className="text-[10px] font-bold text-red-700">{format(parseISO(entry.examDate), 'PPP')}</p>
                                                                                        <p className="text-[9px] text-red-600/80 font-medium">
                                                                                            {entry.examTime ? `${entry.examTime} @ ` : ''}{entry.examVenue || 'TBA'}
                                                                                        </p>
                                                                                    </div>
                                                                                </div>
                                                                            )}
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

            <Dialog open={isRequestOpen} onOpenChange={setIsRequestOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Request Class Enrollment</DialogTitle>
                        <DialogDescription>
                            Select a course from your curriculum roadmap to request manual enrollment for the current semester ({academicStanding}).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-1">
                            <Label>Target Course</Label>
                            <Select value={selectedRequestCourse} onValueChange={setSelectedRequestCourse}>
                                <SelectTrigger><SelectValue placeholder="Select from roadmap..." /></SelectTrigger>
                                <SelectContent>
                                    {availablePathCourses.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.code}: {c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Alert variant="default" className="bg-primary/5 border-primary/20">
                            <Info className="h-4 w-4 text-primary" />
                            <AlertTitle className="text-xs font-bold uppercase tracking-widest text-primary">Process Notice</AlertTitle>
                            <AlertDescription className="text-[10px] leading-relaxed italic">
                                Enrollment requests are reviewed by the Registrar. Approval depends on capacity and financial standing.
                            </AlertDescription>
                        </Alert>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button onClick={handleRequestEnrollment} disabled={submittingRequest || !selectedRequestCourse}>
                            {submittingRequest ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle2 className="mr-2 h-4 w-4"/>}
                            Submit Request
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
