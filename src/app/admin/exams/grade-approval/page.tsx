
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, CheckCircle2, Search, CalendarDays, User, ChevronsUpDown } from "lucide-react";
import { db } from '@/lib/firebase';
import { ref, get, set, onValue } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from "@/components/ui/badge";
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

type Student = { uid: string; id: string; name: string; programmeId?: string; intakeId?: string; };
type Programme = { id: string; name: string; gradingScale?: Record<string, any>; };
type Intake = { id: string; name: string; };
type Semester = { id: string; name: string; intakeId: string; year: number; semesterInYear: number; };
type Course = { id: string; name: string; code: string; assessmentTemplateId?: string; };

type GradeResult = { student: Student; caScore: number | null; finalExamScore: number | null; finalMark: number | null; grade: string; };

export default function GradeApprovalPage() {
    const [allStudents, setAllStudents] = React.useState<Student[]>([]);
    const [programmes, setProgrammes] = React.useState<Programme[]>([]);
    const [intakes, setIntakes] = React.useState<Intake[]>([]);
    const [allSemesters, setAllSemesters] = React.useState<Semester[]>([]);
    
    const [selectedProgrammeId, setSelectedProgrammeId] = React.useState('');
    const [selectedIntakeId, setSelectedIntakeId] = React.useState('');
    const [selectedYear, setSelectedYear] = React.useState('');
    const [selectedSemesterInYear, setSelectedSemesterInYear] = React.useState('');
    
    const [courses, setCourses] = React.useState<Course[]>([]);
    const [selectedCourseId, setSelectedCourseId] = React.useState('');
    
    const [gradeResults, setGradeResults] = React.useState<GradeResult[]>([]);
    const [gradeStatus, setGradeStatus] = React.useState<'Pending' | 'Approved'>('Pending');
    
    const [isSearchOpen, setIsSearchOpen] = React.useState(false);
    const [studentSearchInput, setStudentSearchInput] = React.useState('');

    const [loading, setLoading] = React.useState(true);
    const [loadingGrades, setLoadingGrades] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const { toast } = useToast();

    // Initial Data
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
                if (pSnap.exists()) setProgrammes(Object.entries(pSnap.val()).map(([id, d]: [string, any]) => ({ id, ...d })));
                if (iSnap.exists()) setIntakes(Object.entries(iSnap.val()).map(([id, d]: [string, any]) => ({ id, ...d })).sort((a,b) => b.name.localeCompare(a.name)));
                if (uSnap.exists()) setAllStudents(Object.entries(uSnap.val()).filter(([_, u]: [string, any]) => u.role === 'Student').map(([uid, u]: [string, any]) => ({ uid, ...u })));
                if (sSnap.exists()) setAllSemesters(Object.entries(sSnap.val()).map(([id, d]: [string, any]) => ({ id, ...d })));
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetchData();
    }, []);

    const handleSelectStudentFromSearch = (student: Student) => {
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

    // Auto-Standing
    React.useEffect(() => {
        if (!selectedIntakeId || (selectedYear && selectedSemesterInYear)) return;
        const intake = intakes.find(i => i.id === selectedIntakeId);
        if (!intake) return;
        get(ref(db, 'settings/academicCalendar')).then(calSnap => {
            const startStr = parseIntakeDate(intake.name);
            if (calSnap.exists() && startStr) {
                const state = calculateAcademicState(startStr, new Date(), calSnap.val().standardCycles, Object.values(calSnap.val().anomalies || {}));
                setSelectedYear(String(state.year));
                setSelectedSemesterInYear(String(state.semester));
            }
        });
    }, [selectedIntakeId, intakes]);

    const targetSemesterId = React.useMemo(() => {
        if (!selectedIntakeId || !selectedYear || !selectedSemesterInYear) return null;
        return allSemesters.find(s => s.intakeId === selectedIntakeId && s.year === Number(selectedYear) && s.semesterInYear === Number(selectedSemesterInYear))?.id || null;
    }, [allSemesters, selectedIntakeId, selectedYear, selectedSemesterInYear]);

    // Filter Courses
    React.useEffect(() => {
        if (!selectedProgrammeId || !selectedIntakeId || !targetSemesterId) { setCourses([]); setSelectedCourseId(''); return; }
        const fetchCourses = async () => {
            const [pathSnap, allSnap] = await Promise.all([ get(ref(db, 'coursePaths')), get(ref(db, 'courses')) ]);
            if (pathSnap.exists() && allSnap.exists()) {
                const paths = Object.values(pathSnap.val() || {});
                const path: any = paths.find((p: any) => p.intakeId === selectedIntakeId && p.programmeId === selectedProgrammeId);
                const data = allSnap.val();
                if (path?.semesters?.[targetSemesterId]) {
                    setCourses((path.semesters[targetSemesterId].courses || []).map((id: string) => ({ id, ...data[id] })).filter((c: any) => c.status === 'active'));
                } else { setCourses([]); }
            }
        };
        fetchCourses();
    }, [selectedProgrammeId, selectedIntakeId, targetSemesterId]);

    // Load Grades
    React.useEffect(() => {
        if (!selectedCourseId || !targetSemesterId) { setGradeResults([]); return; }
        const fetchGrades = async () => {
            setLoadingGrades(true);
            try {
                const statusSnap = await get(ref(db, `gradeStatus/${targetSemesterId}/${selectedCourseId}`));
                setGradeStatus(statusSnap.exists() ? statusSnap.val() : 'Pending');

                const [uSnap, rSnap, aSnap, pSnap, tSnap] = await Promise.all([
                    get(ref(db, 'users')), get(ref(db, 'registrations')), get(ref(db, `assessments/${selectedCourseId}`)), get(ref(db, 'programmes')), get(ref(db, 'settings/assessmentTemplates'))
                ]);

                const regs = rSnap.val() || {};
                const users = uSnap.val() || {};
                const assessments = aSnap.val() || {};
                const programmesData = pSnap.val();
                const templates = tSnap.val() || {};
                
                const studentUids: string[] = [];
                for (const uid in regs) {
                    const reg = regs[uid][targetSemesterId];
                    if (reg?.courses?.includes(selectedCourseId) && reg.status === 'Completed') studentUids.push(uid);
                }
                
                const results: GradeResult[] = studentUids.map(uid => {
                    const studentData = users[uid];
                    const scores = assessments[uid] || {};
                    const prog = programmesData[studentData.programmeId];
                    const scale = prog?.gradingScale ? Object.values(prog.gradingScale) : [];
                    const course = courses.find(c => c.id === selectedCourseId);
                    const template = course?.assessmentTemplateId ? templates[course.assessmentTemplateId] : null;
                    
                    let caScore: number | null = null;
                    if(template && template.components) {
                        let totalWeighted = 0, totalWeight = 0;
                        Object.entries(template.components).forEach(([id, comp]: [string, any]) => {
                             if(scores[id]?.score !== undefined) {
                                totalWeighted += scores[id].score * (comp.weight / 100);
                                totalWeight += comp.weight;
                             }
                        });
                        caScore = totalWeight > 0 ? (totalWeighted / totalWeight) * 100 : null;
                    }

                    const exam = scores.finalExam?.score ?? null;
                    let mark: number | null = (caScore !== null && exam !== null) ? (caScore * 0.4) + (exam * 0.6) : null;
                    const grade = mark !== null ? (scale.find((g: any) => mark! >= g.minScore && mark! <= g.maxScore)?.grade || 'F') : 'N/A';
                    
                    return { student: { uid, id: studentData.id, name: studentData.name, programmeId: studentData.programmeId }, caScore, finalExamScore: exam, finalMark: mark, grade };
                });
                setGradeResults(results);
            } catch (e) { console.error(e); }
            finally { setLoadingGrades(false); }
        };
        fetchGrades();
    }, [selectedCourseId, targetSemesterId, courses]);

    const handleApprove = async () => {
        if (!selectedCourseId || !targetSemesterId) return;
        setSaving(true);
        try {
            await set(ref(db, `gradeStatus/${targetSemesterId}/${selectedCourseId}`), 'Approved');
            toast({ title: "Grades Approved" });
            setGradeStatus('Approved');
        } catch(e) { toast({ variant: 'destructive', title: 'Approval Failed' }); }
        finally { setSaving(false); }
    };

    const searchableStudents = allStudents.filter(s => s.name.toLowerCase().includes(studentSearchInput.toLowerCase()) || s.id.toLowerCase().includes(studentSearchInput.toLowerCase())).slice(0, 10);

    return (
        <Card className="shadow-lg border-0">
            <CardHeader className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-2xl font-headline">Grade Approval Workflow</CardTitle>
                        <CardDescription>Review and finalize grades before publication.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Label className="text-xs font-bold uppercase text-muted-foreground whitespace-nowrap">Step 1: Find Student</Label>
                        <Popover open={isSearchOpen} onOpenChange={setIsSearchOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-[300px] justify-between text-left font-normal">
                                    <div className="flex items-center gap-2"><User className="h-4 w-4 text-primary" /><span>Search Student...</span></div>
                                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="end">
                                <div className="p-2"><Input placeholder="Search name or ID..." className="h-9" value={studentSearchInput} onChange={e => setStudentSearchInput(e.target.value)} /></div>
                                <Separator />
                                <ScrollArea className="h-64">
                                    <div className="p-1">
                                        {searchableStudents.map(student => (
                                            <Button key={student.uid} variant="ghost" className="w-full justify-start text-xs py-2" onClick={() => handleSelectStudentFromSearch(student)}>
                                                <div className="flex flex-col text-left"><span className="font-bold">{student.name}</span><span className="text-[10px] text-muted-foreground">{student.id}</span></div>
                                            </Button>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
                <Separator />
                <div className="grid md:grid-cols-5 gap-4">
                    <div className="space-y-1"><Label>Programme</Label><Select value={selectedProgrammeId} onValueChange={setSelectedProgrammeId}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{programmes.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1"><Label>Intake</Label><Select value={selectedIntakeId} onValueChange={setSelectedIntakeId}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{intakes.map(i=><SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1"><Label>Year</Label><Select value={selectedYear} onValueChange={setSelectedYear}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{[1,2,3,4,5].map(y => <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1"><Label>Semester</Label><Select value={selectedSemesterInYear} onValueChange={setSelectedSemesterInYear}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{[1,2,3].map(s => <SelectItem key={s} value={String(s)}>Semester {s}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1"><Label>Course</Label><Select value={selectedCourseId} onValueChange={setSelectedCourseId} disabled={courses.length === 0}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{courses.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                </div>
            </CardHeader>
            <CardContent>
                {loadingGrades ? <Skeleton className="h-64 w-full" /> : 
                 selectedCourseId && gradeResults.length > 0 ? (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center"><h3 className="font-bold">Final Grades Preview</h3><Badge variant={gradeStatus === 'Approved' ? 'default' : 'secondary'}>{gradeStatus}</Badge></div>
                        <div className="border rounded-lg shadow-sm"><Table>
                            <TableHeader className="bg-muted/50"><TableRow><TableHead>Student</TableHead><TableHead>ID</TableHead><TableHead>CA (40%)</TableHead><TableHead>Exam (60%)</TableHead><TableHead>Final Mark</TableHead><TableHead>Grade</TableHead></TableRow></TableHeader>
                            <TableBody>{gradeResults.map(res => (
                                <TableRow key={res.student.uid}><TableCell className="font-medium">{res.student.name}</TableCell><TableCell className="font-mono text-xs">{res.student.id}</TableCell><TableCell>{res.caScore?.toFixed(1) ?? 'N/A'}</TableCell><TableCell>{res.finalExamScore?.toFixed(1) ?? 'N/A'}</TableCell><TableCell className="font-bold">{res.finalMark?.toFixed(1) ?? 'N/A'}</TableCell><TableCell className="font-bold">{res.grade}</TableCell></TableRow>
                            ))}</TableBody>
                        </Table></div>
                    </div>
                ) : <Alert><AlertCircle className="h-4 w-4"/><AlertTitle>Information</AlertTitle><AlertDescription>{!selectedCourseId ? "Select criteria or search for a student to load results." : "No results found for this course selection."}</AlertDescription></Alert>}
            </CardContent>
            {gradeResults.length > 0 && gradeStatus === 'Pending' && (
                <CardFooter className="justify-end border-t pt-6"><Button onClick={handleApprove} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Approve & Publish Grades</Button></CardFooter>
            )}
        </Card>
    );
}
