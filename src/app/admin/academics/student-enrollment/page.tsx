"use client";
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus, Search, Trash2, Check, Info, Users, MapPin, CalendarDays, Filter, Settings2, X, AlertCircle, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db, createNotification } from '@/lib/firebase';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';
import Link from 'next/link';
import { sendEmail } from '@/ai/flows/send-email-flow';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

    const [selectedIntake, setSelectedIntake] = React.useState('');
    const [activeSession, setActiveSession] = React.useState<TimetableEntry | null>(null);
    const [enrolledStudents, setEnrolledStudents] = React.useState<EnrolledStudent[]>([]);
    const [actionLoading, setActionLoading] = React.useState<string | null>(null);
    const [searchStudent, setSearchStudent] = React.useState('');
    
    // Bulk state
    const [selectedUids, setSelectedUids] = React.useState<Record<string, boolean>>({});
    const [selectedEnrolledUids, setSelectedEnrolledUids] = React.useState<Record<string, boolean>>({});
    const [sendEmails, setSendEmails] = React.useState(true);
    
    // Template state
    const [isConfigOpen, setIsConfigOpen] = React.useState(false);
    const [enrollmentTemplate, setEnrollmentTemplate] = React.useState({
        subject: 'Class Enrollment Notification: [CourseCode]',
        body: `<h2>Class Enrollment Notification</h2>\n<p>Hello [Name],</p>\n<p>You have been <strong>enrolled in</strong> the following course:</p>\n<p><strong>Course:</strong> [CourseName] ([CourseCode])<br/>\n<strong>Time:</strong> [Day] at [Time]</p>\n<p>Best regards,<br/>The Administration</p>`
    });
    const [removalTemplate, setRemovalTemplate] = React.useState({
        subject: 'Class Removal Notification: [CourseCode]',
        body: `<h2>Class Removal Notification</h2>\n<p>Hello [Name],</p>\n<p>You have been <strong>removed from</strong> the following course:</p>\n<p><strong>Course:</strong> [CourseName] ([CourseCode])</p>\n<p>Best regards,<br/>The Administration</p>`
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
                            enrollmentList.push({ ...student, enrolledInSemester: semInfo ? semInfo.name : "Unknown", semesterId: semId });
                        }
                    }
                }
            }
            setEnrolledStudents(enrollmentList);
        } catch (e) { console.error(e); } finally { setActionLoading(null); }
    }, [allStudents, semesters]);

    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [intakeSnap, semSnap, coursesSnap, usersSnap, settingsSnap, timetablesSnap, calendarSnap] = await Promise.all([
                get(ref(db, 'intakes')), get(ref(db, 'semesters')), get(ref(db, 'courses')), get(ref(db, 'users')), get(ref(db, 'settings/teachingTimes')), get(ref(db, 'timetables')), get(ref(db, 'settings/academicCalendar'))
            ]);
            setCalendarSettings(calendarSnap.val());
            setIntakes(Object.entries(intakeSnap.val() || {}).map(([id, data]: [string, any]) => ({ id, ...data })));
            setSemesters(Object.entries(semSnap.val() || {}).map(([id, data]: [string, any]) => ({ id, ...data })));
            setAllCourses(coursesSnap.val() || {});
            setAllStudents(Object.entries(usersSnap.val() || {}).filter(([uid, user]: [string, any]) => user.role === 'Student').map(([uid, user]: [string, any]) => ({ uid, ...user })));
            setTeachingTimes({ days: settingsSnap.val()?.days || daysOfWeek, slots: (settingsSnap.val()?.slots || []).sort((a: any, b: any) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)) });
            
            const entries: TimetableEntry[] = [];
            const tData = timetablesSnap.val() || {};
            const sData = semSnap.val() || {};
            for (const semId in tData) {
                const semInfo = sData[semId] || { name: 'Master' };
                for (const cId in tData[semId]) {
                    if (!coursesSnap.val()?.[cId]) continue;
                    Object.entries(tData[semId][cId]).forEach(([entryId, entry]: [string, any]) => {
                        entries.push({ id: entryId, semesterId: semId, courseId: cId, courseCode: coursesSnap.val()[cId].code, courseName: coursesSnap.val()[cId].name, semesterName: semInfo.name, intakeName: entry.intakeName || 'N/A', ...entry });
                    });
                }
            }
            setMasterTimetable(entries);
        } catch (e) { toast({ variant: 'destructive', title: 'Data Load Failed' }); } finally { setLoading(false); }
    }, [toast]);

    React.useEffect(() => { fetchData(); }, [fetchData]);

    const performEnrollmentAction = async (type: 'enroll' | 'remove', studentOrStudents: Student | Student[]) => {
        if (!activeSession || !calendarSettings) return;
        const students = Array.isArray(studentOrStudents) ? studentOrStudents : [studentOrStudents];
        setActionLoading(type === 'enroll' ? 'bulk-enroll' : 'bulk-remove');
        
        try {
            for (const student of students) {
                const studentIntake = intakes.find(i => i.id === (student.intakeId || selectedIntake));
                if (!studentIntake) throw new Error(`Intake not found for ${student.name}`);
                const intakeStartStr = parseIntakeDate(studentIntake.name);
                if (!intakeStartStr) throw new Error(`Invalid intake date format for ${student.name} (${studentIntake.name})`);
                
                const state = calculateAcademicState(intakeStartStr, new Date(), calendarSettings.standardCycles, Object.values(calendarSettings.anomalies || {}));
                const targetSemester = semesters.find(s => s.intakeId === studentIntake.id && s.year === state.year && s.semesterInYear === state.semester);
                
                if (!targetSemester) throw new Error(`No semester found for ${student.name} in Year ${state.year}, Sem ${state.semester}.`);

                const regRef = ref(db, `registrations/${student.uid}/${targetSemester.id}`);
                const regSnap = await get(regRef);
                
                if (type === 'enroll') {
                    const currentCourses = regSnap.exists() ? regSnap.val().courses || [] : [];
                    const updatedCourses = [...new Set([...currentCourses, activeSession.courseId])];
                    await update(regRef, { courses: updatedCourses, programmeId: student.programmeId || '', intakeId: student.intakeId || selectedIntake, status: regSnap.exists() ? regSnap.val().status : 'Completed', semesterName: targetSemester.name });
                } else {
                    const enrolledS = student as EnrolledStudent;
                    const specificRegRef = ref(db, `registrations/${student.uid}/${enrolledS.semesterId}`);
                    const specificRegSnap = await get(specificRegRef);
                    if (specificRegSnap.exists()) {
                        const updatedCourses = (specificRegSnap.val().courses || []).filter((id: string) => id !== activeSession.courseId);
                        await update(specificRegRef, { courses: updatedCourses });
                    }
                }

                if (sendEmails && student.email) {
                    const tpl = type === 'enroll' ? enrollmentTemplate : removalTemplate;
                    const replaceTags = (s: string) => s.replace(/\[Name\]/g, student.name).replace(/\[CourseName\]/g, activeSession.courseName).replace(/\[CourseCode\]/g, activeSession.courseCode).replace(/\[Day\]/g, activeSession.day).replace(/\[Time\]/g, activeSession.startTime);
                    await sendEmail({ to: [student.email], subject: replaceTags(tpl.subject), body: replaceTags(tpl.body) }).catch(() => {});
                }
            }
            toast({ title: 'Success', description: `${students.length} student(s) processed.` });
            if (type === 'enroll') setSelectedUids({}); else setSelectedEnrolledUids({});
            setStudentToRemove(null);
            await fetchEnrolledStudents(activeSession.courseId);
        } catch (e: any) { 
            toast({ variant: 'destructive', title: 'Action Failed', description: e.message || 'Server error' }); 
        } finally { 
            setActionLoading(null); 
        }
    };

    if (loading) return <Skeleton className="h-96 w-full" />;

    const displayDays = teachingTimes.days.length > 0 ? teachingTimes.days : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const hasSlots = teachingTimes.slots.length > 0;

    const availableToEnroll = allStudents.filter(s => !enrolledStudents.some(e => e.uid === s.uid) && s.name.toLowerCase().includes(searchStudent.toLowerCase()));
    const selectedAvailableCount = Object.values(selectedUids).filter(Boolean).length;
    const selectedEnrolledCount = Object.values(selectedEnrolledUids).filter(Boolean).length;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div><CardTitle>Enrollment Management</CardTitle><CardDescription>Manage class lists by intake schedule.</CardDescription></div>
                    <Button variant="outline" onClick={() => setIsConfigOpen(true)}><Settings2 className="mr-2 h-4 w-4"/>Email Settings</Button>
                </CardHeader>
                <CardContent>
                    <div className="max-w-sm"><Label>Select Intake</Label><Select value={selectedIntake} onValueChange={setSelectedIntake}><SelectTrigger><SelectValue placeholder="Select intake..." /></SelectTrigger><SelectContent>{intakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
                </CardContent>
            </Card>

            {selectedIntake && hasSlots && (
                <Card><CardHeader><CardTitle>Schedule Grid</CardTitle></CardHeader>
                    <CardContent className="overflow-x-auto"><div className="border rounded-lg min-w-[800px]"><Table><TableHeader><TableRow className="bg-muted/50"><TableHead className="w-32 border-r font-bold text-center">DAY</TableHead>{teachingTimes.slots.map((s, i) => <TableHead key={i} className="text-center font-bold border-r text-xs">{s.startTime}-{s.endTime}</TableHead>)}</TableRow></TableHeader><TableBody>{displayDays.map(day => (<TableRow key={day}><TableCell className="font-bold text-xs uppercase text-center border-r bg-muted/20">{day}</TableCell>{teachingTimes.slots.map((slot, sIdx) => {
                        const start = timeToMinutes(slot.startTime); const end = timeToMinutes(slot.endTime);
                        const sessions = masterTimetable.filter(e => e.intakeName === intakes.find(i=>i.id===selectedIntake)?.name && e.day === day && timeToMinutes(e.startTime) >= start && timeToMinutes(e.startTime) < end);
                        return (<TableCell key={sIdx} className="p-2 border-r align-top min-h-[100px]">{sessions.map(entry => (
                            <div key={entry.id} className={cn("cursor-pointer p-2 rounded-md border border-primary/20 bg-background hover:bg-primary/5 transition-all mb-2", activeSession?.id === entry.id && "ring-2 ring-primary")} onClick={() => { setActiveSession(entry); fetchEnrolledStudents(entry.courseId); setSelectedUids({}); setSelectedEnrolledUids({}); }}>
                                <p className="font-bold text-[10px] text-primary leading-tight line-clamp-2" title={entry.courseName}>{entry.courseCode}: {entry.courseName}</p>
                                <p className="text-[9px] text-muted-foreground mt-1 flex items-center gap-1"><MapPin className="h-2 w-2" /> {entry.venue}</p>
                            </div>
                        ))}</TableCell>);
                    })}</TableRow>))}</TableBody></Table></div></CardContent></Card>
            )}

            <Dialog open={!!activeSession} onOpenChange={(o) => !o && setActiveSession(null)}>
                <DialogContent className="max-w-5xl h-[85vh] flex flex-col">
                    <DialogHeader><DialogTitle>Enrollment: {activeSession?.courseName}</DialogTitle></DialogHeader>
                    <div className="flex-1 grid md:grid-cols-2 gap-6 overflow-hidden py-4">
                        <div className="flex flex-col gap-2 border p-4 rounded-lg bg-muted/10 overflow-hidden">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold">Available</h3>
                                {selectedAvailableCount > 0 && (
                                    <Button size="sm" onClick={() => performEnrollmentAction('enroll', availableToEnroll.filter(s => selectedUids[s.uid]))} disabled={!!actionLoading}>
                                        Enroll {selectedAvailableCount}
                                    </Button>
                                )}
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                                <Checkbox checked={selectedAvailableCount === availableToEnroll.length && availableToEnroll.length > 0} onCheckedChange={(checked) => { const next: any = {}; if (checked) availableToEnroll.forEach(s => next[s.uid] = true); setSelectedUids(next); }} />
                                <Input placeholder="Search students..." value={searchStudent} onChange={e=>setSearchStudent(e.target.value)} className="h-8"/>
                            </div>
                            <ScrollArea className="flex-1">
                                {availableToEnroll.map(s => (
                                    <div key={s.uid} className="flex items-center gap-2 p-2 border rounded bg-background mb-2">
                                        <Checkbox checked={!!selectedUids[s.uid]} onCheckedChange={() => setSelectedUids(prev => ({...prev, [s.uid]: !prev[s.uid]}))} />
                                        <div className="flex-1">
                                            <p className="text-sm font-bold">{s.name}</p>
                                            <p className="text-xs text-muted-foreground">{s.id}</p>
                                        </div>
                                        <Button size="sm" variant="ghost" onClick={()=>performEnrollmentAction('enroll', s)} disabled={!!actionLoading}><PlusCircle className="h-4 w-4 text-primary"/></Button>
                                    </div>
                                ))}
                            </ScrollArea>
                        </div>
                        <div className="flex flex-col gap-2 border p-4 rounded-lg overflow-hidden">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold">Enrolled ({enrolledStudents.length})</h3>
                                {selectedEnrolledCount > 0 && (
                                    <Button size="sm" variant="destructive" onClick={() => performEnrollmentAction('remove', enrolledStudents.filter(s => selectedEnrolledUids[s.uid]))} disabled={!!actionLoading}>
                                        Remove {selectedEnrolledCount}
                                    </Button>
                                )}
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                                <Checkbox checked={selectedEnrolledCount === enrolledStudents.length && enrolledStudents.length > 0} onCheckedChange={(checked) => { const next: any = {}; if (checked) enrolledStudents.forEach(s => next[s.uid] = true); setSelectedEnrolledUids(next); }} />
                                <div className="text-xs text-muted-foreground">Select All Enrolled</div>
                            </div>
                            <ScrollArea className="flex-1">
                                {enrolledStudents.map(s => (
                                    <div key={s.uid} className="flex items-center gap-2 p-2 border rounded bg-background mb-2">
                                        <Checkbox checked={!!selectedEnrolledUids[s.uid]} onCheckedChange={() => setSelectedEnrolledUids(prev => ({...prev, [s.uid]: !prev[s.uid]}))} />
                                        <div className="flex-1">
                                            <p className="text-sm font-bold">{s.name}</p>
                                            <p className="text-xs text-muted-foreground">{s.id}</p>
                                        </div>
                                        <Button size="icon" variant="ghost" className="text-destructive" onClick={()=>setStudentToRemove(s)} disabled={!!actionLoading}><Trash2 className="h-4 w-4"/></Button>
                                    </div>
                                ))}
                            </ScrollArea>
                        </div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={()=>setActiveSession(null)}>Done</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!studentToRemove} onOpenChange={o=>!o && setStudentToRemove(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirm Removal</AlertDialogTitle><AlertDialogDescription>Remove {studentToRemove?.name} from this class?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive" onClick={()=>studentToRemove && performEnrollmentAction('remove', studentToRemove)}>Remove</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
            
            <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>Email Notification Settings</DialogTitle></DialogHeader>
                    <div className="flex items-center space-x-2 p-4 bg-muted/20 rounded-md mb-4">
                        <Switch id="send-emails" checked={sendEmails} onCheckedChange={setSendEmails} />
                        <Label htmlFor="send-emails">Enable Enrollment/Removal Emails</Label>
                    </div>
                    <Tabs defaultValue="enroll"><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="enroll">Enrollment</TabsTrigger><TabsTrigger value="remove">Removal</TabsTrigger></TabsList>
                        <TabsContent value="enroll" className="space-y-4 pt-4">
                            <div className="space-y-1"><Label>Subject</Label><Input value={enrollmentTemplate.subject} onChange={e=>setEnrollmentTemplate(p=>({...p, subject: e.target.value}))}/></div>
                            <div className="space-y-1"><Label>Body (HTML)</Label><Textarea rows={10} value={enrollmentTemplate.body} onChange={e=>setEnrollmentTemplate(p=>({...p, body: e.target.value}))}/></div>
                        </TabsContent>
                        <TabsContent value="remove" className="space-y-4 pt-4">
                            <div className="space-y-1"><Label>Subject</Label><Input value={removalTemplate.subject} onChange={e=>setRemovalTemplate(p=>({...p, subject: e.target.value}))}/></div>
                            <div className="space-y-1"><Label>Body (HTML)</Label><Textarea rows={10} value={removalTemplate.body} onChange={e=>setRemovalTemplate(p=>({...p, body: e.target.value}))}/></div>
                        </TabsContent>
                    </Tabs>
                    <DialogFooter><Button onClick={() => setIsConfigOpen(false)}>Save Settings</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
