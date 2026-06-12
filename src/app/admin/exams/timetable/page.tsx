'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth, getRegistrarIds, createNotification } from '@/lib/firebase';
import { ref, get, set, push, onValue, update, remove, serverTimestamp } from 'firebase/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
    Info, 
    MapPin, 
    CalendarDays, 
    ChevronLeft, 
    ChevronRight, 
    Loader2, 
    Clock, 
    X, 
    Pencil, 
    PlusCircle, 
    Monitor, 
    Search, 
    AlertCircle, 
    FileCheck, 
    Calendar as CalendarIcon,
    Link as LinkIcon,
    CheckCircle2,
    ChevronsUpDown,
    Trash2,
    Settings2,
    Plus,
    Save
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { format, parseISO, startOfWeek, addWeeks, subWeeks, getDay, isToday } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';

type ExamTimeSlot = { id: string; startTime: string; endTime: string; };
type Semester = { id: string; name: string; intakeId: string; year: number; semesterInYear: number; status: 'Open' | 'Closed' | 'Archived'; startDate?: string; endDate?: string; };
type Intake = { id: string; name: string; };
type Course = { id: string; name: string; code: string; status: string; lecturerId: string; lecturerIds?: string[]; separateInstance?: boolean; assessmentTemplateId?: string; };

type ExamEntry = {
    id: string;
    courseId: string;
    courseCode: string;
    courseName: string;
    date: string;
    startTime: string;
    endTime: string;
    venue: string;
    isOnline?: boolean;
    isPublished?: boolean;
    semesterId: string;
};

const calendarDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const timeToMinutes = (time: string) => {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

export default function AdminExamTimetablePage() {
    const [intakes, setIntakes] = React.useState<Intake[]>([]);
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [allCourses, setAllCourses] = React.useState<Course[]>([]);
    const [templates, setTemplates] = React.useState<Record<string, any>>({});
    const [quizzes, setQuizzes] = React.useState<any[]>([]);
    const [rooms, setRooms] = React.useState<{id: string, name: string, capacity: number}[]>([]);
    const [examTimes, setExamTimes] = React.useState<{ slots: ExamTimeSlot[] }>({ slots: [] });
    const [examTimetable, setExamTimetable] = React.useState<Record<string, Record<string, ExamEntry>>>({}); 
    const [masterTimetable, setMasterTimetable] = React.useState<any[]>([]);
    const [calendarSettings, setCalendarSettings] = React.useState<any>(null);

    const [selectedIntakeId, setSelectedIntakeId] = React.useState('');
    const [selectedSemesterId, setSelectedSemesterId] = React.useState('');
    const [viewWeek, setViewWeek] = React.useState(new Date());
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);

    // Form state
    const [isAddOpen, setIsAddOpen] = React.useState(false);
    const [isTimeSetupOpen, setIsTimeSetupOpen] = React.useState(false);
    const [editingEntry, setEditingEntry] = React.useState<ExamEntry | null>(null);
    const [selectedCourseId, setSelectedCourseId] = React.useState('');
    const [examDate, setExamDate] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [startTime, setStartTime] = React.useState('');
    const [endTime, setEndTime] = React.useState('');
    const [venue, setVenue] = React.useState('');
    const [isOnline, setIsOnline] = React.useState(false);
    
    const [courseSearch, setCourseSearch] = React.useState('');
    const [isCoursePopoverOpen, setIsCoursePopoverOpen] = React.useState(false);

    const { toast } = useToast();

    React.useEffect(() => {
        const fetchInitial = async () => {
            const [iSnap, sSnap, cSnap, tSnap, qSnap, rSnap, timesSnap, ttSnap, calSnap] = await Promise.all([
                get(ref(db, 'intakes')),
                get(ref(db, 'semesters')),
                get(ref(db, 'courses')),
                get(ref(db, 'settings/assessmentTemplates')),
                get(ref(db, 'quizzes')),
                get(ref(db, 'settings/rooms')),
                get(ref(db, 'settings/examTimes')),
                get(ref(db, 'timetables')),
                get(ref(db, 'settings/academicCalendar'))
            ]);

            if (iSnap.exists()) setIntakes(Object.entries(iSnap.val()).map(([id, d]: [string, any]) => ({ id, ...d })).sort((a,b) => b.name.localeCompare(a.name)));
            if (sSnap.exists()) setSemesters(Object.entries(sSnap.val()).map(([id, d]: [string, any]) => ({ id, ...d })));
            if (cSnap.exists()) setAllCourses(Object.entries(cSnap.val()).map(([id, d]: [string, any]) => ({ id, ...d })));
            if (tSnap.exists()) setTemplates(tSnap.val());
            if (qSnap.exists()) setQuizzes(Object.entries(qSnap.val()).map(([id, d]:[string, any]) => ({ id, ...d })));
            if (rSnap.exists()) setRooms(Object.entries(rSnap.val()).map(([id, d]: [string, any]) => ({ id, ...d })));
            if (calSnap.exists()) setCalendarSettings(calSnap.val());
            
            if (ttSnap.exists()) {
                const data = ttSnap.val();
                const list: any[] = [];
                Object.keys(data).forEach(sId => {
                    Object.keys(data[sId]).forEach(cId => {
                        Object.values(data[sId][cId]).forEach((e: any) => {
                            list.push({ ...e, courseId: cId, semesterId: sId });
                        });
                    });
                });
                setMasterTimetable(list);
            }

            if (timesSnap.exists()) {
                const data = timesSnap.val();
                setExamTimes({
                    slots: (data.slots || []).sort((a: ExamTimeSlot, b: ExamTimeSlot) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
                });
            } else {
                setExamTimes({
                    slots: [
                        { id: 'session-1', startTime: '09:00', endTime: '12:00' },
                        { id: 'session-2', startTime: '14:00', endTime: '17:00' }
                    ]
                });
            }
            setLoading(false);
        };
        fetchInitial();

        const etRef = ref(db, 'examTimetables');
        const unsubET = onValue(etRef, (snapshot) => {
            const data = snapshot.val() || {};
            const formatted: Record<string, Record<string, ExamEntry>> = {};
            Object.keys(data).forEach(semId => {
                formatted[semId] = {};
                Object.keys(data[semId]).forEach(examId => {
                    formatted[semId][examId] = { id: examId, ...data[semId][examId] };
                });
            });
            setExamTimetable(formatted);
        });

        return () => unsubET();
    }, []);

    React.useEffect(() => {
        if (!selectedIntakeId || !calendarSettings || semesters.length === 0) {
            setSelectedSemesterId('');
            return;
        }

        const intake = intakes.find(i => i.id === selectedIntakeId);
        const intakeStartStr = intake ? parseIntakeDate(intake.name) : null;

        if (intakeStartStr) {
            const state = calculateAcademicState(
                intakeStartStr,
                new Date(),
                calendarSettings.standardCycles,
                Object.values(calendarSettings.anomalies || {})
            );
            
            const matchingSemester = semesters.find(s => 
                s.intakeId === selectedIntakeId && 
                s.year === state.year && 
                s.semesterInYear === state.semester &&
                s.status !== 'Archived'
            );

            if (matchingSemester) {
                setSelectedSemesterId(matchingSemester.id);
            } else {
                setSelectedSemesterId('');
            }
        }
    }, [selectedIntakeId, intakes, semesters, calendarSettings]);

    const activeSemesters = React.useMemo(() => {
        if (!selectedIntakeId) return [];
        return semesters.filter(s => s.intakeId === selectedIntakeId && s.status !== 'Archived').sort((a,b) => b.name.localeCompare(a.name));
    }, [semesters, selectedIntakeId]);

    const availableCourses = React.useMemo(() => {
        if (!selectedSemesterId) return [];
        const intake = intakes.find(i => i.id === selectedIntakeId);
        const courseIdsInTimetable = new Set(
            masterTimetable
                .filter(e => e.semesterId === selectedSemesterId || e.semesterId === 'master')
                .filter(e => {
                    if (e.semesterId === 'master') {
                        return e.intakeName === intake?.name || e.intakeName === 'Master';
                    }
                    return true;
                })
                .map(e => e.courseId)
        );
        return allCourses.filter(c => courseIdsInTimetable.has(c.id));
    }, [allCourses, selectedSemesterId, selectedIntakeId, masterTimetable, intakes]);

    const resetForm = () => {
        setEditingEntry(null); 
        setSelectedCourseId(''); 
        setStartTime(''); 
        setEndTime(''); 
        setVenue(''); 
        setCourseSearch(''); 
        setIsOnline(false);
    };

    const handleSaveEntry = async () => {
        if (!selectedCourseId || !examDate || !startTime || !endTime || !selectedSemesterId) {
            toast({ variant: 'destructive', title: 'Missing required fields' });
            return;
        }
        setSaving(true);
        try {
            const course = allCourses.find(c => c.id === selectedCourseId);
            const data: Omit<ExamEntry, 'id'> = {
                courseId: selectedCourseId,
                courseCode: course?.code || 'N/A',
                courseName: course?.name || 'Unknown',
                date: examDate,
                startTime,
                endTime,
                venue: isOnline ? 'Digital Portal' : (venue || 'TBA'),
                isOnline,
                isPublished: editingEntry?.isPublished || false,
                semesterId: selectedSemesterId
            };

            const etRef = editingEntry 
                ? ref(db, `examTimetables/${selectedSemesterId}/${editingEntry.id}`)
                : push(ref(db, `examTimetables/${selectedSemesterId}`));
            
            await set(etRef, data);
            toast({ title: "Exam Updated" });
            setIsAddOpen(false);
            setEditingEntry(null);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Save Failed' });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveSessionTimes = async () => {
        setSaving(true);
        try {
            await set(ref(db, 'settings/examTimes'), examTimes);
            toast({ title: "Session Times Saved" });
            setIsTimeSetupOpen(false);
        } catch (e) {
            toast({ variant: 'destructive', title: "Save Failed" });
        } finally {
            setSaving(false);
        }
    };

    const handleTogglePublish = async (semesterId: string, examId: string, currentStatus: boolean) => {
        if (!examId) return;
        try {
            await update(ref(db, `examTimetables/${semesterId}/${examId}`), { isPublished: !currentStatus });
            toast({ title: !currentStatus ? "Schedule Published" : "Schedule Hidden" });
        } catch (e) { toast({ variant: 'destructive', title: 'Update failed' }); }
    };

    const handleDelete = async (semesterId: string, examId: string) => {
        if (!window.confirm("Permanently remove this exam from the timetable?")) return;
        try {
            await remove(ref(db, `examTimetables/${semesterId}/${examId}`));
            toast({ title: 'Exam Removed' });
        } catch (e) { toast({ variant: 'destructive', title: 'Removal failed' }); }
    };

    const currentWeekInterval = React.useMemo(() => {
        const start = startOfWeek(viewWeek, { weekStartsOn: 1 });
        return [0, 1, 2, 3, 4, 5, 6].map(i => {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            return d;
        });
    }, [viewWeek]);

    const getQuizForCourse = (courseId: string) => {
        const course = allCourses.find(c => c.id === courseId);
        if (!course?.assessmentTemplateId) return null;
        const template = templates[course.assessmentTemplateId];
        const mcqComponent = Object.keys(template?.components || {}).find(id => template.components[id].isOnlineQuiz);
        if (!mcqComponent) return null;
        
        return quizzes.find(q => (q.courseId === courseId || q.courseIds?.includes(courseId)) && q.linkedComponentId === mcqComponent);
    };

    const searchedCourses = React.useMemo(() => {
        return availableCourses.filter(c => 
            c.name.toLowerCase().includes(courseSearch.toLowerCase()) || 
            c.code.toLowerCase().includes(courseSearch.toLowerCase())
        );
    }, [availableCourses, courseSearch]);

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader>
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary rounded-lg shadow-md">
                                <FileCheck className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <CardTitle className="font-headline text-2xl">Final Examination Timetabling</CardTitle>
                                <CardDescription>Draft and publish official exam schedules for cohort groups.</CardDescription>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setIsTimeSetupOpen(true)}>
                                <Settings2 className="mr-2 h-4 w-4" /> Session Times
                            </Button>
                            <Button onClick={() => { resetForm(); setIsAddOpen(true); }} disabled={!selectedSemesterId}>
                                <PlusCircle className="mr-2 h-4 w-4"/> Schedule Exam
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="flex flex-wrap gap-4 items-end bg-muted/30 p-4 rounded-xl border shadow-sm">
                <div className="w-64">
                    <Label className="text-[10px] font-black uppercase opacity-60 mb-1.5 block">1. Select Intake</Label>
                    <Select value={selectedIntakeId} onValueChange={(val) => setSelectedIntakeId(val)}>
                        <SelectTrigger className="bg-background border-primary/20 shadow-sm"><SelectValue placeholder="Cohort Group..."/></SelectTrigger>
                        <SelectContent>{intakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="w-64">
                    <Label className="text-[10px] font-black uppercase opacity-60 mb-1.5 block">2. Target Semester</Label>
                    <Select value={selectedSemesterId} onValueChange={setSelectedSemesterId} disabled={!selectedIntakeId}>
                        <SelectTrigger className="bg-background border-primary/20 shadow-sm"><SelectValue placeholder="Academic Period..."/></SelectTrigger>
                        <SelectContent>{activeSemesters.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <Separator orientation="vertical" className="h-10 hidden lg:block mx-2" />
                <div className="flex items-center gap-4 py-2">
                    <Button variant="outline" size="sm" onClick={() => setViewWeek(subWeeks(viewWeek, 1))} className="shadow-sm"><ChevronLeft className="h-4 w-4 mr-1"/> Prev</Button>
                    <div className="font-bold text-sm uppercase tracking-widest text-primary bg-background px-4 py-2 rounded-full border border-primary/10 shadow-inner">
                        {format(currentWeekInterval[0], 'MMM dd')} - {format(currentWeekInterval[6], 'MMM dd, yyyy')}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setViewWeek(addWeeks(viewWeek, 1))} className="shadow-sm">Next <ChevronRight className="h-4 w-4 ml-1"/></Button>
                </div>
            </div>

            {loading ? <Skeleton className="h-96 w-full" /> : !selectedSemesterId ? (
                <div className="py-24 text-center border-2 border-dashed rounded-3xl bg-muted/5 flex flex-col items-center gap-4">
                    <CalendarDays className="h-12 w-12 mx-auto opacity-10" />
                    <div className="space-y-1">
                        <h3 className="text-lg font-bold">Awaiting Phase Selection</h3>
                        <p className="text-sm text-muted-foreground">Please select an intake above. The system will automatically resolve the active semester.</p>
                    </div>
                </div>
            ) : (
                <div className="border rounded-xl overflow-hidden bg-muted/10 shadow-inner overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50 border-b">
                                <TableHead className="w-32 border-r font-bold text-center">DATE & DAY</TableHead>
                                {examTimes.slots.map((slot, index) => (<TableHead key={index} className="text-center font-bold border-r text-xs">{slot.startTime} - {slot.endTime}</TableHead>))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {currentWeekInterval.map(date => {
                                const dayName = calendarDays[getDay(date)];
                                const isDayToday = isToday(date);
                                const dateStr = format(date, 'yyyy-MM-dd');

                                return (
                                    <TableRow key={dateStr} className={cn(isDayToday && "bg-primary/5")}>
                                        <TableCell className={cn("font-bold text-xs border-r text-center", isDayToday ? "text-primary bg-primary/10" : "bg-muted/20")}>
                                            <div className="flex flex-col">
                                                <span className="uppercase text-[10px] opacity-70">{dayName}</span>
                                                <span className="text-sm font-black">{format(date, 'MMM dd')}</span>
                                            </div>
                                        </TableCell>
                                        {examTimes.slots.map((slot, sIdx) => {
                                            const slotStart = timeToMinutes(slot.startTime);
                                            const slotEnd = timeToMinutes(slot.endTime);
                                            
                                            const examsInSlot = Object.values(examTimetable[selectedSemesterId] || {})
                                                .filter(e => e.date === dateStr && timeToMinutes(e.startTime) >= slotStart && timeToMinutes(e.startTime) < slotEnd);

                                            return (
                                                <TableCell key={sIdx} className="p-2 border-r align-top min-h-[120px] group cursor-pointer hover:bg-primary/5 transition-colors" onClick={() => {
                                                    resetForm();
                                                    setExamDate(dateStr);
                                                    setStartTime(slot.startTime);
                                                    setEndTime(slot.endTime);
                                                    setIsAddOpen(true);
                                                }}>
                                                    <div className="space-y-2">
                                                        {examsInSlot.map(exam => {
                                                            const quiz = getQuizForCourse(exam.courseId);
                                                            return (
                                                                <div key={exam.id} className={cn("p-2.5 rounded-lg border bg-background shadow-md relative transition-all", exam.isPublished ? "border-green-400 bg-green-50/5 ring-1 ring-green-100" : "border-amber-300 bg-amber-50/5")} onClick={(e) => e.stopPropagation()}>
                                                                    <div className="flex justify-between items-start gap-1">
                                                                        <div className="flex-1">
                                                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                                                <Badge className={cn("text-[8px] h-4 uppercase font-black border px-1.5 py-0", exam.isPublished ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-100" : "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100")}>
                                                                                    {exam.isPublished ? 'Live' : 'Draft'}
                                                                                </Badge>
                                                                                {exam.isOnline && <Badge className="text-[8px] h-4 uppercase font-black border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-50 px-1.5 py-0">Online</Badge>}
                                                                            </div>
                                                                            <p className="font-bold text-[10px] text-primary leading-tight">{exam.courseCode}: {exam.courseName}</p>
                                                                            <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-1"><MapPin className="h-2.5 w-2.5" /> {exam.venue}</div>
                                                                        </div>
                                                                        <div className="flex flex-col gap-1">
                                                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleTogglePublish(selectedSemesterId, exam.id, !!exam.isPublished)} title={exam.isPublished ? "Hide" : "Publish"}>
                                                                                {exam.isPublished ? <CheckCircle2 className="h-3 w-3 text-green-600"/> : <Clock className="h-3 w-3 text-orange-600"/>}
                                                                            </Button>
                                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDelete(selectedSemesterId, exam.id)}><Trash2 className="h-3 w-3"/></Button>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    {exam.isOnline && (
                                                                        <div className="mt-2 pt-2 border-t border-dashed">
                                                                            {quiz ? (
                                                                                <Button variant="outline" size="sm" className="w-full h-6 text-[8px] font-black uppercase bg-blue-50 border-blue-200 text-blue-700" asChild>
                                                                                    <Link href={`/admin/quizzes/builder/${quiz.id}`}><LinkIcon className="h-2 w-2 mr-1"/>Linked Quiz: {quiz.title}</Link>
                                                                                </Button>
                                                                            ) : (
                                                                                <Button variant="secondary" size="sm" className="w-full h-6 text-[8px] font-black uppercase shadow-sm" asChild>
                                                                                    <Link href={`/admin/quizzes/builder?courseId=${exam.courseId}&linkedComponentId=${allCourses.find(c=>c.id===exam.courseId)?.assessmentTemplateId && Object.keys(templates[allCourses.find(c=>c.id===exam.courseId)!.assessmentTemplateId]?.components || {}).find(id => templates[allCourses.find(c=>c.id===exam.courseId)!.assessmentTemplateId].components[id].isOnlineQuiz)}`}><PlusCircle className="h-2 w-2 mr-1"/>Create Exam Quiz</Link>
                                                                                </Button>
                                                                            )}
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

            <Dialog open={isAddOpen} onOpenChange={(o) => { setIsAddOpen(o); if(!o) resetForm(); }}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingEntry ? 'Edit Exam' : 'Schedule Exam'}</DialogTitle>
                        <DialogDescription>Assign a final exam slot for the selected semester.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-1">
                            <Label>Course</Label>
                            <Popover open={isCoursePopoverOpen} onOpenChange={setIsCoursePopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between font-normal h-10 border-primary/30">
                                        {selectedCourseId ? allCourses.find(c => c.id === selectedCourseId)?.name : "Find a course..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                    <div className="flex flex-col">
                                        <div className="p-2 border-b">
                                            <Input placeholder="Search..." value={courseSearch} onChange={(e) => setCourseSearch(e.target.value)} onKeyDown={(e) => e.stopPropagation()}/>
                                        </div>
                                        <ScrollArea className="h-64">
                                            <div className="p-1">
                                                {searchedCourses.map((c) => (
                                                    <Button key={c.id} variant="ghost" className="w-full justify-start text-xs h-auto py-2 px-3 text-left" onClick={() => { setSelectedCourseId(c.id); setIsCoursePopoverOpen(false); }}>
                                                        <div>
                                                            <div className="font-bold text-primary">{c.code}</div>
                                                            <div className="text-muted-foreground leading-tight mt-0.5">{c.name}</div>
                                                        </div>
                                                    </Button>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                        
                        <div className="flex items-center space-x-2 py-2 p-4 border rounded-md bg-blue-50/50">
                            <Switch id="is-online" checked={isOnline} onCheckedChange={setIsOnline} />
                            <div className="space-y-0.5">
                                <Label htmlFor="is-online" className="text-sm font-bold flex items-center gap-2">
                                    <Monitor className="h-4 w-4 text-blue-600"/> Automated Digital Exam
                                </Label>
                                <p className="text-[10px] text-muted-foreground leading-tight italic">Flags this as a computer-based test via the student portal.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-start text-left font-normal border-primary/20">
                                            <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                                            {examDate ? format(parseISO(examDate), 'PPP') : "Select date"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar mode="single" selected={examDate ? parseISO(examDate) : undefined} onSelect={(d) => setExamDate(d ? format(d, 'yyyy-MM-dd') : '')} initialFocus />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-1">
                                <Label>Venue</Label>
                                {isOnline ? (
                                    <div className="h-10 flex items-center px-3 border rounded-md bg-muted/50 text-xs font-bold text-blue-700 italic border-blue-200/50 shadow-inner">
                                        <Monitor className="h-3 w-3 mr-2" /> PORTAL ACCESS
                                    </div>
                                ) : (
                                    <Select value={venue} onValueChange={setVenue}>
                                        <SelectTrigger className="border-primary/20"><SelectValue placeholder="Room..."/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="TBA">None / TBA</SelectItem>
                                            {rooms.map(r => <SelectItem key={r.id} value={r.name}>{r.name} (Cap: {r.capacity})</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Start Time</Label>
                                <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="border-primary/20" />
                            </div>
                            <div className="space-y-1">
                                <Label>End Time</Label>
                                <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="border-primary/20" />
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="border-t pt-4">
                        <Button variant="ghost" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveEntry} disabled={saving || !selectedCourseId}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileCheck className="mr-2 h-4 w-4" />}
                            Schedule Slot
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isTimeSetupOpen} onOpenChange={setIsTimeSetupOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Configure Exam Sessions</DialogTitle>
                        <DialogDescription>Define the standard time slots for examinations.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                        {examTimes.slots.map((slot, index) => (
                            <div key={slot.id} className="flex items-center gap-3 p-3 border rounded-lg bg-card">
                                <div className="flex-1 grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase opacity-60">Start (24h)</Label>
                                        <Input value={slot.startTime} onChange={e => {
                                            const next = [...examTimes.slots];
                                            next[index].startTime = e.target.value;
                                            setExamTimes({ slots: next });
                                        }} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase opacity-60">End (24h)</Label>
                                        <Input value={slot.endTime} onChange={e => {
                                            const next = [...examTimes.slots];
                                            next[index].endTime = e.target.value;
                                            setExamTimes({ slots: next });
                                        }} />
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" className="mt-4 text-destructive" onClick={() => {
                                    setExamTimes({ slots: examTimes.slots.filter(s => s.id !== slot.id) });
                                }}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                        <Button variant="outline" className="w-full border-dashed" onClick={() => {
                            setExamTimes({ slots: [...examTimes.slots, { id: `session-${Date.now()}`, startTime: '09:00', endTime: '12:00' }] });
                        }}>
                            <Plus className="mr-2 h-4 w-4" /> Add New Session
                        </Button>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button onClick={handleSaveSessionTimes} disabled={saving}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                            Save Sessions
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
