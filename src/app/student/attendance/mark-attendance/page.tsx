'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { db, auth, createNotification } from '@/lib/firebase';
import { ref, get, set, onValue } from 'firebase/database';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { Loader2, Save, Calendar as CalendarIcon, Info, ClipboardCheck, Users, CheckCircle, XCircle, Clock, Search, ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';
import { format, isSameDay, parseISO, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';

type Course = {
    id: string;
    name: string;
    code: string;
    separateInstance?: boolean;
};

type Student = {
    uid: string;
    id: string;
    name: string;
};

type AttendanceStatus = "Present" | "Absent" | "Late" | "Excused Absence";
type AttendanceRecord = Record<string, AttendanceStatus>;

export default function StudentMarkAttendancePage() {
    const [currentUser, setCurrentUser] = React.useState<FirebaseUser | null>(null);
    const [userProfile, setUserProfile] = React.useState<any>(null);
    const [academicStanding, setAcademicStanding] = React.useState<any>(null);
    const [activeSemester, setActiveSemester] = React.useState<any>(null);
    const [assignedCourses, setAssignedCourses] = React.useState<Course[]>([]);
    
    const [selectedCourseId, setSelectedCourseId] = React.useState('');
    const [markerSettings, setMarkerSettings] = React.useState<{ exactDayOnly: boolean } | null>(null);
    const [scheduledDays, setScheduledDays] = React.useState<string[]>([]);
    const [students, setStudents] = React.useState<Student[]>([]);
    const [attendance, setAttendance] = React.useState<AttendanceRecord>({});
    
    const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());
    const [serverTimeOffset, setServerTimeOffset] = React.useState(0);
    const [studentSearch, setStudentSearch] = React.useState('');
    
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const { toast } = useToast();

    // Listen to Firebase auth state
    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
        });
        return () => unsubscribe();
    }, []);

    // Get database server time offset
    React.useEffect(() => {
        const offsetRef = ref(db, '.info/serverTimeOffset');
        const unsub = onValue(offsetRef, (snap) => {
            setServerTimeOffset(snap.val() || 0);
        });
        return () => unsub();
    }, []);

    const getCurrentServerDate = () => {
        return new Date(Date.now() + serverTimeOffset);
    };

    // Load user profile, calculate standing, find active semester, and get assigned courses
    React.useEffect(() => {
        if (!currentUser) return;
        
        const fetchData = async () => {
            setLoading(true);
            try {
                const userRef = ref(db, `users/${currentUser.uid}`);
                const userSnap = await get(userRef);
                if (!userSnap.exists()) throw new Error("Profile not found");
                const profile = userSnap.val();
                setUserProfile(profile);

                const [calendarSnap, semestersSnap, intakesSnap, coursesSnap, registrationsSnap, markersSnap] = await Promise.all([
                    get(ref(db, 'settings/academicCalendar')),
                    get(ref(db, 'semesters')),
                    get(ref(db, 'intakes')),
                    get(ref(db, 'courses')),
                    get(ref(db, `registrations/${currentUser.uid}`)),
                    get(ref(db, 'settings/attendanceMarkers'))
                ]);

                if (!calendarSnap.exists() || !intakesSnap.exists() || !registrationsSnap.exists()) {
                    setLoading(false);
                    return;
                }

                const intake = intakesSnap.val()[profile.intakeId];
                const intakeStart = parseIntakeDate(intake?.name);
                if (!intakeStart) {
                    setLoading(false);
                    return;
                }

                const standing = calculateAcademicState(
                    intakeStart,
                    getCurrentServerDate(),
                    calendarSnap.val().standardCycles,
                    Object.values(calendarSnap.val().anomalies || {})
                );
                setAcademicStanding(standing);

                const activeSemEntry = Object.entries(semestersSnap.val() || {}).find(([_, s]: [string, any]) => 
                    s.intakeId === profile.intakeId && s.year === standing.year && s.semesterInYear === standing.semester
                );

                if (!activeSemEntry) {
                    setLoading(false);
                    return;
                }

                const [semId, semData] = activeSemEntry as [string, any];
                setActiveSemester({ id: semId, ...semData });

                const reg = registrationsSnap.val()[semId];
                if (!reg || (reg.status !== 'Completed' && reg.status !== 'Pending Payment')) {
                    setLoading(false);
                    return;
                }

                const enrolledCourseIds = Array.isArray(reg.courses) 
                    ? reg.courses 
                    : Object.keys(reg.courses || {});
                
                const allCourses = coursesSnap.val() || {};
                const allMarkers = markersSnap.val() || {};
                
                const myAssigned: Course[] = [];
                for (const cid of enrolledCourseIds) {
                    const courseObj = allCourses[cid];
                    if (!courseObj) continue;
                    
                    const markerKey = (courseObj.separateInstance) ? `${cid}_${semId}` : cid;
                    const markerSetting = allMarkers[markerKey]?.[currentUser.uid];
                    
                    if (markerSetting && markerSetting.enabled === true) {
                        myAssigned.push({
                            id: cid,
                            name: courseObj.name,
                            code: courseObj.code,
                            separateInstance: courseObj.separateInstance
                        });
                    }
                }
                setAssignedCourses(myAssigned);

            } catch (err: any) {
                console.error(err);
                toast({ variant: 'destructive', title: 'Initialization Error', description: err.message });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [currentUser, toast]);

    // Fetch timetable schedule (days of week) and roster for the selected course
    const loadCourseDetails = React.useCallback(async (courseId: string) => {
        if (!activeSemester || !currentUser) return;
        setLoading(true);
        try {
            const courseObj = assignedCourses.find(c => c.id === courseId);
            if (!courseObj) return;

            const markerKey = courseObj.separateInstance ? `${courseId}_${activeSemester.id}` : courseId;
            
            // 1. Fetch marker settings for this user
            const settingsSnap = await get(ref(db, `settings/attendanceMarkers/${markerKey}/${currentUser.uid}`));
            if (settingsSnap.exists()) {
                setMarkerSettings(settingsSnap.val());
                if (settingsSnap.val().exactDayOnly) {
                    setSelectedDate(getCurrentServerDate());
                }
            } else {
                setMarkerSettings({ exactDayOnly: true });
            }

            // 2. Fetch timetable to extract scheduled days
            const timetableSnap = await get(ref(db, 'timetables'));
            const daysSet = new Set<string>();
            const tData = timetableSnap.val() || {};

            // Check both current semester timetable and master timetable
            const checkTimetableNode = (nodeId: string) => {
                const node = tData[nodeId]?.[courseId];
                if (node) {
                    Object.values(node).forEach((entry: any) => {
                        const entryIntake = entry.intakeName?.trim().toUpperCase();
                        const studentIntake = userProfile?.programmeName?.trim().toUpperCase() || '';
                        
                        if (nodeId === 'master') {
                            if (entryIntake === 'MASTER' || (studentIntake && entryIntake === studentIntake)) {
                                if (entry.day) daysSet.add(entry.day);
                            }
                        } else {
                            if (entry.day) daysSet.add(entry.day);
                        }
                    });
                }
            };

            checkTimetableNode(activeSemester.id);
            checkTimetableNode('master');
            setScheduledDays(Array.from(daysSet));

            // 3. Fetch all enrolled students (roster)
            const allUsersSnap = await get(ref(db, 'users'));
            const allUsers = allUsersSnap.val() || {};
            
            const regsSnap = await get(ref(db, 'registrations'));
            const allRegs = regsSnap.val() || {};
            const roster: Student[] = [];

            for (const userId in allRegs) {
                const userReg = allRegs[userId][activeSemester.id];
                if (userReg && userReg.courses) {
                    const coursesList = Array.isArray(userReg.courses) ? userReg.courses : Object.keys(userReg.courses);
                    if (coursesList.includes(courseId) && (userReg.status === 'Completed' || userReg.status === 'Pending Payment')) {
                        roster.push({
                            uid: userId,
                            id: allUsers[userId]?.id || 'N/A',
                            name: allUsers[userId]?.name || 'Unknown'
                        });
                    }
                }
            }
            setStudents(roster.sort((a, b) => a.name.localeCompare(b.name)));

        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Failed to load course details', description: err.message });
        } finally {
            setLoading(false);
        }
    }, [activeSemester, currentUser, assignedCourses, userProfile, toast]);

    React.useEffect(() => {
        if (selectedCourseId) {
            loadCourseDetails(selectedCourseId);
        } else {
            setStudents([]);
            setScheduledDays([]);
            setMarkerSettings(null);
        }
    }, [selectedCourseId, loadCourseDetails]);

    // Fetch existing attendance logs when selectedDate changes
    const fetchAttendanceForDate = React.useCallback(async (date: Date) => {
        if (!selectedCourseId || !activeSemester) return;
        const formattedDate = format(date, 'yyyy-MM-dd');
        const courseObj = assignedCourses.find(c => c.id === selectedCourseId);
        
        const path = (courseObj?.separateInstance) 
            ? `attendance/${selectedCourseId}_${activeSemester.id}/${formattedDate}` 
            : `attendance/${selectedCourseId}/${formattedDate}`;
            
        try {
            const attendanceSnap = await get(ref(db, path));
            if (attendanceSnap.exists()) {
                setAttendance(attendanceSnap.val());
            } else {
                const initial: AttendanceRecord = {};
                students.forEach(student => {
                    initial[student.uid] = 'Present';
                });
                setAttendance(initial);
            }
        } catch (err) {
            console.error("Error loading daily attendance:", err);
        }
    }, [selectedCourseId, activeSemester, assignedCourses, students]);

    React.useEffect(() => {
        if (selectedCourseId && students.length > 0) {
            fetchAttendanceForDate(selectedDate);
        }
    }, [selectedCourseId, students, selectedDate, fetchAttendanceForDate]);

    // Validate if the chosen date matches the exact scheduled days
    const validateSelectedDate = () => {
        const dayOfWeekName = format(selectedDate, 'EEEE');
        const isScheduled = scheduledDays.includes(dayOfWeekName);
        
        if (markerSettings?.exactDayOnly) {
            const isTodayVal = isSameDay(selectedDate, getCurrentServerDate());
            return isScheduled && isTodayVal;
        }
        
        return isScheduled && !isAfter(selectedDate, getCurrentServerDate());
    };

    const isDateValid = validateSelectedDate();

    // Save Attendance Record
    const handleSaveAttendance = async () => {
        if (!selectedCourseId || !activeSemester || !isDateValid) return;
        setSaving(true);
        try {
            const formattedDate = format(selectedDate, 'yyyy-MM-dd');
            const courseObj = assignedCourses.find(c => c.id === selectedCourseId);
            
            const path = (courseObj?.separateInstance) 
                ? `attendance/${selectedCourseId}_${activeSemester.id}/${formattedDate}` 
                : `attendance/${selectedCourseId}/${formattedDate}`;
                
            await set(ref(db, path), attendance);

            // Send notification to students marked Absent or Late
            const promises = Object.entries(attendance).map(([uid, status]) => {
                if (status === 'Absent' || status === 'Late') {
                    return createNotification(
                        uid,
                        `Attendance Alert: Marked as ${status} for ${courseObj?.name} on ${format(selectedDate, 'PPP')}.`,
                        `/student/courses/${selectedCourseId}/attendance`
                    );
                }
                return Promise.resolve();
            });
            await Promise.all(promises);

            toast({ title: 'Attendance Saved Successfully', description: `Roster for ${format(selectedDate, 'PPP')} updated.` });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: err.message });
        } finally {
            setSaving(false);
        }
    };

    // Calculate stats
    const stats = React.useMemo(() => {
        const values = Object.values(attendance);
        return {
            present: values.filter(s => s === 'Present').length,
            absent: values.filter(s => s === 'Absent').length,
            late: values.filter(s => s === 'Late').length
        };
    }, [attendance]);

    const filteredStudents = students.filter(s => 
        s.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
        s.id.toLowerCase().includes(studentSearch.toLowerCase())
    );

    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-12 w-1/3" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (assignedCourses.length === 0) {
        return (
            <div className="space-y-6">
                <Card className="shadow-lg border-t-4 border-t-destructive">
                    <CardContent className="pt-12 pb-12 flex flex-col items-center text-center">
                        <XCircle className="h-16 w-16 text-destructive opacity-30 mb-4 animate-bounce" />
                        <CardTitle className="text-xl font-bold font-headline">Access Restricted</CardTitle>
                        <CardDescription className="max-w-md mx-auto mt-2 leading-relaxed text-sm">
                            You currently do not have any active attendance marking privileges assigned for your enrolled courses. 
                            Please contact your class lecturer or school administration if you believe this is a mistake.
                        </CardDescription>
                        <Button variant="outline" className="mt-6" asChild>
                            <a href="/student/dashboard">Return to Dashboard</a>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const activeCourse = assignedCourses.find(c => c.id === selectedCourseId);
    const dayName = format(selectedDate, 'EEEE');
    const serverTodayName = format(getCurrentServerDate(), 'EEEE');

    return (
        <div className="space-y-6">
            {!selectedCourseId ? (
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-2xl font-headline font-bold">Mark Attendance</CardTitle>
                        <CardDescription>Select a class where you hold marking privileges to proceed.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {assignedCourses.map(course => (
                            <Card key={course.id} className="flex flex-col justify-between hover:shadow-xl hover:border-primary/20 transition-all border shadow-sm">
                                <CardHeader className="pb-4">
                                    <Badge variant="outline" className="w-fit text-[9px] font-bold uppercase tracking-wider bg-primary/5 text-primary border-primary/20 mb-2">
                                        Marker Privilege
                                    </Badge>
                                    <CardTitle className="text-lg font-bold font-headline leading-snug">{course.name}</CardTitle>
                                    <CardDescription className="font-mono text-xs">{course.code}</CardDescription>
                                </CardHeader>
                                <CardFooter className="pt-0">
                                    <Button className="w-full font-bold" onClick={() => setSelectedCourseId(course.id)}>
                                        Open Attendance Roster
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-6">
                    <Button variant="ghost" onClick={() => setSelectedCourseId('')} className="font-bold hover:bg-primary/5">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Classes
                    </Button>

                    <Card className="shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-2xl font-bold font-headline">{activeCourse?.name}</CardTitle>
                            <CardDescription className="font-bold text-primary font-mono text-sm">{activeCourse?.code}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Attendance Date</Label>
                                    <div>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button 
                                                    disabled={markerSettings?.exactDayOnly}
                                                    variant="outline" 
                                                    className={cn('w-full sm:w-[280px] justify-start text-left font-normal h-10', !isDateValid && 'border-destructive text-destructive')}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {format(selectedDate, 'PPP')}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar 
                                                    mode="single" 
                                                    selected={selectedDate} 
                                                    onSelect={(d) => d && setSelectedDate(d)} 
                                                    disabled={(date) => date > getCurrentServerDate()} 
                                                    initialFocus 
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 text-xs font-bold uppercase rounded-xl bg-muted/50 border p-3">
                                    <div className="flex items-center text-green-600 gap-1.5"><CheckCircle className="h-4 w-4" />Present: {stats.present}</div>
                                    <div className="flex items-center text-red-600 gap-1.5"><XCircle className="h-4 w-4" />Absent: {stats.absent}</div>
                                    <div className="flex items-center text-orange-500 gap-1.5"><Clock className="h-4 w-4" />Late: {stats.late}</div>
                                </div>
                            </div>

                            {/* Schedule & Restriction Info Panel */}
                            <Alert className={cn("border-t-2 bg-muted/10", isDateValid ? "border-t-primary/20" : "border-t-destructive bg-destructive/5")}>
                                <Info className={cn("h-5 w-5", isDateValid ? "text-primary" : "text-destructive")} />
                                <AlertTitle className="font-bold uppercase tracking-wider text-xs">
                                    {isDateValid ? "Validation Status: Ready" : "Validation Error: Roster Locked"}
                                </AlertTitle>
                                <AlertDescription className="text-sm space-y-2 mt-2 leading-relaxed">
                                    <p><strong>Scheduled Days:</strong> {scheduledDays.length > 0 ? scheduledDays.join(', ') : 'None configured'}</p>
                                    <p><strong>Selected Day of Week:</strong> {dayName}</p>
                                    {markerSettings?.exactDayOnly ? (
                                        <p className="text-orange-700 font-bold">
                                            ℹ️ Admin restriction active: You can only record attendance on the exact scheduled class day (which must be today, {serverTodayName}).
                                        </p>
                                    ) : (
                                        <p className="text-muted-foreground font-medium">
                                            ℹ️ Date select enabled: You can backdate attendance, but the chosen date must fall on one of the scheduled days listed above.
                                        </p>
                                    )}

                                    {!isDateValid && (
                                        <p className="text-destructive font-black mt-2">
                                            ❌ Locked: The selected date ({format(selectedDate, 'yyyy-MM-dd')}) does not match the class schedule validation rules. You cannot submit attendance.
                                        </p>
                                    )}
                                </AlertDescription>
                            </Alert>

                            {isDateValid && (
                                <div className="space-y-4 pt-4">
                                    <div className="relative max-w-sm">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input 
                                            placeholder="Search class roster..." 
                                            className="pl-8" 
                                            value={studentSearch} 
                                            onChange={e => setStudentSearch(e.target.value)} 
                                        />
                                    </div>

                                    {filteredStudents.length > 0 ? (
                                        <div className="border rounded-lg overflow-hidden bg-card shadow-sm">
                                            <Table>
                                                <TableHeader className="bg-muted/50">
                                                    <TableRow>
                                                        <TableHead className="w-[120px]">Student ID</TableHead>
                                                        <TableHead>Student Name</TableHead>
                                                        <TableHead className="text-right">Attendance Status</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {filteredStudents.map((student) => (
                                                        <TableRow key={student.uid}>
                                                            <TableCell className="font-mono text-xs uppercase">{student.id}</TableCell>
                                                            <TableCell className="font-semibold">{student.name}</TableCell>
                                                            <TableCell className="text-right">
                                                                <RadioGroup 
                                                                    value={attendance[student.uid] || 'Present'} 
                                                                    onValueChange={(value) => setAttendance(p => ({...p, [student.uid]: value as any}))}
                                                                    className="flex justify-end gap-2"
                                                                >
                                                                    <div className="flex flex-col items-center gap-1">
                                                                        <RadioGroupItem value="Present" id={`p-${student.uid}`} className="sr-only" />
                                                                        <Label htmlFor={`p-${student.uid}`} className={cn("px-3 py-1 rounded text-[10px] font-bold border cursor-pointer select-none", attendance[student.uid] === 'Present' ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-background hover:bg-muted/50")}>PRESENT</Label>
                                                                    </div>
                                                                    <div className="flex flex-col items-center gap-1">
                                                                        <RadioGroupItem value="Absent" id={`a-${student.uid}`} className="sr-only" />
                                                                        <Label htmlFor={`a-${student.uid}`} className={cn("px-3 py-1 rounded text-[10px] font-bold border cursor-pointer select-none", attendance[student.uid] === 'Absent' ? "bg-destructive text-destructive-foreground border-destructive shadow-sm" : "bg-background hover:bg-muted/50")}>ABSENT</Label>
                                                                    </div>
                                                                    <div className="flex flex-col items-center gap-1">
                                                                        <RadioGroupItem value="Late" id={`l-${student.uid}`} className="sr-only" />
                                                                        <Label htmlFor={`l-${student.uid}`} className={cn("px-3 py-1 rounded text-[10px] font-bold border cursor-pointer select-none", attendance[student.uid] === 'Late' ? "bg-orange-500 text-white border-orange-500 shadow-sm" : "bg-background hover:bg-muted/50")}>LATE</Label>
                                                                    </div>
                                                                </RadioGroup>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/10">
                                            <Users className="mx-auto h-8 w-8 text-muted-foreground opacity-30 mb-2" />
                                            <p className="text-sm text-muted-foreground italic">No students match your search.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="flex justify-end border-t pt-6 bg-muted/5">
                            <Button 
                                disabled={saving || students.length === 0 || !isDateValid}
                                onClick={handleSaveAttendance} 
                                className="font-bold px-6 shadow-md"
                            >
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save Attendance Record
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            )}
        </div>
    );
}
