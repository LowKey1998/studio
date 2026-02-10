'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus, Search, Trash2, Check, Info, Users, MapPin } from 'lucide-react';
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

type Intake = { id: string; name: string; };
type Semester = { id: string; name: string; status: 'Open' | 'Closed' | 'Archived'; intakeId: string; year: number; semesterInYear: number; };
type Course = { id: string; name: string; code: string; cost: number; };
type Student = { uid: string; id: string; name: string; email: string; intakeId?: string; programmeId?: string; };
type TimeSlot = { id: string; startTime: string; endTime: string; };

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
    const [loading, setLoading] = React.useState(true);
    const [teachingTimes, setTeachingTimes] = React.useState<{ days: string[], slots: TimeSlot[] }>({ days: daysOfWeek, slots: [] });
    const [timetableData, setTimetableData] = React.useState<Record<string, any>>({});

    // Selection state
    const [selectedIntake, setSelectedIntake] = React.useState('');
    const [selectedSemester, setSelectedSemester] = React.useState('');
    const [selectedCourseId, setSelectedCourseId] = React.useState<string | null>(null);
    const [enrolledStudents, setEnrolledStudents] = React.useState<Student[]>([]);
    const [actionLoading, setActionLoading] = React.useState<string | null>(null);
    const [searchStudent, setSearchStudent] = React.useState('');

    const { toast } = useToast();

    React.useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [intakeSnap, semSnap, coursesSnap, usersSnap, settingsSnap, tSnap] = await Promise.all([
                    get(ref(db, 'intakes')),
                    get(ref(db, 'semesters')),
                    get(ref(db, 'courses')),
                    get(ref(db, 'users')),
                    get(ref(db, 'settings/teachingTimes')),
                    get(ref(db, 'timetables'))
                ]);

                if (intakeSnap.exists()) setIntakes(Object.entries(intakeSnap.val()).map(([id, data]) => ({ id, ...(data as any) })).sort((a,b) => b.name.localeCompare(a.name)));
                if (semSnap.exists()) setSemesters(Object.entries(semSnap.val()).map(([id, data]) => ({ id, ...(data as any) })));
                if (coursesSnap.exists()) setAllCourses(coursesSnap.val());
                if (usersSnap.exists()) {
                    const data = usersSnap.val();
                    setAllStudents(Object.keys(data).filter(uid => data[uid].role === 'Student').map(uid => ({ uid, ...data[uid] })));
                }
                if (settingsSnap.exists()) {
                    const s = settingsSnap.val();
                    setTeachingTimes({
                        days: s.days || daysOfWeek,
                        slots: (s.slots || []).sort((a: TimeSlot, b: TimeSlot) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
                    });
                }
                if (tSnap.exists()) setTimetableData(tSnap.val());

            } catch (e) {
                toast({ variant: 'destructive', title: 'Data Loading Error' });
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [toast]);

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

    const handleEnrollStudent = async (uid: string) => {
        if (!selectedSemester || !selectedCourseId) return;
        setActionLoading(uid);
        try {
            const regRef = ref(db, `registrations/${uid}/${selectedSemester}`);
            const regSnap = await get(regRef);
            
            let currentCourses = [];
            if (regSnap.exists()) {
                currentCourses = regSnap.val().courses || [];
            }

            if (currentCourses.includes(selectedCourseId)) {
                toast({ title: 'Already enrolled' });
                setActionLoading(null);
                return;
            }

            const updatedCourses = [...currentCourses, selectedCourseId];
            const student = allStudents.find(s => s.uid === uid);

            await update(regRef, { 
                courses: updatedCourses,
                programmeId: student?.programmeId || regSnap.val()?.programmeId || '',
                status: regSnap.exists() ? regSnap.val().status : 'Pending Payment',
                registrationDate: regSnap.exists() ? regSnap.val().registrationDate : new Date().toISOString(),
                semesterName: semesters.find(s => s.id === selectedSemester)?.name || ''
            });

            toast({ title: 'Student Enrolled Successfully' });
            fetchEnrolledStudents(selectedCourseId, selectedSemester);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Enrollment Failed', description: e.message });
        } finally {
            setActionLoading(null);
        }
    };

    const handleRemoveStudent = async (uid: string) => {
        if (!selectedSemester || !selectedCourseId || !window.confirm("Remove student from this course?")) return;
        setActionLoading(uid);
        try {
            const regRef = ref(db, `registrations/${uid}/${selectedSemester}`);
            const regSnap = await get(regRef);
            if (regSnap.exists()) {
                const currentCourses = regSnap.val().courses || [];
                const updatedCourses = currentCourses.filter((id: string) => id !== selectedCourseId);
                await update(regRef, { courses: updatedCourses });
                toast({ title: 'Student Removed' });
                fetchEnrolledStudents(selectedCourseId, selectedSemester);
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Removal Failed' });
        } finally {
            setActionLoading(null);
        }
    };

    const filteredSemesters = semesters.filter(s => s.intakeId === selectedIntake).sort((a, b) => a.year - b.year || a.semesterInYear - b.semesterInYear);
    const semesterTimetable = selectedSemester ? timetableData[selectedSemester] || {} : {};
    const availableStudents = allStudents.filter(s => 
        !enrolledStudents.some(e => e.uid === s.uid) &&
        (s.name.toLowerCase().includes(searchStudent.toLowerCase()) || s.id.toLowerCase().includes(searchStudent.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users /> Student Enrollment Management</CardTitle>
                    <CardDescription>Select an Intake and Semester to view its timetable. Click any class to manage its enrolled students.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid md:grid-cols-2 gap-4 max-w-2xl">
                        <div className="space-y-1">
                            <Label className="font-semibold">Select Intake</Label>
                            <Select value={selectedIntake} onValueChange={(val) => { setSelectedIntake(val); setSelectedSemester(''); setSelectedCourseId(null); }}>
                                <SelectTrigger><SelectValue placeholder="Select an intake..." /></SelectTrigger>
                                <SelectContent>
                                    {intakes.map(i => (
                                        <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="font-semibold">Select Semester</Label>
                            <Select value={selectedSemester} onValueChange={(val) => { setSelectedSemester(val); setSelectedCourseId(null); }} disabled={!selectedIntake}>
                                <SelectTrigger><SelectValue placeholder="Select a semester..." /></SelectTrigger>
                                <SelectContent>
                                    {filteredSemesters.map(s => (
                                        <SelectItem key={s.id} value={s.id}>Year {s.year}, Sem {s.semesterInYear} ({s.status})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {selectedSemester && teachingTimes.slots.length > 0 ? (
                <Card>
                    <CardHeader><CardTitle>Visual Enrollment Grid</CardTitle></CardHeader>
                    <CardContent className="overflow-x-auto">
                        <div className="border rounded-lg overflow-hidden bg-muted/10 min-w-[800px]">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="w-32 border-r font-bold text-center">DAY</TableHead>
                                        {teachingTimes.slots.map((slot) => (
                                            <TableHead key={slot.id} className="text-center font-bold border-r">
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
                                            {teachingTimes.slots.map((slot) => {
                                                const slotStart = timeToMinutes(slot.startTime);
                                                const slotEnd = timeToMinutes(slot.endTime);
                                                
                                                const sessionsInSlot: any[] = [];
                                                Object.entries(semesterTimetable).forEach(([courseId, entries]: [string, any]) => {
                                                    Object.values(entries).forEach((entry: any) => {
                                                        if (entry.day === dayName && timeToMinutes(entry.startTime) >= slotStart && timeToMinutes(entry.startTime) < slotEnd) {
                                                            sessionsInSlot.push({ courseId, ...entry });
                                                        }
                                                    });
                                                });

                                                return (
                                                    <TableCell key={`${dayName}-${slot.id}`} className="p-2 border-r align-top min-h-[100px]">
                                                        <div className="space-y-2">
                                                            {sessionsInSlot.map((entry, eIdx) => {
                                                                const course = allCourses[entry.courseId];
                                                                if(!course) return null;
                                                                return (
                                                                    <div 
                                                                        key={eIdx} 
                                                                        className={cn(
                                                                            "cursor-pointer group relative p-2 rounded-md border bg-background hover:bg-primary/5 transition-all border-primary/20 shadow-sm",
                                                                            selectedCourseId === entry.courseId && "ring-2 ring-primary border-transparent shadow-md scale-[1.02]"
                                                                        )}
                                                                        onClick={() => {
                                                                            setSelectedCourseId(entry.courseId);
                                                                            fetchEnrolledStudents(entry.courseId, selectedSemester);
                                                                        }}
                                                                    >
                                                                        <div className="flex flex-col gap-1">
                                                                            <p className="font-bold text-[10px] text-primary leading-tight line-clamp-2">{course.code}: {course.name}</p>
                                                                            <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                                                                                <MapPin className="h-2.5 w-2.5" /> {entry.venue}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
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
            ) : selectedSemester && (
                <Alert><Info className="h-4 w-4"/><AlertTitle>Setup Required</AlertTitle><AlertDescription>Please define Teaching Times and generate a Timetable for this semester first.</AlertDescription></Alert>
            )}

            <Dialog open={!!selectedCourseId} onOpenChange={(open) => !open && setSelectedCourseId(null)}>
                <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Enrollment: {selectedCourseId && allCourses[selectedCourseId]?.name}</DialogTitle>
                        <DialogDescription>Add or remove students for this specific class session.</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-hidden grid md:grid-cols-2 gap-6 py-4">
                        <div className="flex flex-col gap-4 border rounded-lg p-4 bg-muted/10">
                            <h3 className="font-bold flex items-center gap-2"><UserPlus className="h-4 w-4 text-primary"/> Available Students</h3>
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