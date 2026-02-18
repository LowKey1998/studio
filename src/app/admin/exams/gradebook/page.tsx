'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Download, BookCheck, Search, CalendarDays, User, ChevronsUpDown } from "lucide-react";
import { db } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

type Student = { uid: string; id: string; name: string; programmeId?: string; intakeId?: string; };
type Programme = { id: string; name: string; gradingScale?: Record<string, any>; };
type Intake = { id: string; name: string; };
type Semester = { id: string; name: string; intakeId: string; year: number; semesterInYear: number; status: 'Open' | 'Closed' | 'Archived'; };
type Course = { id: string; name: string; code: string; assessmentTemplateId?: string; };

type GradeResult = { student: Student; componentScores: Record<string, number | null>; caMark: number | null; finalExamScore: number | null; finalMark: number | null; grade: string; };

export default function GradebookPage() {
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
    const [templateComponents, setTemplateComponents] = React.useState<any[]>([]);
    
    const [isSearchOpen, setIsSearchOpen] = React.useState(false);
    const [studentSearchInput, setStudentSearchInput] = React.useState('');
    const [selectedSearchStudentName, setSelectedSearchStudentName] = React.useState<string | null>(null);

    const [loading, setLoading] = React.useState(true);
    const [loadingGrades, setLoadingGrades] = React.useState(false);
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
        setSelectedSearchStudentName(student.name);
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
            if (calSnap.exists() && intakeStartStr) {
                const state = calculateAcademicState(intakeStartStr, new Date(), calSnap.val().standardCycles, Object.values(calSnap.val().anomalies || {}));
                if (!selectedYear) setSelectedYear(String(state.year));
                if (!selectedSemesterInYear) setSelectedSemesterInYear(String(state.semester));
            }
        });
    }, [selectedIntakeId, intakes, selectedYear, selectedSemesterInYear]);

    const targetSemesterId = React.useMemo(() => {
        if (!selectedIntakeId || !selectedYear || !selectedSemesterInYear) return null;
        return allSemesters.find(s => s.intakeId === selectedIntakeId && s.year === Number(selectedYear) && s.semesterInYear === Number(selectedSemesterInYear))?.id || null;
    }, [allSemesters, selectedIntakeId, selectedYear, selectedSemesterInYear]);

    // Courses
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

    // Grades
    React.useEffect(() => {
        if (!selectedCourseId || !targetSemesterId) { setGradeResults([]); setTemplateComponents([]); return; }
        const fetchGrades = async () => {
            setLoadingGrades(true);
            try {
                const [rSnap, aSnap, pSnap, tSnap, policySnap] = await Promise.all([
                    get(ref(db, 'registrations')), get(ref(db, `assessments/${targetSemesterId}/${selectedCourseId}`)), 
                    get(ref(db, 'programmes')), get(ref(db, 'settings/assessmentTemplates')), get(ref(db, 'settings/finalExamPolicy'))
                ]);

                const regs = rSnap.val() || {};
                const assessments = aSnap.val() || {};
                const prog = pSnap.val()[selectedProgrammeId];
                const templates = tSnap.val() || {};
                const examWeight = policySnap.exists() ? policySnap.val().weight : 60;
                
                const course = courses.find(c => c.id === selectedCourseId);
                const template = course?.assessmentTemplateId ? templates[course.assessmentTemplateId] : null;
                const components = template?.components ? Object.entries(template.components).map(([id, c]: [string, any]) => ({ id, ...c })) : [];
                setTemplateComponents(components);

                const scale = prog?.gradingScale ? Object.values(prog.gradingScale) : [];
                const uids: string[] = [];
                for (const uid in regs) { if (regs[uid][targetSemesterId]?.courses?.includes(selectedCourseId)) uids.push(uid); }
                
                const results: GradeResult[] = uids.map(uid => {
                    const student = allStudents.find(s => s.uid === uid)!;
                    const scores = assessments[uid] || {};
                    let ca: number | null = 0, weight = 0;
                    const cScores: Record<string, number | null> = {};
                    components.forEach(c => {
                        const s = scores[c.id]?.score;
                        cScores[c.id] = s ?? null;
                        if(s !== undefined) { ca! += s * (c.weight / 100); weight += c.weight; }
                    });
                    if (weight === 0) ca = null;
                    const exam = scores.finalExam?.score ?? null;
                    const final = (ca !== null && exam !== null) ? (ca * ((100 - examWeight)/100)) + (exam * (examWeight/100)) : null;
                    const grade = final !== null ? (scale.find((g: any) => final! >= g.minScore && final! <= g.maxScore)?.grade || 'N/A') : 'N/A';
                    return { student: { uid, id: student.id, name: student.name, programmeId: student.programmeId }, componentScores: cScores, caMark: ca, finalExamScore: exam, finalMark: final, grade };
                });
                setGradeResults(results);
            } catch (e) { console.error(e); }
            finally { setLoadingGrades(false); }
        };
        fetchGrades();
    }, [selectedCourseId, targetSemesterId, courses, selectedProgrammeId, allStudents]);

    const handleDownload = () => {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.text(`Gradebook - ${selectedCourseId}`, 14, 22);
        const head = [["ID", "Name", ...templateComponents.map(c => c.name), "CA Mark", "Final Exam", "Final Mark", "Grade"]];
        const body = gradeResults.map(r => [r.student.id, r.student.name, ...templateComponents.map(c => r.componentScores[c.id] ?? '-'), r.caMark?.toFixed(1) ?? '-', r.finalExamScore?.toFixed(1) ?? '-', r.finalMark?.toFixed(1) ?? '-', r.grade]);
        (doc as any).autoTable({ head, body, startY: 30, styles: { fontSize: 8 } });
        doc.save(`Gradebook_${selectedCourseId}.pdf`);
    };

    const searchableStudents = allStudents.filter(s => s.name.toLowerCase().includes(studentSearchInput.toLowerCase()) || s.id.toLowerCase().includes(studentSearchInput.toLowerCase()));

    return (
        <Card className="shadow-lg border-0">
            <CardHeader className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-2xl font-headline">Course Gradebook</CardTitle>
                        <CardDescription>Consolidated results for the active academic phase.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Label className="text-xs font-bold uppercase text-muted-foreground whitespace-nowrap">Step 1: Find Student</Label>
                        <Popover open={isSearchOpen} onOpenChange={setIsSearchOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-[300px] justify-between text-left font-normal border-primary/30">
                                    <div className="flex items-center gap-2">
                                        <User className="h-4 w-4 text-primary" />
                                        <span>{selectedSearchStudentName || "Search Student..."}</span>
                                    </div>
                                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="end">
                                <div className="p-2">
                                    <div className="relative">
                                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input placeholder="Search name or ID..." className="h-9 pl-8" value={studentSearchInput} onChange={e => setStudentSearchInput(e.target.value)} />
                                    </div>
                                </div>
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
                        <div className="flex justify-end"><Button variant="outline" onClick={handleDownload}><Download className="mr-2 h-4 w-4"/>Export PDF</Button></div>
                        <div className="border rounded-lg shadow-sm"><Table>
                            <TableHeader className="bg-muted/50"><TableRow><TableHead>Student</TableHead><TableHead>ID</TableHead>{templateComponents.map(c=><TableHead key={c.id} className="text-center">{c.name}</TableHead>)}<TableHead className="text-center font-bold">Final Mark</TableHead><TableHead className="text-center font-bold">Grade</TableHead></TableRow></TableHeader>
                            <TableBody>{gradeResults.map(res => (
                                <TableRow key={res.student.uid}><TableCell className="font-medium">{res.student.name}</TableCell><TableCell className="font-mono text-xs">{res.student.id}</TableCell>{templateComponents.map(c=><TableCell key={c.id} className="text-center">{res.componentScores[c.id]?.toFixed(1) ?? '-'}</TableCell>)}<TableCell className="text-right font-bold">{res.finalMark?.toFixed(1) ?? 'N/A'}</TableCell><TableCell className="text-center font-bold">{res.grade}</TableCell></TableRow>
                            ))}</TableBody>
                        </Table></div>
                    </div>
                ) : <Alert><AlertCircle className="h-4 w-4"/><AlertTitle>Information</AlertTitle><AlertDescription>{!selectedCourseId ? "Select criteria or search for a student to view the gradebook." : "No results available for this selection."}</AlertDescription></Alert>}
            </CardContent>
        </Card>
    );
}
