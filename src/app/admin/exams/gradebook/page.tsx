'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Download, BookCheck, Search, CalendarDays } from "lucide-react";
import { db } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';

type Student = { uid: string; id: string; name: string; programmeId: string; };
type Programme = { id: string; name: string; gradingScale?: Record<string, any>; };
type Intake = { id: string; name: string; };
type Semester = { id: string; name: string; intakeId: string; year: number; semesterInYear: number; };
type Course = { id: string; name: string; code: string; assessmentTemplateId?: string; };

type GradeResult = { student: Student; componentScores: Record<string, number | null>; caMark: number | null; finalExamScore: number | null; finalMark: number | null; grade: string; };

export default function GradebookPage() {
    const [programmes, setProgrammes] = React.useState<Programme[]>([]);
    const [selectedProgrammeId, setSelectedProgrammeId] = React.useState('');
    const [intakes, setIntakes] = React.useState<Intake[]>([]);
    const [selectedIntakeId, setSelectedIntakeId] = React.useState('');
    
    const [courses, setCourses] = React.useState<Course[]>([]);
    const [selectedCourseId, setSelectedCourseId] = React.useState('');
    
    const [gradeResults, setGradeResults] = React.useState<GradeResult[]>([]);
    const [templateComponents, setTemplateComponents] = React.useState<any[]>([]);
    const [academicStanding, setAcademicStanding] = React.useState<any>(null);
    const [targetSemesterId, setTargetSemesterId] = React.useState<string | null>(null);
    
    const [loading, setLoading] = React.useState(true);
    const [loadingGrades, setLoadingGrades] = React.useState(false);
    const { toast } = useToast();

    // Initial Data
    React.useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [pSnap, iSnap] = await Promise.all([ get(ref(db, 'programmes')), get(ref(db, 'intakes')) ]);
                if (pSnap.exists()) setProgrammes(Object.entries(pSnap.val()).map(([id, d]: [string, any]) => ({ id, ...d })));
                if (iSnap.exists()) setIntakes(Object.entries(iSnap.val()).map(([id, d]: [string, any]) => ({ id, ...d })).sort((a,b) => b.name.localeCompare(a.name)));
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetchData();
    }, []);

    // Standing
    React.useEffect(() => {
        if (!selectedIntakeId) { setAcademicStanding(null); setTargetSemesterId(null); return; }
        const fetchStanding = async () => {
            const intake = intakes.find(i => i.id === selectedIntakeId);
            if (!intake) return;
            const [calSnap, semSnap] = await Promise.all([ get(ref(db, 'settings/academicCalendar')), get(ref(db, 'semesters')) ]);
            const startStr = parseIntakeDate(intake.name);
            if (calSnap.exists() && startStr) {
                const state = calculateAcademicState(startStr, new Date(), calSnap.val().standardCycles, Object.values(calSnap.val().anomalies || {}));
                setAcademicStanding(state);
                if (semSnap.exists()) {
                    const found = Object.entries(semSnap.val() as Record<string, Semester>).find(([id, sem]) => sem.intakeId === selectedIntakeId && sem.year === state.year && sem.semesterInYear === state.semester);
                    setTargetSemesterId(found ? found[0] : null);
                }
            }
        };
        fetchStanding();
    }, [selectedIntakeId, intakes]);

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
                const [uSnap, rSnap, aSnap, pSnap, tSnap, policySnap] = await Promise.all([
                    get(ref(db, 'users')), get(ref(db, 'registrations')), get(ref(db, `assessments/${selectedCourseId}`)), 
                    get(ref(db, 'programmes')), get(ref(db, 'settings/assessmentTemplates')), get(ref(db, 'settings/finalExamPolicy'))
                ]);

                const regs = rSnap.val() || {};
                const users = uSnap.val() || {};
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
                    const student = users[uid];
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
    }, [selectedCourseId, targetSemesterId, courses, selectedProgrammeId]);

    const handleDownload = () => {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.text(`Gradebook - ${selectedCourseId}`, 14, 22);
        const head = [["ID", "Name", ...templateComponents.map(c => c.name), "CA Mark", "Final Exam", "Final Mark", "Grade"]];
        const body = gradeResults.map(r => [r.student.id, r.student.name, ...templateComponents.map(c => r.componentScores[c.id] ?? '-'), r.caMark?.toFixed(1) ?? '-', r.finalExamScore?.toFixed(1) ?? '-', r.finalMark?.toFixed(1) ?? '-', r.grade]);
        (doc as any).autoTable({ head, body, startY: 30, styles: { fontSize: 8 } });
        doc.save(`Gradebook_${selectedCourseId}.pdf`);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Course Gradebook</CardTitle>
                <CardDescription>Comprehensive weighted results for the active cohort.</CardDescription>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
                    <div className="space-y-1"><Label>Programme</Label><Select value={selectedProgrammeId} onValueChange={setSelectedProgrammeId}><SelectTrigger><SelectValue placeholder="Select programme..."/></SelectTrigger><SelectContent>{programmes.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1"><Label>Intake</Label><Select value={selectedIntakeId} onValueChange={setSelectedIntakeId}><SelectTrigger><SelectValue placeholder="Select intake..."/></SelectTrigger><SelectContent>{intakes.map(i=><SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
                    {academicStanding && (
                        <div className="space-y-1"><Label>Standing</Label><div className="flex h-10 items-center px-3 border rounded-md bg-muted/50 text-sm font-bold gap-2"><CalendarDays className="h-4 w-4 text-primary" /> Year {academicStanding.year}, Sem {academicStanding.semester}</div></div>
                    )}
                    <div className="space-y-1"><Label>Course</Label><Select value={selectedCourseId} onValueChange={setSelectedCourseId} disabled={courses.length === 0}><SelectTrigger><SelectValue placeholder="Select course..."/></SelectTrigger><SelectContent>{courses.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                </div>
            </CardHeader>
            <CardContent>
                {loadingGrades ? <Skeleton className="h-64 w-full" /> : 
                 selectedCourseId && gradeResults.length > 0 ? (
                    <div className="space-y-4">
                        <div className="flex justify-end"><Button variant="outline" onClick={handleDownload}><Download className="mr-2 h-4 w-4"/>Export PDF</Button></div>
                        <div className="border rounded-md"><Table>
                            <TableHeader className="bg-muted/50"><TableRow><TableHead>Student</TableHead><TableHead>ID</TableHead>{templateComponents.map(c=><TableHead key={c.id} className="text-center">{c.name}</TableHead>)}<TableHead className="text-center font-bold">Final Mark</TableHead><TableHead className="text-center font-bold">Grade</TableHead></TableRow></TableHeader>
                            <TableBody>{gradeResults.map(res => (
                                <TableRow key={res.student.uid}><TableCell className="font-medium">{res.student.name}</TableCell><TableCell className="font-mono text-xs">{res.student.id}</TableCell>{templateComponents.map(c=><TableCell key={c.id} className="text-center">{res.componentScores[c.id]?.toFixed(1) ?? '-'}</TableCell>)}<TableCell className="text-center font-bold">{res.finalMark?.toFixed(1) ?? 'N/A'}</TableCell><TableCell className="text-center font-bold">{res.grade}</TableCell></TableRow>
                            ))}</TableBody>
                        </Table></div>
                    </div>
                ) : <Alert><AlertCircle className="h-4 w-4"/><AlertTitle>Information</AlertTitle><AlertDescription>{!selectedCourseId ? "Select criteria to view the gradebook." : "No results available."}</AlertDescription></Alert>}
            </CardContent>
        </Card>
    );
}
