'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Download, BookCheck } from "lucide-react";
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
import { format } from 'date-fns';

type Student = {
    uid: string;
    id: string; // STU-001
    name: string;
    programmeId: string;
};

type Semester = {
    id: string;
    name: string;
    status: 'Open' | 'Closed' | 'Archived';
}

type Course = {
    id: string;
    name: string;
    code: string;
    assessmentTemplateId?: string;
    programmeId?: string; // Assume course is linked to a programme
};

type Programme = {
    id: string;
    name: string;
    gradingScale?: Record<string, { grade: string, minScore: number, maxScore: number }>;
}

type AssessmentComponent = {
    id: string;
    name: string;
    weight: number;
}

type FinalExamPolicy = {
    weight: number;
}

type AssessmentScore = {
    score?: number;
}

type AllScores = Record<string, Record<string, AssessmentScore>>; // studentUid -> componentId -> score

type GradeResult = {
    student: Student;
    componentScores: Record<string, number | null>;
    caMark: number | null;
    finalExamScore: number | null;
    finalMark: number | null;
    grade: string;
};

export default function GradebookPage() {
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [courses, setCourses] = React.useState<Course[]>([]);
    const [programmes, setProgrammes] = React.useState<Programme[]>([]);

    const [selectedSemester, setSelectedSemester] = React.useState('');
    const [selectedCourseId, setSelectedCourseId] = React.useState('');

    const [gradeResults, setGradeResults] = React.useState<GradeResult[]>([]);
    const [templateComponents, setTemplateComponents] = React.useState<AssessmentComponent[]>([]);
    const [finalExamPolicy, setFinalExamPolicy] = React.useState<FinalExamPolicy>({ weight: 60 });
    
    const [loading, setLoading] = React.useState(true);
    const [loadingGrades, setLoadingGrades] = React.useState(false);
    
    const { toast } = useToast();

    // Fetch static data like semesters, courses, and programmes
    React.useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const [semestersSnap, coursesSnap, programmesSnap, finalExamPolicySnap] = await Promise.all([
                get(ref(db, 'semesters')),
                get(ref(db, 'courses')),
                get(ref(db, 'programmes')),
                get(ref(db, 'settings/finalExamPolicy'))
            ]);

            if (semestersSnap.exists()) {
                const data = semestersSnap.val();
                const list = Object.keys(data).map(id => ({ id, ...data[id] })).filter(s => s.status !== 'Archived');
                setSemesters(list.sort((a,b) => b.name.localeCompare(a.name)));
                if(list.length > 0) setSelectedSemester(list[0].id);
            }
            if (coursesSnap.exists()) {
                 const coursesData = coursesSnap.val();
                setCourses(Object.keys(coursesData).map(id => ({ id, ...coursesData[id] })));
            }
            if (programmesSnap.exists()) {
                const programmesData = programmesSnap.val();
                setProgrammes(Object.keys(programmesData).map(id => ({ id, ...programmesData[id] })));
            }
            if (finalExamPolicySnap.exists()) setFinalExamPolicy(finalExamPolicySnap.val());
            
            setLoading(false);
        };
        fetchData();
    }, []);

    // Fetch grades and calculate when a course is selected
    React.useEffect(() => {
        if (!selectedCourseId || !selectedSemester) {
            setGradeResults([]);
            setTemplateComponents([]);
            return;
        }

        const fetchAndCalculateGrades = async () => {
            setLoadingGrades(true);
            try {
                const [allUsersSnap, allRegsSnap, allAssessmentsSnap, templatesSnap] = await Promise.all([
                    get(ref(db, 'users')), get(ref(db, 'registrations')), get(ref(db, 'assessments')), get(ref(db, 'settings/assessmentTemplates'))
                ]);

                const allUsers = allUsersSnap.val() || {};
                const allRegistrations = allRegsSnap.val() || {};
                const courseAssessments = allAssessmentsSnap.val()?.[selectedCourseId] || {};
                const templatesData = templatesSnap.val() || {};
                
                const course = courses.find(c => c.id === selectedCourseId);
                const programme = programmes.find(p => p.id === course?.programmeId);
                const gradingScale = programme?.gradingScale ? Object.values(programme.gradingScale) : [];

                if (!course) throw new Error("Selected course data could not be found.");
                
                const template = course.assessmentTemplateId ? templatesData[course.assessmentTemplateId] : null;
                const components = template?.components ? Object.entries(template.components).map(([id, comp]: [string, any]) => ({ id, ...comp })) : [];
                setTemplateComponents(components);
                
                const enrolledStudentUids: string[] = [];
                for (const userId in allRegistrations) {
                    const semesterReg = allRegistrations[userId][selectedSemester];
                    if (semesterReg?.courses.includes(selectedCourseId) && (semesterReg.status === 'Completed' || semesterReg.status === 'Pending Payment')) {
                        enrolledStudentUids.push(userId);
                    }
                }
                
                const results: GradeResult[] = enrolledStudentUids.map(uid => {
                    const studentData = allUsers[uid];
                    const scores: Record<string, AssessmentScore> = courseAssessments[uid] || {};
                    
                    let caMark: number | null = 0;
                    let totalWeight = 0;

                    const componentScores: Record<string, number | null> = {};
                    components.forEach(comp => {
                        const score = scores[comp.id]?.score;
                        componentScores[comp.id] = score ?? null;
                        if(score !== undefined){
                            caMark! += score * (comp.weight / 100);
                            totalWeight += comp.weight;
                        }
                    });

                    if (totalWeight === 0) caMark = null;

                    const finalExamScore = scores.finalExam?.score ?? null;
                    
                    const caWeight = 100 - finalExamPolicy.weight;
                    let finalMark: number | null = null;
                    if(caMark !== null && finalExamScore !== null){
                        finalMark = (caMark * (caWeight / 100)) + (finalExamScore * (finalExamPolicy.weight / 100));
                    }
                    
                    const grade = finalMark !== null 
                        ? (gradingScale.find(g => finalMark! >= g.minScore && finalMark! <= g.maxScore)?.grade || 'N/A') 
                        : 'N/A';
                    
                    return { student: { uid, id: studentData.id, name: studentData.name, programmeId: studentData.programmeId }, componentScores, caMark, finalExamScore, finalMark, grade };
                });

                setGradeResults(results);

            } catch (e: any) {
                toast({ variant: 'destructive', title: 'Error Calculating Grades', description: e.message });
            } finally {
                setLoadingGrades(false);
            }
        }
        fetchAndCalculateGrades();

    }, [selectedCourseId, selectedSemester, courses, finalExamPolicy.weight, programmes, toast]);
    
    const handleDownload = () => {
        const course = courses.find(c => c.id === selectedCourseId);
        if(!course) return;

        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text(`Gradebook for ${course.name} (${course.code})`, 14, 22);
        
        const head = [["ID", "Name", ...templateComponents.map(c => `${c.name}\n(${c.weight}%)`), "CA Mark (40%)", `Final Exam (${finalExamPolicy.weight}%)`, "Final Mark", "Grade"]];
        const body = gradeResults.map(r => [
            r.student.id,
            r.student.name,
            ...templateComponents.map(c => r.componentScores[c.id]?.toFixed(1) ?? '-'),
            r.caMark?.toFixed(1) ?? '-',
            r.finalExamScore?.toFixed(1) ?? '-',
            r.finalMark?.toFixed(1) ?? '-',
            r.grade
        ]);

        (doc as any).autoTable({
            head,
            body,
            startY: 30,
            headStyles: { halign: 'center', valign: 'middle' },
            styles: { fontSize: 8 },
        });

        doc.save(`Gradebook_${course.code}_${new Date().toISOString().split('T')[0]}.pdf`);
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><BookCheck/> Gradebook</CardTitle>
                <CardDescription>View a complete, weighted grade breakdown for all students in a course.</CardDescription>
                <div className="grid md:grid-cols-2 gap-4 pt-4">
                    <div className="space-y-1">
                        <Label>Semester</Label>
                        <Select value={selectedSemester} onValueChange={setSelectedSemester} disabled={loading}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{semesters.map(s=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
                    </div>
                     <div className="space-y-1">
                        <Label>Course</Label>
                        <Select value={selectedCourseId} onValueChange={setSelectedCourseId} disabled={loading}><SelectTrigger><SelectValue placeholder="Select course..."/></SelectTrigger><SelectContent>{courses.filter(c => c.status === 'active').map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {loadingGrades ? <Skeleton className="h-64"/> : gradeResults.length > 0 ? (
                <>
                <div className="flex justify-end mb-4">
                    <Button onClick={handleDownload} variant="outline"><Download className="mr-2 h-4 w-4"/>Export PDF</Button>
                </div>
                <Table>
                    <TableHeader><TableRow>
                        <TableHead>Student</TableHead>
                        {templateComponents.map(c => <TableHead key={c.id} className="text-center">{c.name} ({c.weight}%)</TableHead>)}
                        <TableHead className="text-center bg-muted/50">CA (40%)</TableHead>
                        <TableHead className="text-center bg-muted/50">Exam ({finalExamPolicy.weight}%)</TableHead>
                        <TableHead className="text-center font-bold">Final</TableHead>
                        <TableHead className="text-center font-bold">Grade</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                    {gradeResults.map(res => (
                        <TableRow key={res.student.uid}>
                            <TableCell className="font-medium">{res.student.name}</TableCell>
                            {templateComponents.map(c => <TableCell key={c.id} className="text-center">{res.componentScores[c.id]?.toFixed(1) ?? '-'}</TableCell>)}
                            <TableCell className="text-center bg-muted/50 font-semibold">{res.caMark?.toFixed(1) ?? '-'}</TableCell>
                            <TableCell className="text-center bg-muted/50 font-semibold">{res.finalExamScore?.toFixed(1) ?? '-'}</TableCell>
                            <TableCell className="text-center font-bold">{res.finalMark?.toFixed(1) ?? '-'}</TableCell>
                            <TableCell className="text-center font-bold">{res.grade}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                </>
                ) : <Alert><AlertCircle className="h-4 w-4" /><AlertTitle>No Results to Display</AlertTitle><AlertDescription>
                    {selectedCourseId ? 'No results have been entered, no assessment template is assigned, or no students are enrolled.' : 'Please select a semester and course to view the gradebook.'}
                </AlertDescription></Alert>}
            </CardContent>
        </Card>
    );
}