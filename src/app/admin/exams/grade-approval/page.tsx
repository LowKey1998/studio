'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, CheckCircle2, Search, CalendarDays } from "lucide-react";
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

type Student = { uid: string; id: string; name: string; programmeId: string; };
type Programme = { id: string; name: string; gradingScale?: Record<string, any>; };
type Intake = { id: string; name: string; };
type Semester = { id: string; name: string; intakeId: string; year: number; semesterInYear: number; };
type Course = { id: string; name: string; code: string; assessmentTemplateId?: string; };

type GradeResult = { student: Student; caScore: number | null; finalExamScore: number | null; finalMark: number | null; grade: string; };

export default function GradeApprovalPage() {
    const [programmes, setProgrammes] = React.useState<Programme[]>([]);
    const [selectedProgrammeId, setSelectedProgrammeId] = React.useState('');
    const [intakes, setIntakes] = React.useState<Intake[]>([]);
    const [selectedIntakeId, setSelectedIntakeId] = React.useState('');
    
    const [courses, setCourses] = React.useState<Course[]>([]);
    const [selectedCourseId, setSelectedCourseId] = React.useState('');
    
    const [gradeResults, setGradeResults] = React.useState<GradeResult[]>([]);
    const [gradeStatus, setGradeStatus] = React.useState<'Pending' | 'Approved'>('Pending');
    
    const [academicStanding, setAcademicStanding] = React.useState<any>(null);
    const [targetSemesterId, setTargetSemesterId] = React.useState<string | null>(null);
    
    const [loading, setLoading] = React.useState(true);
    const [loadingGrades, setLoadingGrades] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
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

    // Calc Standing
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

    return (
        <Card>
            <CardHeader>
                <CardTitle>Grade Approval Workflow</CardTitle>
                <CardDescription>Select programme and intake to review results for the active semester.</CardDescription>
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
                        <div className="flex justify-between items-center"><h3 className="font-bold">Final Grades Preview</h3><Badge variant={gradeStatus === 'Approved' ? 'default' : 'secondary'}>{gradeStatus}</Badge></div>
                        <div className="border rounded-md"><Table>
                            <TableHeader className="bg-muted/50"><TableRow><TableHead>Student</TableHead><TableHead>ID</TableHead><TableHead>CA (40%)</TableHead><TableHead>Exam (60%)</TableHead><TableHead>Final Mark</TableHead><TableHead>Grade</TableHead></TableRow></TableHeader>
                            <TableBody>{gradeResults.map(res => (
                                <TableRow key={res.student.uid}><TableCell className="font-medium">{res.student.name}</TableCell><TableCell className="font-mono text-xs">{res.student.id}</TableCell><TableCell>{res.caScore?.toFixed(1) ?? 'N/A'}</TableCell><TableCell>{res.finalExamScore?.toFixed(1) ?? 'N/A'}</TableCell><TableCell className="font-bold">{res.finalMark?.toFixed(1) ?? 'N/A'}</TableCell><TableCell className="font-bold">{res.grade}</TableCell></TableRow>
                            ))}</TableBody>
                        </Table></div>
                    </div>
                ) : <Alert><AlertCircle className="h-4 w-4"/><AlertTitle>Information</AlertTitle><AlertDescription>{!selectedCourseId ? "Select criteria to load results." : "No results found for this course selection."}</AlertDescription></Alert>}
            </CardContent>
            {gradeResults.length > 0 && gradeStatus === 'Pending' && (
                <CardFooter className="justify-end border-t pt-6"><Button onClick={handleApprove} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Approve & Publish Grades</Button></CardFooter>
            )}
        </Card>
    );
}
