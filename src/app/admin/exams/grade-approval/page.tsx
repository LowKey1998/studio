
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { db } from '@/lib/firebase';
import { ref, get, set, onValue, update } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from "@/components/ui/badge";

type Student = {
    uid: string;
    id: string; 
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
};

type Programme = {
    id: string;
    name: string;
    courseIds?: Record<string, boolean>;
};


type AssessmentScore = {
    score?: number;
    feedback?: string;
}

type AssessmentScores = Record<string, AssessmentScore>; // componentId -> score & feedback
type FinalExamScore = { finalExam?: AssessmentScore };

type GradeResult = {
    student: Student;
    caScore: number | null;
    finalExamScore: number | null;
    finalMark: number | null;
    grade: string;
};

type GradeApprovalStatus = 'Pending' | 'Approved';

export default function GradeApprovalPage() {
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [allProgrammes, setAllProgrammes] = React.useState<Programme[]>([]);
    const [courses, setCourses] = React.useState<Course[]>([]);
    
    const [selectedSemester, setSelectedSemester] = React.useState('');
    const [selectedProgramme, setSelectedProgramme] = React.useState('');
    const [selectedCourse, setSelectedCourse] = React.useState('');

    const [gradeResults, setGradeResults] = React.useState<GradeResult[]>([]);
    const [gradeStatus, setGradeStatus] = React.useState<GradeApprovalStatus>('Pending');
    
    const [loading, setLoading] = React.useState(true);
    const [loadingGrades, setLoadingGrades] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const { toast } = useToast();

    // Fetch static data like semesters and programmes
    React.useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const [semestersSnap, programmesSnap] = await Promise.all([
                get(ref(db, 'semesters')),
                get(ref(db, 'programmes'))
            ]);

            if (semestersSnap.exists()) {
                const data = semestersSnap.val();
                const list = Object.keys(data).map(id => ({ id, ...data[id] })).filter(s => s.status !== 'Archived');
                setSemesters(list.sort((a,b) => b.name.localeCompare(a.name)));
                if(list.length > 0) setSelectedSemester(list[0].id);
            }
            if (programmesSnap.exists()) {
                const data = programmesSnap.val();
                setAllProgrammes(Object.keys(data).map(id => ({ id, ...data[id] })));
            }
            setLoading(false);
        };
        fetchData();
    }, []);

     // Fetch courses for selected semester and programme
    React.useEffect(() => {
        if (!selectedSemester || !selectedProgramme) {
            setCourses([]);
            setSelectedCourse('');
            return;
        }
        
        const fetchCourses = async () => {
            const programme = allProgrammes.find(p => p.id === selectedProgramme);
            if (!programme || !programme.courseIds) {
                setCourses([]);
                return;
            }
            const courseIds = Object.keys(programme.courseIds);
            
            const coursesSnap = await get(ref(db, 'courses'));
            if (!coursesSnap.exists()) {
                setCourses([]);
                return;
            }
            const allCoursesData = coursesSnap.val();
            const relevantCourses = courseIds
                .map(id => allCoursesData[id] ? { id, ...allCoursesData[id] } : null)
                .filter((c): c is Course => c !== null);
            
            setCourses(relevantCourses);
        };
        fetchCourses();
    }, [selectedSemester, selectedProgramme, allProgrammes]);

    // Fetch grades for selected course
    React.useEffect(() => {
        if (!selectedCourse) {
            setGradeResults([]);
            return;
        }

        const fetchGrades = async () => {
            setLoadingGrades(true);
            try {
                // Fetch status
                const statusRef = ref(db, `gradeStatus/${selectedSemester}/${selectedCourse}`);
                const statusSnap = await get(statusRef);
                setGradeStatus(statusSnap.exists() ? statusSnap.val() : 'Pending');

                // Fetch data
                const [allUsersSnap, allRegsSnap, allAssessmentsSnap, programmesSnap, assessmentTemplatesSnap] = await Promise.all([
                    get(ref(db, 'users')), get(ref(db, 'registrations')), get(ref(db, 'assessments')), get(ref(db, 'programmes')), get(ref(db, 'settings/assessmentTemplates'))
                ]);

                if (!allUsersSnap.exists() || !allRegsSnap.exists() || !allAssessmentsSnap.exists() || !programmesSnap.exists()) {
                    setGradeResults([]); return;
                }
                const allUsers = allUsersSnap.val();
                const allRegistrations = allRegsSnap.val();
                const courseAssessments = allAssessmentsSnap.val()[selectedCourse] || {};
                const programmesData = programmesSnap.val();
                const templatesData = assessmentTemplatesSnap.exists() ? assessmentTemplatesSnap.val() : {};
                
                const enrolledStudentUids: string[] = [];
                for (const userId in allRegistrations) {
                    const semesterReg = allRegistrations[userId][selectedSemester];
                    if (semesterReg && semesterReg.courses.includes(selectedCourse) && (semesterReg.status === 'Completed')) {
                         if(allUsers[userId]?.programmeId === selectedProgramme) { // Filter by selected programme
                            enrolledStudentUids.push(userId);
                        }
                    }
                }
                
                const results: GradeResult[] = enrolledStudentUids.map(uid => {
                    const studentData = allUsers[uid];
                    const scores: AssessmentScores & FinalExamScore = courseAssessments[uid] || {};
                    const programme = programmesData[studentData.programmeId];
                    const gradingScale: any[] = programme?.gradingScale ? Object.values(programme.gradingScale) : [];
                    
                    const course = courses.find(c => c.id === selectedCourse);
                    const template = course?.assessmentTemplateId ? templatesData[course.assessmentTemplateId] : null;
                    
                    let caScore: number | null = null;
                    if(template && template.components) {
                        let totalWeightedScore = 0;
                        let totalWeight = 0;
                        Object.entries(template.components).forEach(([id, comp]: [string, any]) => {
                             if(scores[id]?.score !== undefined) {
                                totalWeightedScore += scores[id]!.score! * (comp.weight / 100);
                                totalWeight += comp.weight;
                             }
                        });
                        caScore = totalWeight > 0 ? (totalWeightedScore / totalWeight) * 100 : null;
                    }

                    const finalExamScore = scores.finalExam?.score ?? null;

                    let finalMark: number | null = null;
                    if(caScore !== null && finalExamScore !== null){
                        finalMark = (caScore * 0.4) + (finalExamScore * 0.6);
                    }
                    
                    const grade = finalMark !== null ? (gradingScale.find(g => finalMark! >= g.minScore && finalMark! <= g.maxScore)?.grade || 'F') : 'N/A';
                    
                    return { student: { uid, id: studentData.id, name: studentData.name, programmeId: studentData.programmeId }, caScore, finalExamScore, finalMark, grade };
                });

                setGradeResults(results);

            } catch (e) {
                console.error(e);
            } finally {
                setLoadingGrades(false);
            }
        }
        fetchGrades();

    }, [selectedCourse, selectedSemester, courses, selectedProgramme]);

    const handleApprove = async () => {
        setSaving(true);
        try {
            await set(ref(db, `gradeStatus/${selectedSemester}/${selectedCourse}`), 'Approved');
            toast({ title: "Grades Approved" });
            setGradeStatus('Approved');
        } catch(e) {
            toast({ variant: 'destructive', title: 'Approval Failed' });
        } finally {
            setSaving(false);
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Grade Approval Workflow</CardTitle>
                <CardDescription>Select a programme and course to review and approve final grades before they are published to students.</CardDescription>
                <div className="grid md:grid-cols-3 gap-4 pt-4">
                    <div className="space-y-1">
                        <Label>Semester</Label>
                        <Select value={selectedSemester} onValueChange={setSelectedSemester} disabled={loading}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{semesters.map(s=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
                    </div>
                     <div className="space-y-1">
                        <Label>Programme</Label>
                        <Select value={selectedProgramme} onValueChange={setSelectedProgramme} disabled={!selectedSemester}><SelectTrigger><SelectValue placeholder="Select programme..."/></SelectTrigger><SelectContent>{allProgrammes.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
                    </div>
                     <div className="space-y-1">
                        <Label>Course</Label>
                        <Select value={selectedCourse} onValueChange={setSelectedCourse} disabled={!selectedProgramme}><SelectTrigger><SelectValue placeholder="Select course..."/></SelectTrigger><SelectContent>{courses.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {loadingGrades ? <Skeleton className="h-64"/> : gradeResults.length > 0 ? (
                <>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold">Final Grades for {courses.find(c=>c.id === selectedCourse)?.name}</h3>
                    <Badge variant={gradeStatus === 'Approved' ? 'default' : 'secondary'}>{gradeStatus}</Badge>
                </div>
                <Table>
                    <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>ID</TableHead><TableHead>CA (40%)</TableHead><TableHead>Final Exam (60%)</TableHead><TableHead>Final Mark</TableHead><TableHead>Grade</TableHead></TableRow></TableHeader>
                    <TableBody>
                    {gradeResults.map(res => (
                        <TableRow key={res.student.uid}>
                            <TableCell>{res.student.name}</TableCell>
                            <TableCell>{res.student.id}</TableCell>
                            <TableCell>{res.caScore?.toFixed(1) ?? 'N/A'}</TableCell>
                            <TableCell>{res.finalExamScore?.toFixed(1) ?? 'N/A'}</TableCell>
                            <TableCell className="font-bold">{res.finalMark?.toFixed(1) ?? 'N/A'}</TableCell>
                             <TableCell className="font-bold">{res.finalMark !== null ? res.grade : 'N/A'}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                </>
                ) : <Alert><AlertCircle className="h-4 w-4" /><AlertTitle>No Results</AlertTitle><AlertDescription>
                    {selectedCourse ? 'No results available for this course, or no students are enrolled under the selected programme.' : 'Please select a semester, programme, and course to view grades.'}
                </AlertDescription></Alert>}
            </CardContent>
            {gradeResults.length > 0 && (
                <CardFooter className="flex justify-end">
                    <Button onClick={handleApprove} disabled={saving || gradeStatus === 'Approved'}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        {gradeStatus === 'Approved' ? <><CheckCircle2 className="mr-2 h-4"/>Approved</> : 'Approve All Grades'}
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
}

