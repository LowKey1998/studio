'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { db, createNotification } from '@/lib/firebase';
import { ref, get, set, remove, onValue } from 'firebase/database';
import { Loader2, Save, Mail, UserCheck, Shield, BookCheck, ClipboardCheck, Info, Search, Settings, MapPin, CalendarDays, CheckCircle, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';
import { sendEmail } from '@/ai/flows/send-email-flow';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type Intake = { id: string; name: string; };
type Semester = { id: string; name: string; status: 'Open' | 'Closed' | 'Archived'; intakeId: string; year: number; semesterInYear: number; };
type Course = { id: string; name: string; code: string; separateInstance?: boolean; };
type Student = { uid: string; id: string; name: string; email: string; intakeId?: string; };
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

type MarkerSettings = {
    enabled: boolean;
    exactDayOnly: boolean;
    assignedAt: number;
    assignedBy: string;
};

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const timeToMinutes = (time: string) => {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

export default function AssignAttendanceMarkerPage() {
    const [intakes, setIntakes] = React.useState<Intake[]>([]);
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [courses, setCourses] = React.useState<Course[]>([]);
    const [allStudents, setAllStudents] = React.useState<Student[]>([]);
    const [teachingTimes, setTeachingTimes] = React.useState<{ days: string[], slots: TimeSlot[] }>({ days: daysOfWeek, slots: [] });
    const [masterTimetable, setMasterTimetable] = React.useState<TimetableEntry[]>([]);
    const [calendarSettings, setCalendarSettings] = React.useState<any>(null);
    const [attendanceMarkers, setAttendanceMarkers] = React.useState<Record<string, Record<string, MarkerSettings>>>({});
    const [registrations, setRegistrations] = React.useState<any>({});
    const [loading, setLoading] = React.useState(true);

    const [selectedIntake, setSelectedIntake] = React.useState('');
    const [selectedSession, setSelectedSession] = React.useState<TimetableEntry | null>(null);
    const [studentSearch, setStudentSearch] = React.useState('');
    const [showMarkersOnly, setShowMarkersOnly] = React.useState(false);

    // Email Template Modal
    const [isTemplateModalOpen, setIsTemplateModalOpen] = React.useState(false);
    const [savingTemplate, setSavingTemplate] = React.useState(false);
    const [emailTemplate, setEmailTemplate] = React.useState({
        subject: 'Attendance Marker Assignment: [CourseName]',
        body: `<h2>Attendance Marker Privilege Assigned</h2>\n<p>Hello <strong>[Name]</strong>,</p>\n<p>You have been assigned as the attendance marker for the class <strong>[CourseName] ([CourseCode])</strong>.</p>\n<p><strong>Privilege Details:</strong></p>\n<ul>\n  <li><strong>Mark on exact class day only:</strong> [ExactDayOnlyText]</li>\n</ul>\n<p>Please log in to your student portal and navigate to <strong>Academics -> Mark Attendance</strong> to view your roster and record attendance for this class.</p>\n<p>Best regards,<br/>The Academics Department</p>`
    });

    const [actionLoading, setActionLoading] = React.useState<string | null>(null);
    const { toast } = useToast();

    React.useEffect(() => {
        setLoading(true);
        const dataRefs = {
            intakes: ref(db, 'intakes'),
            semesters: ref(db, 'semesters'),
            courses: ref(db, 'courses'),
            users: ref(db, 'users'),
            teachingTimes: ref(db, 'settings/teachingTimes'),
            timetables: ref(db, 'timetables'),
            calendar: ref(db, 'settings/academicCalendar'),
            markers: ref(db, 'settings/attendanceMarkers'),
            template: ref(db, 'settings/emailTemplates/attendanceMarker'),
            registrations: ref(db, 'registrations')
        };

        const unsubMarkers = onValue(dataRefs.markers, (snap) => {
            if (snap.exists()) {
                setAttendanceMarkers(snap.val());
            } else {
                setAttendanceMarkers({});
            }
        });

        const loadStaticData = async () => {
            try {
                const [intakeSnap, semSnap, coursesSnap, usersSnap, teachingSnap, timetablesSnap, calSnap, tplSnap, regsSnap] = await Promise.all([
                    get(dataRefs.intakes),
                    get(dataRefs.semesters),
                    get(dataRefs.courses),
                    get(dataRefs.users),
                    get(dataRefs.teachingTimes),
                    get(dataRefs.timetables),
                    get(dataRefs.calendar),
                    get(dataRefs.template),
                    get(dataRefs.registrations)
                ]);

                if (intakeSnap.exists()) {
                    setIntakes(Object.entries(intakeSnap.val()).map(([id, data]: [string, any]) => ({ id, ...data })));
                }
                if (semSnap.exists()) {
                    setSemesters(Object.entries(semSnap.val()).map(([id, data]: [string, any]) => ({ id, ...data })));
                }
                if (coursesSnap.exists()) {
                    setCourses(Object.entries(coursesSnap.val()).map(([id, data]: [string, any]) => ({ id, ...data })));
                }
                if (usersSnap.exists()) {
                    setAllStudents(
                        Object.entries(usersSnap.val())
                            .filter(([_, u]: [string, any]) => u.role === 'Student')
                            .map(([uid, u]: [string, any]) => ({ uid, ...u }))
                    );
                }
                if (teachingSnap.exists()) {
                    const tSnapVal = teachingSnap.val() || {};
                    setTeachingTimes({
                        days: tSnapVal.days || daysOfWeek,
                        slots: (tSnapVal.slots || []).sort((a: TimeSlot, b: TimeSlot) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
                    });
                }
                if (calSnap.exists()) {
                    setCalendarSettings(calSnap.val());
                }
                if (tplSnap.exists()) {
                    setEmailTemplate(tplSnap.val());
                }
                if (regsSnap.exists()) {
                    setRegistrations(regsSnap.val());
                }

                // Compile master timetable
                const entries: TimetableEntry[] = [];
                const tData = timetablesSnap.val() || {};
                const sData = semSnap.val() || {};
                const cData = coursesSnap.val() || {};
                const iData = intakeSnap.val() || {};

                for (const semId in tData) {
                    const semInfo = sData[semId] || { name: semId === 'master' ? 'Master Schedule' : 'Manual Entry' };
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

            } catch (err) {
                console.error("Error loading data:", err);
                toast({ variant: 'destructive', title: 'Data Load Failed' });
            } finally {
                setLoading(false);
            }
        };

        loadStaticData();

        return () => {
            unsubMarkers();
        };
    }, [toast]);

    // Calculate current standing for selected Intake
    const intakeStanding = React.useMemo(() => {
        if (!selectedIntake || !calendarSettings) return null;
        const intake = intakes.find(i => i.id === selectedIntake);
        if (!intake) return null;
        const intakeStartStr = parseIntakeDate(intake.name);
        if (!intakeStartStr) return null;
        return calculateAcademicState(
            intakeStartStr,
            new Date(),
            calendarSettings.standardCycles,
            Object.values(calendarSettings.anomalies || {})
        );
    }, [selectedIntake, intakes, calendarSettings]);

    // Find active semester matching intake standing
    const activeSemester = React.useMemo(() => {
        if (!selectedIntake || !intakeStanding) return null;
        return semesters.find(s =>
            s.intakeId === selectedIntake &&
            s.year === intakeStanding.year &&
            s.semesterInYear === intakeStanding.semester
        );
    }, [selectedIntake, intakeStanding, semesters]);

    // Filter students enrolled in the selected course for the active semester
    const enrolledStudents = React.useMemo(() => {
        if (!activeSemester || !selectedSession) return [];
        const list: Student[] = [];

        for (const userId in registrations) {
            const userRegs = registrations[userId];
            const activeReg = userRegs[activeSemester.id];
            if (activeReg && activeReg.courses) {
                const coursesList = Array.isArray(activeReg.courses)
                    ? activeReg.courses
                    : Object.keys(activeReg.courses);

                if (coursesList.includes(selectedSession.courseId) && (activeReg.status === 'Completed' || activeReg.status === 'Pending Payment')) {
                    const student = allStudents.find(s => s.uid === userId);
                    if (student) {
                        list.push(student);
                    }
                }
            }
        }
        return list.sort((a, b) => a.name.localeCompare(b.name));
    }, [activeSemester, selectedSession, registrations, allStudents]);

    // Format marker settings path key matching student side pathing
    const pathKey = React.useMemo(() => {
        if (!selectedSession || !activeSemester) return '';
        const courseObj = courses.find(c => c.id === selectedSession.courseId);
        return (courseObj?.separateInstance && activeSemester)
            ? `${selectedSession.courseId}_${activeSemester.id}`
            : selectedSession.courseId;
    }, [selectedSession, activeSemester, courses]);

    // Filter enrolled students by search and marker toggle
    const filteredStudents = React.useMemo(() => {
        return enrolledStudents.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
                s.id.toLowerCase().includes(studentSearch.toLowerCase());
            if (!matchesSearch) return false;

            if (showMarkersOnly) {
                const settings = attendanceMarkers[pathKey]?.[s.uid];
                return !!settings?.enabled;
            }
            return true;
        });
    }, [enrolledStudents, studentSearch, showMarkersOnly, attendanceMarkers, pathKey]);

    // Save Email Template
    const handleSaveTemplate = async () => {
        setSavingTemplate(true);
        try {
            await set(ref(db, 'settings/emailTemplates/attendanceMarker'), emailTemplate);
            toast({ title: 'Template Saved Successfully' });
            setIsTemplateModalOpen(false);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
        } finally {
            setSavingTemplate(false);
        }
    };

    // Toggle Attendance Marker Privilege
    const handleTogglePrivilege = async (student: Student, isChecked: boolean) => {
        if (!pathKey || !selectedSession || !activeSemester) return;

        setActionLoading(student.uid);
        try {
            const markerRef = ref(db, `settings/attendanceMarkers/${pathKey}/${student.uid}`);
            const courseObj = courses.find(c => c.id === selectedSession.courseId);

            if (isChecked) {
                // Grant privilege
                const markerData: MarkerSettings = {
                    enabled: true,
                    exactDayOnly: true, // Default to true
                    assignedAt: Date.now(),
                    assignedBy: 'Admin'
                };
                await set(markerRef, markerData);

                // Create dashboard notification
                await createNotification(
                    student.uid,
                    `You have been assigned as the attendance marker for the class ${courseObj?.name || 'Class'}.`,
                    `/student/attendance/mark-attendance`
                );

                // Send Email Notification
                if (student.email) {
                    const replaceTags = (text: string) => {
                        return text
                            .replace(/\[Name\]/g, student.name)
                            .replace(/\[CourseName\]/g, courseObj?.name || '')
                            .replace(/\[CourseCode\]/g, courseObj?.code || '')
                            .replace(/\[ExactDayOnlyText\]/g, 'Yes (Only allowed to mark on exact scheduled class days)');
                    };

                    await sendEmail({
                        to: [student.email],
                        subject: replaceTags(emailTemplate.subject),
                        body: replaceTags(emailTemplate.body)
                    }).catch(err => console.warn("Email send failed:", err));
                }

                toast({ title: 'Privilege Granted', description: `${student.name} is now an attendance marker.` });
            } else {
                // Revoke privilege
                await remove(markerRef);
                toast({ title: 'Privilege Revoked', description: `Removed attendance marking privilege from ${student.name}.` });
            }
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Operation Failed', description: err.message });
        } finally {
            setActionLoading(null);
        }
    };

    // Toggle Exact Day Only Restriction
    const handleToggleExactDay = async (student: Student, isChecked: boolean) => {
        if (!pathKey) return;

        setActionLoading(student.uid + '_day');
        try {
            const exactDayRef = ref(db, `settings/attendanceMarkers/${pathKey}/${student.uid}/exactDayOnly`);
            await set(exactDayRef, isChecked);
            toast({ title: 'Preference Updated', description: `Exact day marking set to ${isChecked ? 'Enabled' : 'Disabled'}.` });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: err.message });
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-12 w-1/3" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    const displayDays = teachingTimes.days.length > 0 ? teachingTimes.days : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const hasSlots = teachingTimes.slots.length > 0;

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-t-4 border-t-primary">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-2xl font-headline font-bold">Assign Attendance Marker</CardTitle>
                        <CardDescription>Select a class from the cohort schedule below to assign student markers.</CardDescription>
                    </div>
                    <Button variant="outline" onClick={() => setIsTemplateModalOpen(true)}>
                        <Settings className="mr-2 h-4 w-4" /> Email Settings
                    </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="max-w-md space-y-2">
                        <Label htmlFor="intake-select">Select Pathway / Intake</Label>
                        <div className="flex items-center gap-4">
                            <Select value={selectedIntake} onValueChange={setSelectedIntake}>
                                <SelectTrigger id="intake-select" className="w-[240px]">
                                    <SelectValue placeholder="Choose Intake..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {intakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            {selectedIntake && intakeStanding && (
                                <Badge variant="secondary" className="px-3 py-1 font-bold whitespace-nowrap h-10 border-primary/20 bg-primary/5 text-primary">
                                    Standing: Year {intakeStanding.year}, Sem {intakeStanding.semester}
                                </Badge>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {selectedIntake && !activeSemester && (
                <Alert variant="destructive" className="bg-orange-50 border-orange-200">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <AlertTitle className="font-bold text-orange-800">No Active Semester</AlertTitle>
                    <AlertDescription className="text-orange-700 text-sm">
                        No active semester record found for <strong>{intakes.find(i => i.id === selectedIntake)?.name}</strong> at <strong>Year {intakeStanding?.year}, Sem {intakeStanding?.semester}</strong>.
                        Please create this semester in <Link href="/admin/registration-management" className="underline font-bold">Registration Management</Link> first.
                    </AlertDescription>
                </Alert>
            )}

            {selectedIntake && hasSlots && activeSemester && (
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-lg font-headline">Schedule Grid: {activeSemester.name}</CardTitle>
                        <CardDescription>Click on a session to select attendance markers for that course.</CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                        <div className="border rounded-lg min-w-[800px]">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="w-32 border-r font-bold text-center">DAY</TableHead>
                                        {teachingTimes.slots.map((s, i) => (
                                            <TableHead key={i} className="text-center font-bold border-r text-xs">
                                                {s.startTime}-{s.endTime}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {displayDays.map(day => (
                                        <TableRow key={day}>
                                            <TableCell className="font-bold text-xs uppercase text-center border-r bg-muted/20">
                                                {day}
                                            </TableCell>
                                            {teachingTimes.slots.map((slot, sIdx) => {
                                                const start = timeToMinutes(slot.startTime);
                                                const end = timeToMinutes(slot.endTime);
                                                const sessions = masterTimetable.filter(e =>
                                                    e.semesterId === activeSemester.id &&
                                                    e.day === day &&
                                                    timeToMinutes(e.startTime) >= start &&
                                                    timeToMinutes(e.startTime) < end
                                                );

                                                // Deduplicate sessions that might be repeated across semester nodes
                                                const uniqueSessions = sessions.reduce((acc, current) => {
                                                    const key = `${current.courseId}-${current.day}-${current.startTime}-${current.venue}`;
                                                    if (!acc.find(item => `${item.courseId}-${item.day}-${item.startTime}-${item.venue}` === key)) {
                                                        acc.push(current);
                                                    }
                                                    return acc;
                                                }, [] as TimetableEntry[]);

                                                return (
                                                    <TableCell key={sIdx} className="p-2 border-r align-top min-h-[100px]">
                                                        {uniqueSessions.map(entry => {
                                                            const courseObj = courses.find(c => c.id === entry.courseId);
                                                            const compositeKey = `${entry.semesterId}-${entry.courseId}-${entry.id}`;

                                                            const currentMarkerKey = (courseObj?.separateInstance) ? `${entry.courseId}_${activeSemester.id}` : entry.courseId;
                                                            const markersList = attendanceMarkers[currentMarkerKey] || {};
                                                            const markersCount = Object.values(markersList).filter(m => m.enabled).length;

                                                            return (
                                                                <div
                                                                    key={compositeKey}
                                                                    className={cn(
                                                                        "cursor-pointer p-2.5 rounded-md border border-primary/20 bg-background hover:bg-primary/5 transition-all mb-2 shadow-sm relative",
                                                                        selectedSession?.id === entry.id && "ring-2 ring-primary"
                                                                    )}
                                                                    onClick={() => {
                                                                        setSelectedSession(entry);
                                                                        setStudentSearch('');
                                                                    }}
                                                                >
                                                                    <p className="font-bold text-[10px] text-primary leading-tight line-clamp-2" title={entry.courseName}>
                                                                        {entry.courseCode}: {entry.courseName}
                                                                    </p>
                                                                    <p className="text-[9px] text-muted-foreground mt-1 flex items-center gap-1">
                                                                        <MapPin className="h-2.5 w-2.5" /> {entry.venue}
                                                                    </p>
                                                                    {markersCount > 0 ? (
                                                                        <Badge className="text-[8px] h-3.5 px-1 mt-1.5 bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
                                                                            {markersCount} Marker{markersCount > 1 ? 's' : ''}
                                                                        </Badge>
                                                                    ) : (
                                                                        <Badge variant="outline" className="text-[8px] h-3.5 px-1 mt-1.5 text-muted-foreground hover:bg-transparent">
                                                                            No Markers
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
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

            {/* Attendance Marker Assignment Dialog */}
            <Dialog open={!!selectedSession} onOpenChange={(o) => !o && setSelectedSession(null)}>
                <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Assign Markers: {selectedSession?.courseName}</DialogTitle>
                        <DialogDescription>{selectedSession?.courseCode} &middot; {selectedSession?.day} {selectedSession?.startTime} &middot; {selectedSession?.venue}</DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-hidden py-4 flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
                            <div className="relative w-full sm:w-80">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search enrolled student roster..."
                                    className="pl-8"
                                    value={studentSearch}
                                    onChange={e => setStudentSearch(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 bg-muted/20">
                                <Switch
                                    id="show-markers-toggle"
                                    checked={showMarkersOnly}
                                    onCheckedChange={setShowMarkersOnly}
                                />
                                <Label htmlFor="show-markers-toggle" className="text-xs font-bold cursor-pointer">
                                    Show assigned markers only
                                </Label>
                            </div>
                        </div>

                        {filteredStudents.length > 0 ? (
                            <div className="border rounded-lg overflow-y-auto flex-1 bg-card">
                                <Table>
                                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                        <TableRow>
                                            <TableHead className="w-[120px]">Student ID</TableHead>
                                            <TableHead>Student Name</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead className="text-center w-[180px]">Attendance Marker</TableHead>
                                            <TableHead className="text-center w-[180px]">Exact Day Only</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredStudents.map((student) => {
                                            const settings = attendanceMarkers[pathKey]?.[student.uid];
                                            const isMarker = !!settings?.enabled;
                                            const isExactDayOnly = settings?.exactDayOnly !== false;

                                            return (
                                                <TableRow key={student.uid}>
                                                    <TableCell className="font-mono text-xs uppercase">{student.id}</TableCell>
                                                    <TableCell className="font-semibold">{student.name}</TableCell>
                                                    <TableCell className="text-muted-foreground text-sm">{student.email}</TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex justify-center items-center">
                                                            {actionLoading === student.uid ? (
                                                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                            ) : (
                                                                <Switch
                                                                    checked={isMarker}
                                                                    onCheckedChange={(checked) => handleTogglePrivilege(student, checked)}
                                                                />
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex justify-center items-center">
                                                            {actionLoading === student.uid + '_day' ? (
                                                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                            ) : (
                                                                <Switch
                                                                    disabled={!isMarker}
                                                                    checked={isExactDayOnly}
                                                                    onCheckedChange={(checked) => handleToggleExactDay(student, checked)}
                                                                />
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <div className="text-center py-16 border-2 border-dashed rounded-lg bg-muted/10 flex flex-col justify-center items-center flex-1">
                                <Info className="h-8 w-8 text-muted-foreground opacity-30 mb-2" />
                                <p className="text-sm text-muted-foreground italic">No students found matching the selected class roster.</p>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="border-t pt-4">
                        <Button onClick={() => setSelectedSession(null)}>Done</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Email Template Modal Dialog */}
            <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Email Notification Settings</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <Alert className="bg-primary/5 border-primary/20">
                            <Info className="h-4 w-4 text-primary" />
                            <CardDescription>
                                Customizes the email notification sent to students when they are selected as an attendance marker.
                                Supported placeholders: <code>[Name]</code>, <code>[CourseName]</code>, <code>[CourseCode]</code>, <code>[ExactDayOnlyText]</code>.
                            </CardDescription>
                        </Alert>

                        <div className="space-y-1">
                            <Label htmlFor="tpl-subject">Email Subject</Label>
                            <Input
                                id="tpl-subject"
                                value={emailTemplate.subject}
                                onChange={e => setEmailTemplate(p => ({ ...p, subject: e.target.value }))}
                            />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="tpl-body">Email Body (HTML)</Label>
                            <Textarea
                                id="tpl-body"
                                rows={10}
                                className="font-mono text-xs"
                                value={emailTemplate.body}
                                onChange={e => setEmailTemplate(p => ({ ...p, body: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsTemplateModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveTemplate} disabled={savingTemplate}>
                            {savingTemplate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Settings
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
