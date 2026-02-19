'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Search, User, ChevronsUpDown, X, Info, BookOpen, Layers } from "lucide-react";
import { db } from '@/lib/firebase';
import { ref, get, push, onValue, update } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

type Student = {
    uid: string;
    id: string;
    name: string;
    programmeId?: string;
    intakeId?: string;
};

type Programme = { id: string; name: string; };
type Intake = { id: string; name: string; };
type Semester = { id: string; name: string; intakeId: string; year: number; semesterInYear: number; status: 'Open' | 'Closed' | 'Archived'; };
type Course = { id: string; name: string; code: string; };

type AssessmentScore = { score?: number; feedback?: string; };
type FinalExamScore = { finalExam?: AssessmentScore };
type AllScores = Record<string, Record<string, FinalExamScore>>;

export default function FinalExamEntryPage() {
    const [allStudents, setAllStudents] = React.useState<Student[]>([]);
    const [programmes, setProgrammes] = React.useState<Programme[]>([]);
    const [intakes, setIntakes] = React.useState<Intake[]>([]);
    const [allSemesters, setAllSemesters] = React.useState<Semester[]>([]);
    
    const [selectedProgrammeId, setSelectedProgrammeId] = React.useState('');
    const [selectedIntakeId, setSelectedIntakeId] = React.useState('');
    const [selectedYear, setSelectedYear] = React.useState('');
    const [selectedSemesterInYear, setSelectedSemesterInYear] = React.useState('');
    
    const [courses, setCourses] = React.useState<Course[]>([]);
    const [selectedCourseIds, setSelectedCourseIds] = React.useState<string[]>([]);
    const [loadAllCourses, setLoadAllCourses] = React.useState(false);
    
    const [studentsInRoster, setStudentsInRoster] = React.useState<Student[]>([]);
    const [scores, setScores] = React.useState<AllScores>({});
    
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
                const [pSnap, iSnap, uSnap, sSnap] = await Promise.all([
                    get(ref(db, 'programmes')),
                    get(ref(db, 'intakes')),
                    get(ref(db, 'users')),
                    get(ref(db, 'semesters'))
                ]);
                if (pSnap.exists()) setProgrammes(Object.entries(pSnap.val()).map(([id, data]: [string, any]) => ({ id, ...data })));
                if (iSnap.exists()) setIntakes(Object.entries(iSnap.val()).map(([id, data]: [string, any]) => ({ id, ...data })).sort((a, b) => b.name.localeCompare(a.name)));
                if (uSnap.exists()) setAllStudents(Object.entries(uSnap.val()).filter(([_, u]: [string, any]) => u.role === 'Student').map(([uid, u]: [string, any]) => ({ uid, ...u })));
                if (sSnap.exists()) setAllSemesters(Object.entries(sSnap.val()).map(([id, data]: [string, any]) => ({ id, ...data })));
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
        get(ref(db, 'settings/academicCalendar')).then(calSnap => {
            const startStr = parseIntakeDate(intake.name);
            if (calSnap.exists() && startStr) {
                const state = calculateAcademicState(startStr, new Date(), calSnap.val().standardCycles, Object.values(calSnap.val().anomalies || {}));
                if (!selectedYear) setSelectedYear(String(state.year));
                if (!selectedSemesterInYear) setSelectedSemesterInYear(String(state.semester));
            }
        });
    }, [selectedIntakeId, intakes, selectedYear, selectedSemesterInYear]);

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
                } else { 
                    setCourses([]);
                    setSelectedCourseIds([]);
                }
            }
        };
        fetchCourses();
    }, [selectedProgrammeId, selectedIntakeId, targetSemesterId, loadAllCourses]);

    React.useEffect(() => {
        if (selectedCourseIds.length === 0) { setStudentsInRoster([]); setScores({}); return; }
        const fetchData = async () => {
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
                    const registrationsSnap = await get(ref(db, 'registrations'));
                    const allRegs = registrationsSnap.val() || {};
                    const registeredUids = new Set<string>();

                    if (targetSemesterId) {
                        Object.keys(allRegs).forEach(uid => {
                            if (allRegs[uid][targetSemesterId]) registeredUids.add(uid);
                        });
                    }

                    if (registeredUids.size > 0) {
                        roster = allStudents.filter(s => registeredUids.has(s.uid));
                    } else if (selectedProgrammeId && selectedIntakeId) {
                        roster = allStudents.filter(s => s.programmeId === selectedProgrammeId && s.intakeId === selectedIntakeId);
                    } else {
                        roster = allStudents;
                    }
                }
                setStudentsInRoster(roster.sort((a,b) => a.name.localeCompare(b.name)));
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetchData();
    }, [selectedCourseIds, targetSemesterId, allStudents, selectedSearchStudentUid, selectedProgrammeId, selectedIntakeId]);

    const handleScoreChange = (courseId: string, uid: string, value: string) => {
        const score = value === '' ? undefined : Number(value);
        if (score !== undefined && (score < 0 || score > 100)) return;
        setScores(prev => ({
            ...prev,
            [courseId]: {
                ...(prev[courseId] || {}),
                [uid]: {
                    ...(prev[courseId]?.[uid] || {}),
                    finalExam: { ...(prev[courseId]?.[uid]?.finalExam || {}), score }
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

            for (const courseId of selectedCourseIds) {
                updates[`assessments/${targetSemesterId}/${courseId}`] = scores[courseId] || {};

                for (const student of studentsInRoster) {
                    const regRef = ref(db, `registrations/${student.uid}/${targetSemesterId}`);
                    const regSnap = await get(regRef);
                    
                    if (!regSnap.exists()) {
                        const invRef = push(ref(db, `invoices/${student.uid}`));
                        updates[`invoices/${student.uid}/${invRef.key}`] = {
                            invoiceId: invRef.key,
                            semester: semester?.name || 'Manual Entry',
                            semesterId: targetSemesterId,
                            dateCreated: new Date().toISOString(),
                            totalTuition: 0, totalMandatoryFees: 0, totalOptionalFees: 0
                        };
                        updates[`registrations/${student.uid}/${targetSemesterId}`] = {
                            courses: [courseId],
                            status: 'Completed',
                            semesterName: semester?.name || 'Manual Entry',
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
            toast({ title: "Exam Scores Saved", description: `${selectedCourseIds.length} course(s) updated.` });
        } catch (e: any) { 
            toast({ variant: 'destructive', title: "Save Failed", description: e.message }); 
        } finally { 
            setSaving(false); 
        }
    };

    const filteredRoster = studentsInRoster.filter(s => s.name.toLowerCase().includes(rosterSearch.toLowerCase()) || s.id.toLowerCase().includes(rosterSearch.toLowerCase()));
    const searchableStudents = allStudents.filter(s => s.name.toLowerCase().includes(studentSearchInput.toLowerCase()) || s.id.toLowerCase().includes(studentSearchInput.toLowerCase()));

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="font-headline text-2xl">Final Examination Entry</CardTitle>
                            <CardDescription>Record final examination results for a specific cohort.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            {selectedSearchStudentUid && (
                                <Button variant="ghost" size="sm" onClick={handleClearSearch} className="h-10 text-destructive">
                                    <X className="h-4 w-4 mr-1"/> Clear Focus
                                </Button>
                            )}
                            <Popover open={isSearchOpen} onOpenChange={setIsSearchOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-[300px] justify-between text-left font-normal border-primary/30 bg-background">
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-primary" />
                                            <span className="truncate">{selectedSearchStudentName || "Jump to Student..."}</span>
                                        </div>
                                        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0" align="end">
                                    <div className="p-2">
                                        <div className="relative">
                                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input placeholder="Search student body..." className="h-9 pl-8" value={studentSearchInput} onChange={e => setStudentSearchInput(e.target.value)} />
                                        </div>
                                    </div>
                                    <Separator />
                                    <ScrollArea className="h-64">
                                        <div className="p-1">
                                            {searchableStudents.map(student => (
                                                <Button key={student.uid} variant="ghost" className="w-full justify-start text-xs py-2 h-auto" onClick={() => handleSelectStudentFromSearch(student)}>
                                                    <div className="flex flex-col text-left"><span className="font-bold">{student.name}</span><span className="text-[10px] text-muted-foreground">{student.id}</span></div>
                                                </Button>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader>
                    <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-4">
                        <div className="space-y-1">
                            <Label>Programme</Label>
                            <Select value={selectedProgrammeId} onValueChange={(val) => { setSelectedProgrammeId(val); handleClearSearch(); }}>
                                <SelectTrigger className="bg-background"><SelectValue placeholder="Select..."/></SelectTrigger>
                                <SelectContent>{programmes.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>Intake</Label>
                            <Select value={selectedIntakeId} onValueChange={(val) => { setSelectedIntakeId(val); handleClearSearch(); }}>
                                <SelectTrigger className="bg-background"><SelectValue placeholder="Select..."/></SelectTrigger>
                                <SelectContent>{intakes.map(i=><SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1"><Label>Study Year</Label><Select value={selectedYear} onValueChange={setSelectedYear}><SelectTrigger><SelectValue placeholder="Year..."/></SelectTrigger><SelectContent>{[1,2,3,4,5].map(y => <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-1"><Label>Semester</Label><Select value={selectedSemesterInYear} onValueChange={setSelectedSemesterInYear}><SelectTrigger><SelectValue placeholder="Sem..."/></SelectTrigger><SelectContent>{[1,2,3].map(s => <SelectItem key={s} value={String(s)}>Semester {s}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-1 lg:col-span-2">
                            <div className="flex items-center justify-between mb-1">
                                <Label className="text-[10px] font-black uppercase">Course(s)</Label>
                                <div className="flex items-center gap-1.5">
                                    <Switch id="exam-load-all" checked={loadAllCourses} onCheckedChange={setLoadAllCourses} className="h-4 w-7" />
                                    <Label htmlFor="exam-load-all" className="text-[8px] font-bold uppercase text-muted-foreground">Catalog Mode</Label>
                                </div>
                            </div>
                            <Popover>
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
                                                    <Checkbox 
                                                        id={`exam-course-${c.id}`} 
                                                        checked={selectedCourseIds.includes(c.id)} 
                                                        onCheckedChange={(checked) => setSelectedCourseIds(prev => checked ? [...prev, c.id] : prev.filter(id => id !== c.id))} 
                                                    />
                                                    <Label htmlFor={`exam-course-${c.id}`} className="text-xs flex-1 cursor-pointer">
                                                        <span className="font-bold">{c.code}</span> - {c.name}
                                                    </Label>
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
                <CardContent className="space-y-4">
                    {selectedCourseIds.length > 0 && selectedYear && selectedSemesterInYear && (
                        <Alert className="bg-blue-50 border-blue-200">
                            <Info className="h-4 w-4 text-blue-600" />
                            <AlertTitle className="text-xs font-black uppercase tracking-wider text-blue-800">Academic Target Phase: Year {selectedYear}, Sem {selectedSemesterInYear}</AlertTitle>
                            <AlertDescription className="text-xs text-blue-700 italic">Final examination results are being recorded for the specified period.</AlertDescription>
                        </Alert>
                    )}
                    {selectedCourseIds.length > 0 && filteredRoster.length > 0 ? (
                        <div className="space-y-6">
                            <div className="relative max-sm:w-full sm:max-w-sm"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Filter roster..." className="pl-8" value={rosterSearch} onChange={e => setRosterSearch(e.target.value)} /></div>
                            <Accordion type="multiple" defaultValue={selectedCourseIds} className="w-full space-y-4">
                                {selectedCourseIds.map(courseId => {
                                    const course = courses.find(c => c.id === courseId);
                                    if (!course) return null;

                                    return (
                                        <AccordionItem value={courseId} key={courseId} className="border rounded-lg bg-card overflow-hidden shadow-sm">
                                            <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 hover:no-underline font-bold">
                                                <div className="flex items-center gap-3">
                                                    <BookOpen className="h-5 w-5 text-primary"/>
                                                    <span>{course.code}: {course.name}</span>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="p-4 pt-0">
                                                <div className="border rounded-lg overflow-hidden">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Student Name</TableHead>
                                                                <TableHead>Student ID</TableHead>
                                                                <TableHead className="w-[200px]">Final Exam Score (100)</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {filteredRoster.map(s => (
                                                                <TableRow key={s.uid} className={cn(s.uid === selectedSearchStudentUid && "bg-primary/5")}>
                                                                    <TableCell className="font-medium text-xs">{s.name}</TableCell>
                                                                    <TableCell className="font-mono text-[10px] opacity-70">{s.id}</TableCell>
                                                                    <TableCell>
                                                                        <Input type="number" className="w-20 h-8 mx-auto text-center font-bold text-xs" value={scores[courseId]?.[s.uid]?.finalExam?.score ?? ''} onChange={e => handleScoreChange(courseId, s.uid, e.target.value)} />
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
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
                            <p className="text-sm max-w-xs mx-auto">{!selectedYear ? "Select academic phase details above." : "Please select courses to begin."}</p>
                        </div>
                    )}
                </CardContent>
                {selectedCourseIds.length > 0 && filteredRoster.length > 0 && (
                    <CardFooter className="justify-end border-t pt-6"><Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Finalize & Save All Exam Scores</Button></CardFooter>
                )}
            </Card>
        </div>
    );
}
