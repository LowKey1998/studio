'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Save, AlertCircle, Search, User, ChevronsUpDown, X, BookOpen, Layers, Info, Settings2, Mail, CalendarDays, MapPin, CheckCircle2 } from "lucide-react";
import { db } from '@/lib/firebase';
import { ref, get, update, push, onValue } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { sendEmail } from '@/ai/flows/send-email-flow';
import { format, parseISO } from 'date-fns';

type Student = {
    uid: string;
    id: string;
    name: string;
    email: string;
    programmeId?: string;
    intakeId?: string;
};

type Programme = { id: string; name: string; };
type Intake = { id: string; name: string; };
type Semester = { id: string; name: string; intakeId: string; year: number; semesterInYear: number; };
type Course = { id: string; name: string; code: string; assessmentTemplateId?: string; };

type AssessmentScore = { score?: number; feedback?: string; };
type AllScores = Record<string, Record<string, Record<string, AssessmentScore>>>;

type TimeSlot = { id: string; startTime: string; endTime: string; };
type TimetableEntry = {
    id: string;
    semesterId: string;
    courseId: string;
    courseCode: string;
    courseName: string;
    day: string;
    startTime: string;
    endTime: string;
    venue: string;
    intakeName: string;
};

const calendarDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const timeToMinutes = (time: string) => {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

export default function CAEntryPage() {
    const [allStudents, setAllStudents] = React.useState<Student[]>([]);
    const [programmes, setProgrammes] = React.useState<Programme[]>([]);
    const [intakes, setIntakes] = React.useState<Intake[]>([]);
    const [allSemesters, setAllSemesters] = React.useState<Semester[]>([]);
    const [templates, setTemplates] = React.useState<Record<string, { name: string, components: any }>>({});
    const [allCourses, setAllCourses] = React.useState<Record<string, Course>>({});
    
    // Metadata for timetable
    const [teachingTimes, setTeachingTimes] = React.useState<{ days: string[], slots: TimeSlot[] }>({ days: calendarDays.slice(1, 6), slots: [] });
    const [masterTimetable, setMasterTimetable] = React.useState<TimetableEntry[]>([]);
    const [registrations, setRegistrations] = React.useState<Record<string, any>>({});

    const [selectedProgrammeId, setSelectedProgrammeId] = React.useState('');
    const [selectedIntakeId, setSelectedIntakeId] = React.useState('');
    const [selectedYear, setSelectedYear] = React.useState('');
    const [selectedSemesterInYear, setSelectedSemesterInYear] = React.useState('');
    
    const [courses, setCourses] = React.useState<Course[]>([]);
    const [selectedCourseIds, setSelectedCourseIds] = React.useState<string[]>([]);
    const [loadAllCourses, setLoadAllCourses] = React.useState(false);
    
    const [studentsInRoster, setStudentsInRoster] = React.useState<Student[]>([]);
    const [scores, setScores] = React.useState<AllScores>({});
    
    // Email Notification State
    const [isEmailConfigOpen, setIsEmailConfigOpen] = React.useState(false);
    const [sendEmails, setSendEmails] = React.useState(true);
    const [emailSubject, setEmailSubject] = React.useState('New Assessment Results: [CourseCode]');
    const [emailBody, setEmailBody] = React.useState('Hello [Name],<br><br>Your results for [CourseName] have been updated for [Semester].<br><br>[Scores]<br><br>Regards,<br>Academics');

    // Timetable Dialog State
    const [isTimetableOpen, setIsTimetableOpen] = React.useState(false);

    const [isSearchOpen, setIsSearchOpen] = React.useState(false);
    const [studentSearchInput, setStudentSearchInput] = React.useState('');
    const [selectedSearchStudentName, setSelectedSearchStudentName] = React.useState<string | null>(null);
    const [selectedSearchStudentUid, setSelectedSearchStudentUid] = React.useState<string | null>(null);

    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [rosterSearch, setRosterSearch] = React.useState('');
    const { toast } = useToast();

    React.useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [pSnap, iSnap, uSnap, sSnap, tSnap, timesSnap, ttSnap, regSnap, cSnap] = await Promise.all([
                    get(ref(db, 'programmes')),
                    get(ref(db, 'intakes')),
                    get(ref(db, 'users')),
                    get(ref(db, 'semesters')),
                    get(ref(db, 'settings/assessmentTemplates')),
                    get(ref(db, 'settings/teachingTimes')),
                    get(ref(db, 'timetables')),
                    get(ref(db, 'registrations')),
                    get(ref(db, 'courses'))
                ]);

                if (pSnap.exists()) setProgrammes(Object.entries(pSnap.val()).map(([id, data]: [string, any]) => ({ id, ...data })));
                if (iSnap.exists()) setIntakes(Object.entries(iSnap.val()).map(([id, data]: [string, any]) => ({ id, ...data })).sort((a, b) => b.name.localeCompare(a.name)));
                if (uSnap.exists()) setAllStudents(Object.entries(uSnap.val()).filter(([_, u]: [string, any]) => u.role === 'Student').map(([uid, u]: [string, any]) => ({ uid, ...u })));
                if (sSnap.exists()) setAllSemesters(Object.entries(sSnap.val()).map(([id, data]: [string, any]) => ({ id, ...data })));
                if (tSnap.exists()) setTemplates(tSnap.val() || {});
                if (regSnap.exists()) setRegistrations(regSnap.val());
                if (cSnap.exists()) setAllCourses(cSnap.val());

                if (timesSnap.exists()) {
                    const data = timesSnap.val();
                    setTeachingTimes({
                        days: data.days || calendarDays.slice(1, 6),
                        slots: (data.slots || []).sort((a: TimeSlot, b: TimeSlot) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
                    });
                }

                if (ttSnap.exists()) {
                    const tData = ttSnap.val();
                    const entries: TimetableEntry[] = [];
                    for (const semId in tData) {
                        for (const cId in tData[semId]) {
                            Object.entries(tData[semId][cId]).forEach(([entryId, entry]: [string, any]) => {
                                entries.push({ id: entryId, semesterId: semId, courseId: cId, ...entry });
                            });
                        }
                    }
                    setMasterTimetable(entries);
                }
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetchData();
    }, []);

    const handleSelectStudentFromSearch = (student: Student) => {
        setSelectedSearchStudentName(student.name);
        setSelectedSearchStudentUid(student.uid);
        if (student.programmeId) setSelectedProgrammeId(student.programmeId);
        if (student.intakeId) {
            setSelectedIntakeId(student.intakeId);
            const intake = intakes.find(i => i.id === student.intakeId);
            if (intake) {
                get(ref(db, 'settings/academicCalendar')).then(calSnap => {
                    const startStr = parseIntakeDate(intake.name);
                    if (calSnap.exists() && startStr) {
                        const state = calculateAcademicState(startStr, new Date(), calSnap.val().standardCycles, Object.values(calSnap.val().anomalies || {}));
                        setSelectedYear(String(state.year));
                        setSelectedSemesterInYear(String(state.semester));
                    }
                });
            }
        }
        setIsSearchOpen(false);
        setStudentSearchInput('');
    };

    const handleClearSearch = () => {
        setSelectedSearchStudentName(null);
        setSelectedSearchStudentUid(null);
    };

    React.useEffect(() => {
        if (!selectedIntakeId || (selectedYear && selectedSemesterInYear)) return;
        const intake = intakes.find(i => i.id === selectedIntakeId);
        if (!intake) return;
        const fetchStanding = async () => {
            const calendarSnap = await get(ref(db, 'settings/academicCalendar'));
            const intakeStartStr = parseIntakeDate(intake.name);
            if (calendarSnap.exists() && intakeStartStr) {
                const state = calculateAcademicState(intakeStartStr, new Date(), calendarSnap.val().standardCycles, Object.values(calendarSnap.val().anomalies || {}));
                if (!selectedYear) setSelectedYear(String(state.year));
                if (!selectedSemesterInYear) setSelectedSemesterInYear(String(state.semester));
            }
        };
        fetchStanding();
    }, [selectedIntakeId, intakes]);

    const targetSemesterId = React.useMemo(() => {
        if (!selectedIntakeId || !selectedYear || !selectedSemesterInYear) return null;
        return allSemesters.find(s => s.intakeId === selectedIntakeId && s.year === Number(selectedYear) && s.semesterInYear === Number(selectedSemesterInYear))?.id || null;
    }, [allSemesters, selectedIntakeId, selectedYear, selectedSemesterInYear]);

    React.useEffect(() => {
        const fetchCourses = async () => {
            const allCoursesSnap = await get(ref(db, 'courses'));
            if (!allCoursesSnap.exists()) return;
            const allCoursesData = allCoursesSnap.val();

            if (loadAllCourses) {
                setCourses(Object.keys(allCoursesData).map(id => ({ id, ...allCoursesData[id] })).filter(c => c.status === 'active'));
                return;
            }

            if (!selectedProgrammeId || !selectedIntakeId || !targetSemesterId) { setCourses([]); setSelectedCourseIds([]); return; }

            const coursePathsSnap = await get(ref(db, 'coursePaths'));
            if (coursePathsSnap.exists()) {
                const paths = Object.values(coursePathsSnap.val() || {});
                const userPath: any = paths.find((p: any) => p.intakeId === selectedIntakeId && p.programmeId === selectedProgrammeId);

                if (userPath?.semesters?.[targetSemesterId]) {
                    const courseIds = userPath.semesters[targetSemesterId].courses || [];
                    const foundCourses = courseIds.map((id: string) => ({ id, ...allCoursesData[id] })).filter((c: any) => c && c.status === 'active');
                    setCourses(foundCourses);
                    setSelectedCourseIds(prev => prev.filter(id => foundCourses.some(c => c.id === id)));
                } else { setCourses([]); setSelectedCourseIds([]); }
            }
        };
        fetchCourses();
    }, [selectedProgrammeId, selectedIntakeId, targetSemesterId, loadAllCourses]);

    React.useEffect(() => {
        if (selectedCourseIds.length === 0) { setStudentsInRoster([]); setScores({}); return; }
        const fetchRosterData = async () => {
            setLoading(true);
            try {
                const newScores: AllScores = {};
                for (const courseId of selectedCourseIds) {
                    if (targetSemesterId) {
                        const sSnap = await get(ref(db, `assessments/${targetSemesterId}/${courseId}`));
                        newScores[courseId] = sSnap.exists() ? sSnap.val() : {};
                    }
                }
                setScores(newScores);

                let roster: Student[] = [];
                if (selectedSearchStudentUid) {
                    const found = allStudents.find(s => s.uid === selectedSearchStudentUid);
                    roster = found ? [found] : [];
                } else {
                    const registeredUids = new Set<string>();
                    if (targetSemesterId) {
                        Object.keys(registrations).forEach(uid => { if (registrations[uid][targetSemesterId]) registeredUids.add(uid); });
                    }

                    if (registeredUids.size > 0) {
                        roster = allStudents.filter(s => registeredUids.has(s.uid));
                    } else if (selectedProgrammeId && selectedIntakeId) {
                        roster = allStudents.filter(s => s.programmeId === selectedProgrammeId && s.intakeId === selectedIntakeId);
                    } else { roster = allStudents; }
                }
                setStudentsInRoster(roster.sort((a,b) => a.name.localeCompare(b.name)));
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetchRosterData();
    }, [selectedCourseIds, targetSemesterId, allStudents, selectedSearchStudentUid, selectedProgrammeId, selectedIntakeId, registrations]);

    const handleScoreChange = (courseId: string, studentUid: string, componentId: string, value: string) => {
        const numericValue = value === '' ? undefined : Number(value);
        if (numericValue !== undefined && (numericValue < 0 || numericValue > 100)) return;
        setScores(prev => ({
            ...prev,
            [courseId]: {
                ...(prev[courseId] || {}),
                [studentUid]: { 
                    ...(prev[courseId]?.[studentUid] || {}), 
                    [componentId]: { ...(prev[courseId]?.[studentUid]?.[componentId] || {}), score: numericValue } 
                }
            }
        }));
    };

    const handleSave = async () => {
        if (selectedCourseIds.length === 0 || !targetSemesterId) return;
        setSaving(true);
        try {
            const updates: Record<string, any> = {};
            const semester = allSemesters.find(s => s.id === targetSemesterId);
            const semesterName = semester?.name || 'Current Semester';
            
            for (const courseId of selectedCourseIds) {
                updates[`assessments/${targetSemesterId}/${courseId}`] = scores[courseId] || {};

                for (const student of studentsInRoster) {
                    const regRef = ref(db, `registrations/${student.uid}/${targetSemesterId}`);
                    const regSnap = await get(regRef);
                    
                    if (!regSnap.exists()) {
                        const invRef = push(ref(db, `invoices/${student.uid}`));
                        updates[`invoices/${student.uid}/${invRef.key}`] = {
                            invoiceId: invRef.key,
                            semester: semesterName,
                            semesterId: targetSemesterId,
                            dateCreated: new Date().toISOString(),
                            totalTuition: 0, totalMandatoryFees: 0, totalOptionalFees: 0
                        };
                        updates[`registrations/${student.uid}/${targetSemesterId}`] = {
                            courses: [courseId],
                            status: 'Completed',
                            semesterName: semesterName,
                            registrationDate: new Date().toISOString(),
                            programmeId: student.programmeId || selectedProgrammeId,
                            intakeId: student.intakeId || selectedIntakeId,
                            invoiceId: invRef.key
                        };
                    } else {
                        const currentCourses = regSnap.val().courses || [];
                        if (!currentCourses.includes(courseId)) {
                            updates[`registrations/${student.uid}/${targetSemesterId}/courses`] = [...currentCourses, courseId];
                        }
                    }
                }
            }
            await update(ref(db), updates);

            // Handle Email Notifications
            if (sendEmails) {
                for (const student of studentsInRoster) {
                    if (!student.email) continue;

                    let studentCoursesHtml = "";
                    let hasNewData = false;

                    for (const courseId of selectedCourseIds) {
                        const course = courses.find(c => c.id === courseId);
                        const template = course?.assessmentTemplateId ? templates[course.assessmentTemplateId] : null;
                        const components = template?.components ? Object.entries(template.components).map(([id, c]: [string, any]) => ({ id, ...c })) : [];
                        const studentScores = scores[courseId]?.[student.uid];

                        if (studentScores && Object.keys(studentScores).length > 0) {
                            hasNewData = true;
                            studentCoursesHtml += `<div style="margin-bottom: 15px;"><h4 style="margin: 0; color: #4c1d95;">${course?.code}: ${course?.name}</h4><ul style="margin: 5px 0; padding-left: 20px;">`;
                            components.forEach(comp => {
                                const score = studentScores[comp.id]?.score;
                                if (score !== undefined) {
                                    studentCoursesHtml += `<li>${comp.name}: <strong>${score}%</strong></li>`;
                                }
                            });
                            studentCoursesHtml += "</ul></div>";
                        }
                    }

                    if (hasNewData) {
                        const finalSubject = emailSubject
                            .replace(/\[Name\]/g, student.name)
                            .replace(/\[CourseCode\]/g, selectedCourseIds.length === 1 ? courses.find(c => c.id === selectedCourseIds[0])?.code || '' : 'Multiple Courses')
                            .replace(/\[Semester\]/g, semesterName);

                        const finalBody = emailBody
                            .replace(/\[Name\]/g, student.name)
                            .replace(/\[CourseName\]/g, selectedCourseIds.length === 1 ? courses.find(c => c.id === selectedCourseIds[0])?.name || '' : 'your enrolled courses')
                            .replace(/\[CourseCode\]/g, selectedCourseIds.length === 1 ? courses.find(c => c.id === selectedCourseIds[0])?.code || '' : 'Multiple Courses')
                            .replace(/\[Semester\]/g, semesterName)
                            .replace(/\[Scores\]/g, studentCoursesHtml);

                        await sendEmail({ to: [student.email], subject: finalSubject, body: finalBody }).catch(e => console.error("Email fail:", e));
                    }
                }
            }

            toast({ title: "Results Recorded", description: `${selectedCourseIds.length} course(s) updated and notifications triggered.` });
        } catch (e: any) { toast({ variant: 'destructive', title: "Save Failed", description: e.message }); }
        finally { setSaving(false); }
    };

    const filteredRoster = studentsInRoster.filter(s => s.name.toLowerCase().includes(rosterSearch.toLowerCase()) || s.id.toLowerCase().includes(rosterSearch.toLowerCase()));
    const searchableStudents = allStudents.filter(s => s.name.toLowerCase().includes(studentSearchInput.toLowerCase()) || s.id.toLowerCase().includes(studentSearchInput.toLowerCase()));

    const currentIntakeName = intakes.find(i => i.id === selectedIntakeId)?.name;
    const timetableEntries = masterTimetable.filter(e => {
        const matchesSemester = e.semesterId === 'master' || e.semesterId === targetSemesterId;
        const matchesIntake = e.intakeName === currentIntakeName || e.intakeName === 'Master';
        return matchesSemester && matchesIntake;
    });

    const getCourseGradingStatus = (courseId: string) => {
        const courseScores = scores[courseId] || {};
        const registeredForCourse = studentsInRoster.filter(s => {
            const reg = registrations[s.uid]?.[targetSemesterId || ''];
            return reg?.courses?.includes(courseId);
        });
        
        if (registeredForCourse.length === 0) return { count: 0, total: 0, percentage: 0 };
        
        let gradedCount = 0;
        registeredForCourse.forEach(s => {
            const studentScores = courseScores[s.uid];
            if (studentScores && Object.values(studentScores).some(comp => comp.score !== undefined)) {
                gradedCount++;
            }
        });

        return {
            count: gradedCount,
            total: registeredForCourse.length,
            percentage: (gradedCount / registeredForCourse.length) * 100
        };
    };

    const handleSelectFromTimetable = (courseId: string) => {
        setSelectedCourseIds(prev => {
            if (prev.includes(courseId)) return prev;
            return [...prev, courseId];
        });
        setIsTimetableOpen(false);
        // Add a small delay to allow accordion to render if it was just added
        setTimeout(() => {
            const element = document.getElementById(`course-accordion-${courseId}`);
            if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    };

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="font-headline text-2xl">Continuous Assessment Entry</CardTitle>
                            <CardDescription>Record results for a specific cohort and academic phase.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            {selectedIntakeId && targetSemesterId && (
                                <Button variant="outline" onClick={() => setIsTimetableOpen(true)} className="h-10 border-primary/30">
                                    <CalendarDays className="h-4 w-4 mr-2 text-primary" />
                                    Class Timetable
                                </Button>
                            )}
                            {selectedSearchStudentUid && (
                                <Button variant="ghost" size="sm" onClick={handleClearSearch} className="h-10 text-destructive">
                                    <X className="h-4 w-4 mr-1"/> Clear Focus
                                </Button>
                            )}
                            <Popover open={isSearchOpen} onOpenChange={setIsSearchOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-[200px] md:w-[300px] justify-between text-left font-normal border-primary/30 bg-background">
                                        <div className="flex items-center gap-2"><User className="h-4 w-4 text-primary" /><span className="truncate">{selectedSearchStudentName || "Jump to Student..."}</span></div>
                                        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0" align="end">
                                    <div className="p-2">
                                        <div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search student body..." className="pl-8 h-9" value={studentSearchInput} onChange={e => setStudentSearchInput(e.target.value)} /></div>
                                    </div>
                                    <Separator /><ScrollArea className="h-64"><div className="p-1">{searchableStudents.map(student => (
                                        <Button key={student.uid} variant="ghost" className="w-full justify-start text-xs py-2 h-auto" onClick={() => handleSelectStudentFromSearch(student)}>
                                            <div className="flex flex-col text-left">
                                                <span className="font-bold">{student.name}</span>
                                                <span className="text-[10px] text-muted-foreground">{student.id}</span>
                                            </div>
                                        </Button>
                                    ))}</div></ScrollArea>
                                </PopoverContent>
                            </Popover>
                            <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => setIsEmailConfigOpen(true)} title="Email Notification Settings">
                                <Settings2 className="h-4 w-4"/>
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader>
                    <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-4">
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Programme</Label><Select value={selectedProgrammeId} onValueChange={(val) => { setSelectedProgrammeId(val); handleClearSearch(); }}><SelectTrigger className="bg-background"><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent>{programmes.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Intake</Label><Select value={selectedIntakeId} onValueChange={(val) => { setSelectedIntakeId(val); handleClearSearch(); }}><SelectTrigger className="bg-background"><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent>{intakes.map(i=><SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Study Year</Label><Select value={selectedYear} onValueChange={setSelectedYear}><SelectTrigger className="bg-background"><SelectValue placeholder="Year..."/></SelectTrigger><SelectContent>{[1,2,3,4,5].map(y => <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Semester</Label><Select value={selectedSemesterInYear} onValueChange={setSelectedSemesterInYear}><SelectTrigger className="bg-background"><SelectValue placeholder="Sem..."/></SelectTrigger><SelectContent>{[1,2,3].map(s => <SelectItem key={s} value={String(s)}>Semester {s}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-1 lg:col-span-2">
                            <div className="flex items-center justify-between mb-1"><Label className="text-[10px] font-black uppercase">Course(s)</Label><div className="flex items-center gap-1.5"><Switch id="ca-load-all" checked={loadAllCourses} onCheckedChange={setLoadAllCourses} className="h-4 w-7" /><Label htmlFor="ca-load-all" className="text-[8px] font-bold uppercase text-muted-foreground">Catalog Mode</Label></div></div>
                            <Popover shadow="lg">
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between bg-background font-normal" disabled={!loadAllCourses && courses.length === 0}>
                                        <span className="truncate">{selectedCourseIds.length > 0 ? `${selectedCourseIds.length} Courses Selected` : "Select Course(s)..."}</span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                    <ScrollArea className="h-64">
                                        <div className="p-2 space-y-1">
                                            {courses.map(c => (
                                                <div key={c.id} className="flex items-center gap-2 p-2 hover:bg-muted rounded-md transition-colors">
                                                    <Checkbox id={`course-${c.id}`} checked={selectedCourseIds.includes(c.id)} onCheckedChange={(checked) => setSelectedCourseIds(prev => checked ? [...prev, c.id] : prev.filter(id => id !== c.id))} />
                                                    <Label htmlFor={`course-${c.id}`} className="text-xs flex-1 cursor-pointer"><span className="font-bold">{c.code}</span> - {c.name}</Label>
                                                </div>
                                            ))}
                                            {courses.length === 0 && <p className="text-center py-10 text-xs text-muted-foreground italic">No courses found.</p>}
                                        </div>
                                    </ScrollArea>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {selectedCourseIds.length > 0 && selectedYear && selectedSemesterInYear && (<Alert className="bg-blue-50 border-blue-200"><Info className="h-4 w-4 text-blue-600" /><AlertTitle className="text-xs font-black uppercase tracking-wider text-blue-800">Recording for: Year {selectedYear}, Sem {selectedSemesterInYear}</AlertTitle><AlertDescription className="text-xs text-blue-700 italic">Scores will be saved specifically for the chosen academic phase.</AlertDescription></Alert>)}
                    {loading ? <Skeleton className="h-64 w-full" /> : selectedCourseIds.length > 0 ? (
                        <div className="space-y-6">
                            <div className="relative max-w-sm"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/><Input placeholder="Filter visible roster..." className="pl-8" value={rosterSearch} onChange={e => setRosterSearch(e.target.value)}/></div>
                            <Accordion type="multiple" defaultValue={selectedCourseIds} className="w-full space-y-4">
                                {selectedCourseIds.map(courseId => {
                                    const course = courses.find(c => c.id === courseId);
                                    if (!course) return null;
                                    const template = course.assessmentTemplateId ? templates[course.assessmentTemplateId] : null;
                                    const components = template?.components ? Object.entries(template.components).map(([id, c]: [string, any]) => ({ id, ...c })) : [];
                                    const stats = getCourseGradingStatus(courseId);

                                    return (
                                        <AccordionItem value={courseId} key={courseId} id={`course-accordion-${courseId}`} className="border rounded-lg bg-card overflow-hidden shadow-sm">
                                            <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 hover:no-underline">
                                                <div className="flex flex-col md:flex-row md:items-center gap-3 w-full pr-4 text-left">
                                                    <BookOpen className="h-5 w-5 text-primary shrink-0"/>
                                                    <div className="flex-1">
                                                        <span className="font-bold">{course.code}: {course.name}</span>
                                                        <p className="text-[10px] text-muted-foreground uppercase font-medium">{template?.name || "No Structure Assigned"}</p>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[10px] font-black uppercase text-muted-foreground">Progress</span>
                                                            <span className={cn("text-xs font-bold", stats.percentage === 100 ? "text-green-600" : "text-primary")}>
                                                                {stats.count} / {stats.total} Graded
                                                            </span>
                                                        </div>
                                                        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                                                            <div className={cn("h-full transition-all", stats.percentage === 100 ? "bg-green-500" : "bg-primary")} style={{ width: `${stats.percentage}%` }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="p-4 pt-0">
                                                {components.length > 0 ? (
                                                    <div className="overflow-x-auto border rounded-md">
                                                        <Table>
                                                            <TableHeader className="bg-muted/30">
                                                                <TableRow>
                                                                    <TableHead className="min-w-[150px]">Student</TableHead>
                                                                    {components.map(c=><TableHead key={c.id} className="text-center">{c.name} ({c.weight}%)</TableHead>)}
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {filteredRoster.map(s => {
                                                                    const isRegistered = registrations[s.uid]?.[targetSemesterId || '']?.courses?.includes(courseId);
                                                                    if (!isRegistered && !selectedSearchStudentUid) return null;
                                                                    
                                                                    return (
                                                                        <TableRow key={s.uid} className={cn(s.uid === selectedSearchStudentUid && "bg-primary/5")}>
                                                                            <TableCell>
                                                                                <div className="flex flex-col">
                                                                                    <span className="font-bold text-xs">{s.name}</span>
                                                                                    <span className="text-[10px] text-muted-foreground">{s.id}</span>
                                                                                </div>
                                                                            </TableCell>
                                                                            {components.map(c => (
                                                                                <TableCell key={c.id} className="text-center">
                                                                                    <Input 
                                                                                        type="number" 
                                                                                        className="w-16 h-8 mx-auto text-center font-bold text-xs" 
                                                                                        value={scores[courseId]?.[s.uid]?.[c.id]?.score ?? ''} 
                                                                                        onChange={e => handleScoreChange(courseId, s.uid, c.id, e.target.value)} 
                                                                                    />
                                                                                </TableCell>
                                                                            ))}
                                                                        </TableRow>
                                                                    )
                                                                })}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                ) : (
                                                    <div className="p-10 border-2 border-dashed rounded-lg text-center bg-muted/10">
                                                        <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground opacity-50 mb-2"/>
                                                        <p className="text-sm font-medium">This course has no grading structure linked.</p>
                                                        <Button variant="link" size="sm" asChild className="mt-2"><Link href="/admin/academics/assessment-setup">Go to Assessment Setup &rarr;</Link></Button>
                                                    </div>
                                                )}
                                            </AccordionContent>
                                        </AccordionItem>
                                    );
                                })}
                            </Accordion>
                        </div>
                    ) : (
                        <div className="py-20 text-center text-muted-foreground border-2 border-dashed rounded-xl bg-muted/5">
                            <Layers className="mx-auto h-12 w-12 opacity-20 mb-4" />
                            <h3 className="text-lg font-bold">No Course Selected</h3>
                            <p className="text-sm max-w-xs mx-auto">Please select the courses you wish to grade from the filter bar above or via the Class Timetable.</p>
                        </div>
                    )}
                </CardContent>
                {selectedCourseIds.length > 0 && filteredRoster.length > 0 && (
                    <CardFooter className="justify-end border-t pt-6">
                        <Button onClick={handleSave} disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Finalize & Save All Scores
                        </Button>
                    </CardFooter>
                )}
            </Card>

            {/* Timetable Dialog */}
            <Dialog open={isTimetableOpen} onOpenChange={setIsTimetableOpen}>
                <DialogContent className="max-w-[95vw] md:max-w-6xl h-[90vh] flex flex-col">
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <DialogTitle>Class Timetable: {currentIntakeName}</DialogTitle>
                                <DialogDescription>Click on a class session to record or check its results.</DialogDescription>
                            </div>
                            <Badge variant="secondary" className="gap-1.5 font-bold h-10 px-4 text-primary">
                                <Info className="h-4 w-4"/>
                                Viewing: Year {selectedYear}, Sem {selectedSemesterInYear}
                            </Badge>
                        </div>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto py-4">
                        <div className="border rounded-lg overflow-hidden bg-muted/10 min-w-[800px] shadow-inner">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="w-32 border-r font-bold text-center">DAY</TableHead>
                                        {teachingTimes.slots.map((slot, index) => (
                                            <TableHead key={index} className="text-center font-bold border-r text-xs">{slot.startTime} - {slot.endTime}</TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {calendarDays.slice(1, 6).map(dayName => (
                                        <TableRow key={dayName}>
                                            <TableCell className="font-bold text-xs border-r text-center bg-muted/20">
                                                <span className="uppercase text-[10px] opacity-70">{dayName}</span>
                                            </TableCell>
                                            {teachingTimes.slots.map((slot, sIdx) => {
                                                const slotStart = timeToMinutes(slot.startTime);
                                                const slotEnd = timeToMinutes(slot.endTime);
                                                const sessionsInSlot = timetableEntries.filter(e => 
                                                    e.day === dayName && 
                                                    timeToMinutes(e.startTime) >= slotStart && 
                                                    timeToMinutes(e.startTime) < slotEnd
                                                );

                                                return (
                                                    <TableCell key={sIdx} className="p-2 border-r align-top min-h-[100px]">
                                                        <div className="space-y-2">
                                                            {sessionsInSlot.map((entry, eIdx) => {
                                                                const course = allCourses[entry.courseId];
                                                                const stats = getCourseGradingStatus(entry.courseId);
                                                                const isFullyGraded = stats.total > 0 && stats.count === stats.total;

                                                                return (
                                                                    <div 
                                                                        key={eIdx} 
                                                                        className={cn(
                                                                            "p-2 rounded-md border bg-background shadow-sm transition-all cursor-pointer hover:ring-2 hover:ring-primary",
                                                                            isFullyGraded ? "border-green-500 bg-green-50/20" : "border-primary/20",
                                                                            selectedCourseIds.includes(entry.courseId) && "ring-2 ring-primary"
                                                                        )}
                                                                        onClick={() => handleSelectFromTimetable(entry.courseId)}
                                                                    >
                                                                        <div className="flex justify-between items-start gap-1">
                                                                            <p className="font-bold text-[10px] text-primary leading-tight line-clamp-2">{entry.courseCode}: {entry.courseName}</p>
                                                                            {isFullyGraded && <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0"/>}
                                                                        </div>
                                                                        <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-1">
                                                                            <MapPin className="h-2.5 w-2.5" /> {entry.venue}
                                                                        </div>
                                                                        <div className="mt-2 pt-1 border-t flex flex-col gap-1">
                                                                            <div className="flex justify-between text-[8px] font-black uppercase tracking-tighter">
                                                                                <span className="opacity-60">Status</span>
                                                                                <span className={cn(isFullyGraded ? "text-green-600" : "text-primary")}>
                                                                                    {stats.count}/{stats.total}
                                                                                </span>
                                                                            </div>
                                                                            <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                                                                                <div className={cn("h-full", isFullyGraded ? "bg-green-500" : "bg-primary")} style={{ width: `${stats.percentage}%` }} />
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
                    </div>
                    <DialogFooter className="border-t pt-4">
                        <DialogClose asChild><Button variant="outline">Close Timetable</Button></DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isEmailConfigOpen} onOpenChange={setIsEmailConfigOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary"/> Results Notification Settings</DialogTitle>
                        <DialogDescription>Configure the email sent to students after their scores are saved.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="flex items-center space-x-2 p-4 border rounded-md bg-muted/20">
                            <Switch id="email-toggle" checked={sendEmails} onCheckedChange={setSendEmails} />
                            <Label htmlFor="email-toggle" className="font-bold">Enable Email Notifications on Save</Label>
                        </div>
                        <div className="space-y-1">
                            <Label>Email Subject</Label>
                            <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label>Email Body (HTML)</Label>
                            <Textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={10} className="font-mono text-xs" />
                            <div className="p-3 bg-muted/50 rounded text-[10px] space-y-1">
                                <p className="font-bold">AVAILABLE PLACEHOLDERS:</p>
                                <p><code>[Name]</code> - Student full name</p>
                                <p><code>[CourseCode]</code> - Course code</p>
                                <p><code>[CourseName]</code> - Course title</p>
                                <p><code>[Semester]</code> - Semester name</p>
                                <p><code>[Scores]</code> - The list of assessment components and their marks</p>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Close & Save Preferences</Button></DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
