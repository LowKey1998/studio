'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from '@/components/ui/skeleton';
import { db, createNotification } from '@/lib/firebase';
import { ref, onValue, get, set } from 'firebase/database';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, PlusCircle, CheckCircle, XCircle, Info, Loader2, Save, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';

type Intake = { id: string; name: string; };
type Room = { id: string; name: string; capacity: number; };
type TimeSlot = { id: string; startTime: string; endTime: string; };
type Course = { id: string; name: string; code: string; };
type Student = { uid: string; id: string; name: string; };

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
    const [rooms, setRooms] = React.useState<Room[]>([]);
    const [teachingTimes, setTeachingTimes] = React.useState<{ days: string[], slots: TimeSlot[] }>({ days: daysOfWeek, slots: [] });
    const [masterTimetable, setMasterTimetable] = React.useState<TimetableEntry[]>([]);
    const [allCourses, setAllCourses] = React.useState<Record<string, Course>>({});
    const [loading, setLoading] = React.useState(true);

    const [selectedIntake, setSelectedIntake] = React.useState<string>('');
    const [activeSession, setActiveSession] = React.useState<TimetableEntry | null>(null);
    const [attendanceDate, setAttendanceDate] = React.useState<Date>(new Date());
    const [studentsInSession, setStudentsInSession] = React.useState<Student[]>([]);
    const [attendance, setAttendance] = React.useState<AttendanceRecord>({});
    const [saving, setSaving] = React.useState(false);

    const { toast } = useToast();

    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [intakeSnap, roomsSnap, settingsSnap, coursesSnap, timetablesSnap, semSnap] = await Promise.all([
                get(ref(db, 'intakes')),
                get(ref(db, 'settings/rooms')),
                get(ref(db, 'settings/teachingTimes')),
                get(ref(db, 'courses')),
                get(ref(db, 'timetables')),
                get(ref(db, 'semesters')),
            ]);

            const iData = intakeSnap.val() || {};
            const rData = roomsSnap.val() || {};
            const sData = settingsSnap.val() || {};
            const cData = coursesSnap.val() || {};
            const tData = timetablesSnap.val() || {};
            const semData = semSnap.val() || {};

            setIntakes(Object.entries(iData).map(([id, data]: [string, any]) => ({ id, ...data })).sort((a,b) => b.name.localeCompare(a.name)));
            setRooms(Object.entries(rData).map(([id, data]: [string, any]) => ({ id, ...data })));
            setAllCourses(cData);
            setTeachingTimes({
                days: sData.days || daysOfWeek,
                slots: (sData.slots || []).sort((a: TimeSlot, b: TimeSlot) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
            });

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
            const [usersSnap, regsSnap] = await Promise.all([
                get(ref(db, 'users')),
                get(ref(db, 'registrations'))
            ]);

            const allUsers = usersSnap.val() || {};
            const allRegs = regsSnap.val() || {};
            const list: Student[] = [];

            // Find all students enrolled in this course in any active semester
            for (const userId in allRegs) {
                const userRegs = allRegs[userId];
                const isEnrolled = Object.entries(userRegs).some(([semId, reg]: [string, any]) => {
                    return reg.courses?.includes(session.courseId) && (reg.status === 'Completed' || reg.status === 'Pending Payment');
                });

                if (isEnrolled && allUsers[userId]) {
                    list.push({ uid: userId, id: allUsers[userId].id, name: allUsers[userId].name });
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
                        `Attendance Alert: You were marked as ${status} for ${activeSession.courseName} on ${format(attendanceDate, 'PPP')}.`,
                        `/student/courses/${activeSession.courseId}/attendance`
                    );
                }
                return Promise.resolve();
            });
            await Promise.all(promises);

            toast({ title: "Attendance Saved", description: `Record for ${format(attendanceDate, 'PPP')} updated.` });
            setActiveSession(null);
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Save Failed", description: e.message });
        } finally {
            setSaving(false);
        }
    };

    const filteredTimetable = React.useMemo(() => {
        if (!selectedIntake) return [];
        const intakeName = intakes.find(i => i.id === selectedIntake)?.name;
        return masterTimetable.filter(e => e.intakeName === intakeName);
    }, [masterTimetable, selectedIntake, intakes]);

    if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-12 w-1/3"/><Skeleton className="h-96 w-full"/></div>;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Academic Attendance Portal</CardTitle>
                    <CardDescription>Select an intake to view its schedule and mark daily attendance.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="max-w-md space-y-1">
                        <Label>Target Intake</Label>
                        <Select value={selectedIntake} onValueChange={setSelectedIntake}>
                            <SelectTrigger><SelectValue placeholder="Select intake..." /></SelectTrigger>
                            <SelectContent>{intakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {selectedIntake && (
                <Card>
                    <CardHeader>
                        <CardTitle>Timetable View</CardTitle>
                        <CardDescription>Click on a session to manage attendance.</CardDescription>
                    </CardHeader>
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
                                    {teachingTimes.days.map(dayName => (
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
                                                                    className="cursor-pointer group relative p-2 rounded-md border bg-background border-primary/20 shadow-sm hover:ring-2 hover:ring-primary transition-all"
                                                                    onClick={() => {
                                                                        setActiveSession(entry);
                                                                        fetchSessionStudents(entry);
                                                                    }}
                                                                >
                                                                    <div className="flex flex-col gap-1 text-[10px]">
                                                                        <p className="font-bold text-primary line-clamp-2">{entry.courseCode}: {entry.courseName}</p>
                                                                        <div className="flex items-center gap-1 text-muted-foreground">
                                                                            <MapPin className="h-2.5 w-2.5" /> {entry.venue}
                                                                        </div>
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

            <Dialog open={!!activeSession} onOpenChange={(o) => !o && setActiveSession(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Mark Attendance: {activeSession?.courseName}</DialogTitle>
                        <DialogDescription>{activeSession?.courseCode} &middot; {activeSession?.intakeName}</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 py-4 flex-1 overflow-hidden">
                        <div className="flex items-center gap-4">
                            <Label>Attendance Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-[240px] justify-start text-left font-normal">
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

                        <Separator />

                        <div className="flex-1 overflow-auto rounded-md border">
                            <Table>
                                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                    <TableRow>
                                        <TableHead>Student ID</TableHead>
                                        <TableHead>Full Name</TableHead>
                                        <TableHead className="text-right">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {studentsInSession.length > 0 ? studentsInSession.map((s) => (
                                        <TableRow key={s.uid}>
                                            <TableCell className="font-mono text-xs">{s.id}</TableCell>
                                            <TableCell className="font-medium text-sm">{s.name}</TableCell>
                                            <TableCell>
                                                <RadioGroup 
                                                    value={attendance[s.uid] || 'Present'} 
                                                    onValueChange={(v) => setAttendance(p => ({...p, [s.uid]: v as any}))}
                                                    className="flex justify-end gap-4"
                                                >
                                                    <div className="flex items-center space-x-1"><RadioGroupItem value="Present" id={`p-${s.uid}`}/><Label htmlFor={`p-${s.uid}`} className="text-xs">Present</Label></div>
                                                    <div className="flex items-center space-x-1"><RadioGroupItem value="Absent" id={`a-${s.uid}`}/><Label htmlFor={`a-${s.uid}`} className="text-xs">Absent</Label></div>
                                                    <div className="flex items-center space-x-1"><RadioGroupItem value="Late" id={`l-${s.uid}`}/><Label htmlFor={`l-${s.uid}`} className="text-xs">Late</Label></div>
                                                    <div className="flex items-center space-x-1"><RadioGroupItem value="Excused Absence" id={`e-${s.uid}`}/><Label htmlFor={`e-${s.uid}`} className="text-xs">Excused</Label></div>
                                                </RadioGroup>
                                            </TableCell>
                                        </TableRow>
                                    )) : <TableRow><TableCell colSpan={3} className="text-center h-24 text-muted-foreground">No students enrolled in this course.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button onClick={handleSaveAttendance} disabled={saving || studentsInSession.length === 0}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                            Save Attendance Record
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}