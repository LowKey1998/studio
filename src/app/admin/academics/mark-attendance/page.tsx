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
import { Progress } from '@/components/ui/progress';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { MapPin, Clock, PlusCircle, CheckCircle, XCircle, Info, Loader2, Save, Calendar as CalendarIcon, Search, LayoutGrid, CalendarDays, ListFilter, UserSearch, Settings2, ChevronLeft, ChevronRight, Check, User, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, startOfMonth, endOfMonth, parseISO, getDay, addMonths, subMonths, isToday, addWeeks, subWeeks } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

type Intake = { id: string; name: string; };
type TimeSlot = { id: string; startTime: string; endTime: string; };
type Course = { id: string; name: string; code: string; };
type Student = { uid: string; id: string; name: string; email: string; intakeId?: string; };

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
const calendarDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
    const [viewMode, setViewMode] = React.useState<'marking' | 'monthly' | 'semester' | 'student'>('marking');
    const [defaultView, setDefaultView] = React.useState('marking');
    const [viewMonth, setViewMonth] = React.useState(new Date());
    const [viewWeek, setViewWeek] = React.useState(new Date());
    
    // Marking Dialog State
    const [activeSession, setActiveSession] = React.useState<TimetableEntry | null>(null);
    const [attendanceDate, setAttendanceDate] = React.useState<Date>(new Date());
    const [studentsInSession, setStudentsInSession] = React.useState<Student[]>([]);
    const [attendance, setAttendance] = React.useState<AttendanceRecord>({});
    const [studentSearch, setStudentSearch] = React.useState('');
    const [saving, setSaving] = React.useState(false);

    // Views Data
    const [courseAttendanceData, setCourseAttendanceData] = React.useState<Record<string, Record<string, AttendanceRecord>>>({});
    const [allRegistrations, setAllRegistrations] = React.useState<Record<string, Record<string, any>>>({});
    const [selectedStudentHistory, setSelectedStudentHistory] = React.useState<string | null>(null);
    const [studentListSearch, setStudentListSearch] = React.useState('');

    const { toast } = useToast();

    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [intakeSnap, settingsSnap, coursesSnap, timetablesSnap, semSnap, usersSnap, attendanceSnap, prefSnap, registrationsSnap] = await Promise.all([
                get(ref(db, 'intakes')),
                get(ref(db, 'settings/teachingTimes')),
                get(ref(db, 'courses')),
                get(ref(db, 'timetables')),
                get(ref(db, 'semesters')),
                get(ref(db, 'users')),
                get(ref(db, 'attendance')),
                get(ref(db, 'settings/attendancePreferences')),
                get(ref(db, 'registrations'))
            ]);

            const iData = intakeSnap.val() || {};
            const sData = settingsSnap.val() || {};
            const cData = coursesSnap.val() || {};
            const tData = timetablesSnap.val() || {};
            const semData = semSnap.val() || {};
            const uData = usersSnap.val() || {};
            const aData = attendanceSnap.val() || {};
            const prefData = prefSnap.val() || { defaultView: 'marking' };
            const regsData = registrationsSnap.val() || {};

            setIntakes(Object.entries(iData).map(([id, data]: [string, any]) => ({ id, ...data })).sort((a,b) => b.name.localeCompare(a.name)));
            setAllCourses(cData);
            setAllStudents(Object.entries(uData).filter(([_, u]: [string, any]) => u.role === 'Student').map(([uid, u]: [string, any]) => ({ uid, ...u })));
            setTeachingTimes({
                days: sData.days || daysOfWeek,
                slots: (sData.slots || []).sort((a: TimeSlot, b: TimeSlot) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
            });
            setCourseAttendanceData(aData);
            setAllRegistrations(regsData);
            setDefaultView(prefData.defaultView);
            if (!selectedIntake) setViewMode(prefData.defaultView);

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
    }, [selectedIntake]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const fetchSessionStudents = async (session: TimetableEntry, date?: Date) => {
        const targetDate = date || attendanceDate;
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
            
            const dateStr = format(targetDate, 'yyyy-MM-dd');
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
            fetchData(); 
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

    const getSessionAttendanceStats = React.useCallback((session: TimetableEntry, date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const attendanceRecord = courseAttendanceData[session.courseId]?.[dateStr];
        const isMarked = !!attendanceRecord;

        const list: string[] = [];
        for (const userId in allRegistrations) {
            const userRegs = allRegistrations[userId];
            const isEnrolled = Object.values(userRegs).some((reg: any) => {
                return reg.courses?.includes(session.courseId) && (reg.status === 'Completed' || reg.status === 'Pending Payment');
            });

            if (isEnrolled) {
                const studentExists = allStudents.some(s => s.uid === userId);
                if (studentExists) list.push(userId);
            }
        }

        if (!isMarked) {
            return {
                present: 0,
                absent: 0,
                unmarked: list.length,
                total: list.length,
                isMarked: false
            };
        }

        let present = 0;
        let absent = 0;
        let unmarked = 0;

        list.forEach(uid => {
            const status = attendanceRecord[uid];
            if (!status) {
                unmarked++;
            } else if (status === 'Absent') {
                absent++;
            } else {
                present++;
            }
        });

        return {
            present,
            absent,
            unmarked,
            total: list.length,
            isMarked: true
        };
    }, [allRegistrations, allStudents, courseAttendanceData]);

    const semesterStats = React.useMemo(() => {
        if (!selectedIntake) return [];
        
        return allStudents.filter(s => s.intakeId === selectedIntake).map(student => {
            const stats = getStudentAttendanceStats(student.uid);
            return { ...student, ...stats };
        }).sort((a, b) => a.rate - b.rate);
    }, [selectedIntake, allStudents, courseAttendanceData]);

    const currentWeekInterval = React.useMemo(() => {
        const start = startOfWeek(viewWeek, { weekStartsOn: 1 }); // Start from Monday
        const mon = start;
        return [0,1,2,3,4].map(i => {
            const d = new Date(mon);
            d.setDate(mon.getDate() + i);
            return d;
        });
    }, [viewWeek]);

    const renderMonthlyTimetable = () => {
        const start = startOfMonth(viewMonth);
        const end = endOfMonth(viewMonth);
        const days = eachDayOfInterval({ start, end });
        
        const startDayIdx = getDay(start);
        const paddingDays = Array.from({ length: startDayIdx });

        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold font-headline">{format(viewMonth, 'MMMM yyyy')}</h3>
                    <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={() => setViewMonth(subMonths(viewMonth, 1))}><ChevronLeft className="h-4 w-4"/></Button>
                        <Button variant="outline" size="icon" onClick={() => setViewMonth(addMonths(viewMonth, 1))}><ChevronRight className="h-4 w-4"/></Button>
                    </div>
                </div>
                <div className="grid grid-cols-7 gap-px border bg-border rounded-lg overflow-hidden shadow-sm">
                    {calendarDays.map(d => (
                        <div key={d} className="bg-muted/50 p-2 text-center text-xs font-bold uppercase tracking-wider">{d}</div>
                    ))}
                    {paddingDays.map((_, i) => (
                        <div key={`pad-${i}`} className="bg-background min-h-[120px] opacity-50" />
                    ))}
                    {days.map(day => {
                        const dayName = calendarDays[getDay(day)];
                        const sessions = filteredTimetable.filter(e => e.day === dayName).sort((a,b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
                        const isCurrentDay = isToday(day);

                        return (
                            <div key={day.toString()} className={cn("bg-background min-h-[120px] p-2 space-y-1 border-t", isCurrentDay && "bg-primary/5 ring-1 ring-primary/20 ring-inset")}>
                                <div className="flex justify-between items-start mb-1">
                                    <span className={cn("text-xs font-bold p-1 rounded-full w-6 h-6 flex items-center justify-center", isCurrentDay && "bg-primary text-white")}>{format(day, 'd')}</span>
                                </div>
                                <div className="space-y-1">
                                    {sessions.map(s => {
                                        const stats = getSessionAttendanceStats(s, day);

                                        return (
                                            <div 
                                                key={s.id} 
                                                className={cn(
                                                    "text-[9px] p-1.5 rounded border border-primary/10 cursor-pointer hover:bg-primary/5 transition-all",
                                                    stats.isMarked ? "bg-green-50 border-green-200" : "bg-card"
                                                )}
                                                onClick={() => {
                                                    setAttendanceDate(day);
                                                    setActiveSession(s);
                                                    fetchSessionStudents(s, day);
                                                }}
                                            >
                                                <div className="font-bold text-primary flex justify-between items-start">
                                                    <span className="truncate pr-1">{s.courseCode}</span>
                                                    {stats.isMarked && <Check className="h-2 w-2 text-green-600"/>}
                                                </div>
                                                <div className="text-muted-foreground flex items-center gap-1 mt-0.5">
                                                    <Clock className="h-2 w-2"/> {s.startTime}
                                                </div>
                                                <div className="mt-1 flex flex-wrap gap-1 text-[8px] font-semibold">
                                                    <span className="text-green-600 bg-green-50 px-0.5 rounded">{stats.present}P</span>
                                                    <span className="text-red-600 bg-red-50 px-0.5 rounded">{stats.absent}A</span>
                                                    {stats.unmarked > 0 && (
                                                        <span className="text-gray-500 bg-gray-50 px-0.5 rounded">{stats.unmarked}U</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-12 w-1/3"/><Skeleton className="h-96 w-full"/></div>;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-2xl font-headline">Attendance Portal</CardTitle>
                        <CardDescription>Comprehensive attendance tracking and management across all cohorts.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground mr-2 hidden sm:inline">Default View:</Label>
                        <Select value={defaultView} onValueChange={handleSetDefaultView}>
                            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="marking">Mark Daily</SelectItem>
                                <SelectItem value="monthly">Monthly Grid</SelectItem>
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
                        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto">
                            <TabsTrigger value="marking" className="py-2"><PlusCircle className="mr-2 h-4 w-4"/>Mark Daily</TabsTrigger>
                            <TabsTrigger value="monthly" className="py-2"><CalendarIcon className="mr-2 h-4 w-4"/>Monthly Timetable</TabsTrigger>
                            <TabsTrigger value="semester" className="py-2"><ListFilter className="mr-2 h-4 w-4"/>Semester Stats</TabsTrigger>
                            <TabsTrigger value="student" className="py-2"><UserSearch className="mr-2 h-4 w-4"/>Student Record</TabsTrigger>
                        </TabsList>

                        <TabsContent value="marking" className="mt-6 space-y-4">
                            {selectedIntake ? (
                                <>
                                <div className="flex items-center justify-between px-2 bg-muted/20 py-2 rounded-lg border">
                                    <div className="flex items-center gap-4">
                                        <Button variant="outline" size="sm" onClick={() => setViewWeek(subWeeks(viewWeek, 1))}><ChevronLeft className="h-4 w-4 mr-1"/> Prev Week</Button>
                                        <div className="font-bold text-sm uppercase tracking-widest">{format(currentWeekInterval[0], 'MMM dd')} - {format(currentWeekInterval[4], 'MMM dd, yyyy')}</div>
                                        <Button variant="outline" size="sm" onClick={() => setViewWeek(addWeeks(viewWeek, 1))}>Next Week <ChevronRight className="h-4 w-4 ml-1"/></Button>
                                    </div>
                                    <Badge variant="secondary" className="font-mono text-[10px]">CURRENTLY VIEWING TIMETABLE WITH DATES</Badge>
                                </div>
                                <div className="border rounded-lg overflow-hidden bg-muted/10">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50">
                                                <TableHead className="w-48 border-r font-bold text-center">DATE & DAY</TableHead>
                                                {teachingTimes.slots.map((slot, index) => (
                                                    <TableHead key={index} className="text-center font-bold border-r">
                                                        <span className="text-xs">{slot.startTime} - {slot.endTime}</span>
                                                    </TableHead>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {currentWeekInterval.map(date => {
                                                const dayName = calendarDays[getDay(date)];
                                                const dateStr = format(date, 'yyyy-MM-dd');
                                                const isDayToday = isToday(date);

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
                                                            const sessions = filteredTimetable.filter(e => e.day === dayName && timeToMinutes(e.startTime) >= slotStart && timeToMinutes(e.startTime) < slotEnd);
                                                            
                                                            return (
                                                                <TableCell key={sIdx} className="p-2 border-r align-top min-h-[100px]">
                                                                    {sessions.map((entry, eIdx) => {
                                                                        const stats = getSessionAttendanceStats(entry, date);
                                                                        return (
                                                                            <div 
                                                                                key={eIdx} 
                                                                                className={cn(
                                                                                    "cursor-pointer group p-2 rounded-md border bg-background hover:bg-primary/5 mb-2 shadow-sm relative transition-all",
                                                                                    stats.isMarked ? "border-green-500 bg-green-50/30" : "border-primary/20"
                                                                                )} 
                                                                                onClick={() => { 
                                                                                    setAttendanceDate(date); 
                                                                                    setActiveSession(entry); 
                                                                                    fetchSessionStudents(entry, date); 
                                                                                }}
                                                                            >
                                                                                <p className="font-bold text-primary text-[10px] leading-tight line-clamp-2">{entry.courseCode}: {entry.courseName}</p>
                                                                                <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-1"><MapPin className="h-2 w-2" /> {entry.venue}</div>
                                                                                <div className="mt-1.5 flex flex-wrap gap-1 text-[9px] font-semibold">
                                                                                    <span className="text-green-600 bg-green-50 px-1 py-0.5 rounded border border-green-100">{stats.present} P</span>
                                                                                    <span className="text-red-600 bg-red-50 px-1 py-0.5 rounded border border-red-100">{stats.absent} A</span>
                                                                                    {stats.unmarked > 0 && (
                                                                                        <span className="text-gray-500 bg-gray-50 px-1 py-0.5 rounded border border-gray-100">{stats.unmarked} U</span>
                                                                                    )}
                                                                                </div>
                                                                                {stats.isMarked && <div className="absolute top-1 right-1"><CheckCircle className="h-3 w-3 text-green-600"/></div>}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </TableCell>
                                                            );
                                                        })}
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                                </>
                            ) : (
                                <div className="text-center py-20 text-muted-foreground bg-muted/10 rounded-lg border-2 border-dashed">Select an intake to view the daily marking grid.</div>
                            )}
                        </TabsContent>

                        <TabsContent value="monthly" className="mt-6">
                            {selectedIntake ? renderMonthlyTimetable() : (
                                <div className="text-center py-20 text-muted-foreground bg-muted/10 rounded-lg border-2 border-dashed">Select an intake to view the monthly timetable.</div>
                            )}
                        </TabsContent>

                        <TabsContent value="semester" className="mt-6">
                            {selectedIntake ? (
                                <div className="space-y-4">
                                    <Alert className="bg-primary/5 border-primary/20">
                                        <Info className="h-4 w-4" />
                                        <AlertTitle>Aggregated Semester Statistics</AlertTitle>
                                        <AlertDescription>Overview of attendance reliability across all courses for the current intake cohort.</AlertDescription>
                                    </Alert>
                                    <div className="rounded-md border overflow-hidden shadow-sm">
                                        <Table>
                                            <TableHeader className="bg-muted/50">
                                                <TableRow>
                                                    <TableHead>Student</TableHead>
                                                    <TableHead>System ID</TableHead>
                                                    <TableHead className="text-center">Total Sessions</TableHead>
                                                    <TableHead className="text-center">Present</TableHead>
                                                    <TableHead className="w-[200px]">Attendance Rate</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {semesterStats.length > 0 ? semesterStats.map(student => (
                                                    <TableRow key={student.uid}>
                                                        <TableCell className="font-bold">{student.name}</TableCell>
                                                        <TableCell className="font-mono text-xs uppercase">{student.id}</TableCell>
                                                        <TableCell className="text-center">{student.total}</TableCell>
                                                        <TableCell className="text-center font-bold text-green-600">{student.present}</TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <Progress value={student.rate} className={cn("h-2", student.rate < 75 ? "bg-red-100" : "bg-green-100")} />
                                                                <span className={cn("text-[10px] font-bold", student.rate < 75 ? "text-red-600" : "text-green-600")}>{student.rate.toFixed(0)}%</span>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )) : <TableRow><TableCell colSpan={5} className="text-center h-32 text-muted-foreground italic">No student data found for this intake.</TableCell></TableRow>}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-20 text-muted-foreground bg-muted/10 rounded-lg border-2 border-dashed">Select an intake to view semester-wide attendance stats.</div>
                            )}
                        </TabsContent>

                        <TabsContent value="student" className="mt-6 space-y-6">
                            {!selectedStudentHistory ? (
                                <div className="space-y-4">
                                    <div className="max-w-md mx-auto space-y-4">
                                        <div className="relative">
                                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input 
                                                placeholder="Filter student roster..." 
                                                className="pl-8" 
                                                value={studentListSearch}
                                                onChange={e => setStudentListSearch(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {allStudents
                                            .filter(s => (!selectedIntake || s.intakeId === selectedIntake) && s.name.toLowerCase().includes(studentListSearch.toLowerCase()))
                                            .map(student => (
                                                <Card 
                                                    key={student.uid} 
                                                    className="cursor-pointer hover:bg-primary/5 transition-all border-primary/10 shadow-sm group"
                                                    onClick={() => setSelectedStudentHistory(student.uid)}
                                                >
                                                    <CardHeader className="p-4 flex flex-row items-center gap-3">
                                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold group-hover:bg-primary group-hover:text-white transition-colors">{student.name.charAt(0)}</div>
                                                        <div>
                                                            <p className="font-bold text-sm leading-tight">{student.name}</p>
                                                            <p className="text-[10px] text-muted-foreground uppercase">{student.id}</p>
                                                        </div>
                                                    </CardHeader>
                                                </Card>
                                            ))
                                        }
                                        {allStudents.filter(s => !selectedIntake || s.intakeId === selectedIntake).length === 0 && (
                                            <div className="col-span-full text-center py-20 text-muted-foreground border-2 border-dashed rounded-lg">
                                                <UserSearch className="mx-auto mb-2 opacity-20"/>
                                                <p>No students found for this intake.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <Button variant="ghost" onClick={() => setSelectedStudentHistory(null)} className="font-bold">
                                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Student List
                                    </Button>
                                    <div className="grid gap-6 md:grid-cols-2">
                                        <Card className="border-primary/20 shadow-sm h-fit">
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
                                                                <Progress value={stats.rate} className={cn(stats.rate < 75 ? "bg-red-100" : "bg-green-100")} />
                                                            </div>
                                                        </>
                                                    )
                                                })()}
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardHeader><CardTitle>Detailed Logs</CardTitle></CardHeader>
                                            <CardContent>
                                                <ScrollArea className="h-[450px] pr-4">
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
                                </div>
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
                                            onSelect={(d) => { if(d) { setAttendanceDate(d); if(activeSession) fetchSessionStudents(activeSession, d); } }} 
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
