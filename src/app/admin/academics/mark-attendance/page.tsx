'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from '@/components/ui/skeleton';
import { db, createNotification } from '@/lib/firebase';
import { ref, onValue, get, set, update } from 'firebase/database';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, PlusCircle, CheckCircle, XCircle, Info, Loader2, Save, Calendar as CalendarIcon, Search, LayoutGrid, CalendarDays, ListFilter, UserSearch, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

type Intake = { id: string; name: string; };
type Room = { id: string; name: string; capacity: number; };
type TimeSlot = { id: string; startTime: string; endTime: string; };
type Course = { id: string; name: string; code: string; };
type Student = { uid: string; id: string; name: string; email: string; };

type TimetableEntry = {
    id: string;
    semesterId: string;
    courseId: string;
    courseCode: string;
    courseName: string;
    intakeName: string;
    day: string;
    startTime: string;
    endTime: string;
    venue: string;
};

type AttendanceStatus = "Present" | "Absent" | "Late" | "Excused Absence";
type AttendanceRecord = Record<string, AttendanceStatus>;

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const timeToMinutes = (time: string) => {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

export default function AdminMarkAttendancePage() {
    const [intakes, setIntakes] = React.useState<Intake[]>([]);
    const [teachingTimes, setTeachingTimes] = React.useState<{ days: string[], slots: TimeSlot[] }>({ days: daysOfWeek, slots: [] });
    const [masterTimetable, setMasterTimetable] = React.useState<TimetableEntry[]>([]);
    const [allCourses, setAllCourses] = React.useState<Record<string, Course>>({});
    const [allStudents, setAllStudents] = React.useState<Student[]>([]);
    const [loading, setLoading] = React.useState(true);

    // Filter/View State
    const [selectedIntake, setSelectedIntake] = React.useState<string>('');
    const [viewMode, setViewMode] = React.useState<'marking' | 'weekly' | 'monthly' | 'semester' | 'student'>('marking');
    const [defaultView, setDefaultView] = React.useState('marking');
    
    // Marking Dialog State
    const [activeSession, setActiveSession] = React.useState<TimetableEntry | null>(null);
    const [attendanceDate, setAttendanceDate] = React.useState<Date>(new Date());
    const [studentsInSession, setStudentsInSession] = React.useState<Student[]>([]);
    const [attendance, setAttendance] = React.useState<AttendanceRecord>({});
    const [studentSearch, setStudentSearch] = React.useState('');
    const [saving, setSaving] = React.useState(false);

    // Views Data
    const [courseAttendanceData, setCourseAttendanceData] = React.useState<Record<string, Record<string, AttendanceRecord>>>({});
    const [selectedStudentHistory, setSelectedStudentHistory] = React.useState<string | null>(null);

    const { toast } = useToast();

    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [intakeSnap, settingsSnap, coursesSnap, timetablesSnap, semSnap, usersSnap, attendanceSnap, prefSnap] = await Promise.all([
                get(ref(db, 'intakes')),
                get(ref(db, 'settings/teachingTimes')),
                get(ref(db, 'courses')),
                get(ref(db, 'timetables')),
                get(ref(db, 'semesters')),
                get(ref(db, 'users')),
                get(ref(db, 'attendance')),
                get(ref(db, 'settings/attendancePreferences'))
            ]);

            const iData = intakeSnap.val() || {};
            const sData = settingsSnap.val() || {};
            const cData = coursesSnap.val() || {};
            const tData = timetablesSnap.val() || {};
            const semData = semSnap.val() || {};
            const uData = usersSnap.val() || {};
            const aData = attendanceSnap.val() || {};
            const prefData = prefSnap.val() || { defaultView: 'marking' };

            setIntakes(Object.entries(iData).map(([id, data]: [string, any]) => ({ id, ...data })).sort((a,b) => b.name.localeCompare(a.name)));
            setAllCourses(cData);
            setAllStudents(Object.entries(uData).filter(([_, u]: [string, any]) => u.role === 'Student').map(([uid, u]: [string, any]) => ({ uid, ...u })));
            setTeachingTimes({
                days: sData.days || daysOfWeek,
                slots: (sData.slots || []).sort((a: TimeSlot, b: TimeSlot) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
            });
            setCourseAttendanceData(aData);
            setDefaultView(prefData.defaultView);
            setViewMode(prefData.defaultView);

            const entries: TimetableEntry[] = [];
            for (const semId in tData) {
                const semInfo = semData[semId] || { name: 'Master' };
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
                            intakeName: entry.intakeName || intakeInfo?.name || 'N/A',
                            ...entry
                        });
                    });
                }
            }
            setMasterTimetable(entries);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const fetchSessionStudents = async (session: TimetableEntry) => {
        try {
            const regsSnap = await get(ref(db, 'registrations'));
            const allRegs = regsSnap.val() || {};
            const list: Student[] = [];

            for (const userId in allRegs) {
                const userRegs = allRegs[userId];
                const isEnrolled = Object.values(userRegs).some((reg: any) => {
                    return reg.courses?.includes(session.courseId) && (reg.status === 'Completed' || reg.status === 'Pending Payment');
                });

                if (isEnrolled) {
                    const student = allStudents.find(s => s.uid === userId);
                    if(student) list.push(student);
                }
            }
            setStudentsInSession(list.sort((a,b) => a.name.localeCompare(b.name)));
            
            const dateStr = format(attendanceDate, 'yyyy-MM-dd');
            const attendanceSnap = await get(ref(db, `attendance/${session.courseId}/${dateStr}`));
            if (attendanceSnap.exists()) {
                setAttendance(attendanceSnap.val());
            } else {
                const initial: AttendanceRecord = {};
                list.forEach(s => initial[s.uid] = 'Present');
                setAttendance(initial);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleSaveAttendance = async () => {
        if (!activeSession) return;
        setSaving(true);
        try {
            const dateStr = format(attendanceDate, 'yyyy-MM-dd');
            await set(ref(db, `attendance/${activeSession.courseId}/${dateStr}`), attendance);
            
            const promises = Object.entries(attendance).map(([uid, status]) => {
                if (status === 'Absent' || status === 'Late') {
                    return createNotification(
                        uid,
                        `Attendance Update: You were marked as ${status} for ${activeSession.courseName} on ${format(attendanceDate, 'PPP')}.`,
                        `/student/courses/${activeSession.courseId}/attendance`
                    );
                }
                return Promise.resolve();
            });
            await Promise.all(promises);

            toast({ title: "Attendance Saved", description: `Record for ${format(attendanceDate, 'PPP')} updated.` });
            setActiveSession(null);
            fetchData(); // Refresh overview data
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Save Failed", description: e.message });
        } finally {
            setSaving(false);
        }
    };

    const handleSetDefaultView = async (mode: string) => {
        try {
            await set(ref(db, 'settings/attendancePreferences'), { defaultView: mode });
            setDefaultView(mode);
            toast({ title: 'Default View Updated', description: `Future sessions will start in ${mode} mode.` });
        } catch(e) {
            toast({ variant: 'destructive', title: 'Preference Save Failed' });
        }
    }

    const filteredTimetable = React.useMemo(() => {
        if (!selectedIntake) return [];
        const intakeName = intakes.find(i => i.id === selectedIntake)?.name;
        return masterTimetable.filter(e => e.intakeName === intakeName);
    }, [masterTimetable, selectedIntake, intakes]);

    const filteredMarkingStudents = studentsInSession.filter(s => 
        s.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
        s.id.toLowerCase().includes(studentSearch.toLowerCase())
    );

    const getStudentAttendanceStats = (studentUid: string) => {
        let present = 0, absent = 0, late = 0, excused = 0;
        Object.values(courseAttendanceData).forEach(courseLogs => {
            Object.values(courseLogs).forEach(dayLog => {
                const status = dayLog[studentUid];
                if (status === 'Present') present++;
                else if (status === 'Absent') absent++;
                else if (status === 'Late') late++;
                else if (status === 'Excused Absence') excused++;
            });
        });
        const total = present + absent + late + excused;
        const rate = total > 0 ? ((present + late + excused) / total) * 100 : 100;
        return { present, absent, late, excused, total, rate };
    };

    if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-12 w-1/3"/><Skeleton className="h-96 w-full"/></div>;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Attendance Portal</CardTitle>
                        <CardDescription>Comprehensive attendance tracking and management across all cohorts.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground mr-2 hidden sm:inline">Default View:</Label>
                        <Select value={defaultView} onValueChange={handleSetDefaultView}>
                            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="marking">Mark Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="semester">Semester</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="max-w-md space-y-1">
                        <Label>Filter by Intake Pathway</Label>
                        <Select value={selectedIntake} onValueChange={setSelectedIntake}>
                            <SelectTrigger><SelectValue placeholder="Select intake..." /></SelectTrigger>
                            <SelectContent>{intakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>

                    <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto">
                            <TabsTrigger value="marking" className="py-2"><PlusCircle className="mr-2 h-4 w-4"/>Mark Daily</TabsTrigger>
                            <TabsTrigger value="weekly" className="py-2"><LayoutGrid className="mr-2 h-4 w-4"/>Weekly Grid</TabsTrigger>
                            <TabsTrigger value="monthly" className="py-2"><CalendarIcon className="mr-2 h-4 w-4"/>Monthly Grid</TabsTrigger>
                            <TabsTrigger value="semester" className="py-2"><ListFilter className="mr-2 h-4 w-4"/>Semester Stats</TabsTrigger>
                            <TabsTrigger value="student" className="py-2"><UserSearch className="mr-2 h-4 w-4"/>Student Record</TabsTrigger>
                        </TabsList>

                        <TabsContent value="marking" className="mt-6">
                            {selectedIntake ? (
                                <div className="border rounded-lg overflow-hidden bg-muted/10">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50">
                                                <TableHead className="w-32 border-r font-bold text-center">DAY</TableHead>
                                                {teachingTimes.slots.map((slot, index) => (
                                                    <TableHead key={index} className="text-center font-bold border-r">
                                                        <span className="text-xs">{slot.startTime} - {slot.endTime}</span>
                                                    </TableHead>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {teachingTimes.days.map(dayName => (
                                                <TableRow key={dayName}>
                                                    <TableCell className="font-bold text-xs uppercase tracking-wider text-center border-r bg-muted/20">{dayName}</TableCell>
                                                    {teachingTimes.slots.map((slot, sIdx) => {
                                                        const slotStart = timeToMinutes(slot.startTime);
                                                        const slotEnd = timeToMinutes(slot.endTime);
                                                        const sessions = filteredTimetable.filter(e => e.day === dayName && timeToMinutes(e.startTime) >= slotStart && timeToMinutes(e.startTime) < slotEnd);
                                                        return (
                                                            <TableCell key={sIdx} className="p-2 border-r align-top min-h-[100px]">
                                                                {sessions.map((entry, eIdx) => (
                                                                    <div key={eIdx} className="cursor-pointer group p-2 rounded-md border bg-background hover:bg-primary/5 mb-2 border-primary/20 shadow-sm" onClick={() => { setActiveSession(entry); fetchSessionStudents(entry); }}>
                                                                        <p className="font-bold text-primary text-[10px] leading-tight line-clamp-2">{entry.courseCode}: {entry.courseName}</p>
                                                                        <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-1"><MapPin className="h-2 w-2" /> {entry.venue}</div>
                                                                    </div>
                                                                ))}
                                                            </TableCell>
                                                        );
                                                    })}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="text-center py-20 text-muted-foreground bg-muted/10 rounded-lg border-2 border-dashed">Select an intake to view the marking grid.</div>
                            )}
                        </TabsContent>

                        <TabsContent value="weekly" className="space-y-4 mt-6">
                            <Alert><Info className="h-4 w-4"/><AlertTitle>Weekly Overview</AlertTitle><AlertDescription>This grid displays all classes held this week. You can view patterns of attendance for the intake cohort.</AlertDescription></Alert>
                            <div className="rounded-md border overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead>Student</TableHead>
                                            {displayDays.map(day => <TableHead key={day} className="text-center">{day.substring(0,3)}</TableHead>)}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {allStudents.filter(s => !selectedIntake || s.uid === 'dummy' /* Placeholder for filtered list */).map(student => (
                                            <TableRow key={student.uid}>
                                                <TableCell className="font-medium">{student.name}</TableCell>
                                                {displayDays.map(day => <TableCell key={day} className="text-center"><Badge variant="outline" className="h-4 w-4 rounded-full p-0"/></TableCell>)}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>

                        <TabsContent value="student" className="mt-6 space-y-6">
                            <div className="max-w-md mx-auto space-y-4">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input placeholder="Find student record..." className="pl-8" onChange={e => {
                                        const found = allStudents.find(s => s.name.toLowerCase().includes(e.target.value.toLowerCase()) || s.id.toLowerCase() === e.target.value.toLowerCase());
                                        if(found) setSelectedStudentHistory(found.uid);
                                    }}/>
                                </div>
                            </div>
                            {selectedStudentHistory ? (
                                <div className="grid gap-6 md:grid-cols-2">
                                    <Card className="border-primary/20 shadow-sm">
                                        <CardHeader><CardTitle>Academic Summary</CardTitle></CardHeader>
                                        <CardContent className="space-y-4">
                                            {(() => {
                                                const stats = getStudentAttendanceStats(selectedStudentHistory);
                                                const student = allStudents.find(s => s.uid === selectedStudentHistory);
                                                return (
                                                    <>
                                                        <div className="flex items-center gap-4">
                                                            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl">{student?.name.charAt(0)}</div>
                                                            <div><p className="font-bold text-xl">{student?.name}</p><p className="text-sm text-muted-foreground">{student?.id}</p></div>
                                                        </div>
                                                        <Separator />
                                                        <div className="grid grid-cols-2 gap-4 pt-2">
                                                            <div className="p-2 bg-green-50 rounded border border-green-100"><p className="text-xs font-bold text-green-700">PRESENT</p><p className="text-2xl font-bold">{stats.present}</p></div>
                                                            <div className="p-2 bg-red-50 rounded border border-red-100"><p className="text-xs font-bold text-red-700">ABSENT</p><p className="text-2xl font-bold">{stats.absent}</p></div>
                                                            <div className="p-2 bg-orange-50 rounded border border-orange-100"><p className="text-xs font-bold text-orange-700">LATE</p><p className="text-2xl font-bold">{stats.late}</p></div>
                                                            <div className="p-2 bg-blue-50 rounded border border-blue-100"><p className="text-xs font-bold text-blue-700">TOTAL</p><p className="text-2xl font-bold">{stats.total}</p></div>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between text-sm font-bold"><span>Attendance Reliability</span><span>{stats.rate.toFixed(1)}%</span></div>
                                                            <Progress value={stats.rate} className={cn(stats.rate < 75 ? "bg-red-100 [&>div]:bg-red-600" : "bg-green-100 [&>div]:bg-green-600")} />
                                                        </div>
                                                    </>
                                                )
                                            })()}
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader><CardTitle>Detailed Logs</CardTitle></CardHeader>
                                        <CardContent>
                                            <ScrollArea className="h-[400px] pr-4">
                                                {Object.entries(courseAttendanceData).map(([courseId, dates]) => {
                                                    const course = allCourses[courseId];
                                                    const myLogs = Object.entries(dates).filter(([_, log]) => !!log[selectedStudentHistory!]);
                                                    if(myLogs.length === 0) return null;
                                                    return (
                                                        <div key={courseId} className="mb-6">
                                                            <h4 className="font-bold text-sm mb-2 border-b pb-1 flex justify-between">
                                                                <span>{course?.name}</span>
                                                                <span className="text-[10px] text-muted-foreground">{course?.code}</span>
                                                            </h4>
                                                            <div className="space-y-1">
                                                                {myLogs.map(([date, log]) => (
                                                                    <div key={date} className="flex justify-between items-center text-xs p-1 hover:bg-muted rounded transition-colors">
                                                                        <span>{format(parseISO(date), 'MMM dd, yyyy')}</span>
                                                                        <Badge variant={log[selectedStudentHistory!] === 'Present' ? 'default' : 'destructive'} className="text-[9px] h-4">{log[selectedStudentHistory!]}</Badge>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </ScrollArea>
                                        </CardContent>
                                    </Card>
                                </div>
                            ) : (
                                <div className="text-center py-20 text-muted-foreground border border-dashed rounded-lg"><UserSearch className="mx-auto mb-4 h-12 w-12 opacity-20"/><p>Search for a student above to see their detailed attendance history.</p></div>
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <Dialog open={!!activeSession} onOpenChange={(o) => !o && setActiveSession(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Mark Attendance: {activeSession?.courseName}</DialogTitle>
                        <DialogDescription>{activeSession?.courseCode} &middot; {activeSession?.intakeName}</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 py-4 flex-1 overflow-hidden">
                        <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
                            <div className="flex items-center gap-4">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Class Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-[200px] justify-start text-left font-normal h-9">
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {format(attendanceDate, 'PPP')}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar 
                                            mode="single" 
                                            selected={attendanceDate} 
                                            onSelect={(d) => { if(d) { setAttendanceDate(d); if(activeSession) fetchSessionStudents(activeSession); } }} 
                                            disabled={(date) => date > new Date()} 
                                            initialFocus 
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Search roster..." className="pl-8 h-9" value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
                            </div>
                        </div>

                        <div className="flex items-center justify-around bg-muted/20 p-2 rounded-lg border text-xs font-bold">
                            <div className="flex items-center gap-1 text-green-600"><CheckCircle className="h-3.5 w-3.5" /> Present: {Object.values(attendance).filter(v => v === 'Present').length}</div>
                            <div className="flex items-center gap-1 text-red-600"><XCircle className="h-3.5 w-3.5" /> Absent: {Object.values(attendance).filter(v => v === 'Absent').length}</div>
                            <div className="flex items-center gap-1 text-orange-500"><Clock className="h-3.5 w-3.5" /> Late: {Object.values(attendance).filter(v => v === 'Late').length}</div>
                        </div>

                        <div className="flex-1 overflow-auto rounded-md border">
                            <Table>
                                <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                                    <TableRow>
                                        <TableHead>Student</TableHead>
                                        <TableHead className="text-right">Attendance Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredMarkingStudents.length > 0 ? filteredMarkingStudents.map((s) => (
                                        <TableRow key={s.uid}>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm">{s.name}</span>
                                                    <span className="text-[10px] font-mono text-muted-foreground uppercase">{s.id}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <RadioGroup 
                                                    value={attendance[s.uid] || 'Present'} 
                                                    onValueChange={(v) => setAttendance(p => ({...p, [s.uid]: v as any}))}
                                                    className="flex justify-end gap-3"
                                                >
                                                    <div className="flex flex-col items-center gap-1">
                                                        <RadioGroupItem value="Present" id={`p-${s.uid}`} className="sr-only" />
                                                        <Label htmlFor={`p-${s.uid}`} className={cn("px-2 py-1 rounded-md text-[10px] font-bold border cursor-pointer transition-all", attendance[s.uid] === 'Present' ? "bg-green-600 text-white border-green-600" : "bg-background hover:bg-muted")}>PRESENT</Label>
                                                    </div>
                                                    <div className="flex flex-col items-center gap-1">
                                                        <RadioGroupItem value="Absent" id={`a-${s.uid}`} className="sr-only" />
                                                        <Label htmlFor={`a-${s.uid}`} className={cn("px-2 py-1 rounded-md text-[10px] font-bold border cursor-pointer transition-all", attendance[s.uid] === 'Absent' ? "bg-red-600 text-white border-red-600" : "bg-background hover:bg-muted")}>ABSENT</Label>
                                                    </div>
                                                    <div className="flex flex-col items-center gap-1">
                                                        <RadioGroupItem value="Late" id={`l-${s.uid}`} className="sr-only" />
                                                        <Label htmlFor={`l-${s.uid}`} className={cn("px-2 py-1 rounded-md text-[10px] font-bold border cursor-pointer transition-all", attendance[s.uid] === 'Late' ? "bg-orange-500 text-white border-orange-500" : "bg-background hover:bg-muted")}>LATE</Label>
                                                    </div>
                                                    <div className="flex flex-col items-center gap-1">
                                                        <RadioGroupItem value="Excused Absence" id={`e-${s.uid}`} className="sr-only" />
                                                        <Label htmlFor={`e-${s.uid}`} className={cn("px-2 py-1 rounded-md text-[10px] font-bold border cursor-pointer transition-all", attendance[s.uid] === 'Excused Absence' ? "bg-blue-500 text-white border-blue-500" : "bg-background hover:bg-muted")}>EXCUSED</Label>
                                                    </div>
                                                </RadioGroup>
                                            </TableCell>
                                        </TableRow>
                                    )) : <TableRow><TableCell colSpan={2} className="text-center h-32 text-muted-foreground italic">No students match the search filter.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                    <DialogFooter className="border-t pt-4">
                        <DialogClose asChild><Button variant="outline">Discard</Button></DialogClose>
                        <Button onClick={handleSaveAttendance} disabled={saving || studentsInSession.length === 0} className="font-bold">
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                            Save Attendance Data
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
