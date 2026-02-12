'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Save, AlertCircle, MessageSquare, Search, CalendarDays } from "lucide-react";
import { db, createNotification } from '@/lib/firebase';
import { ref, get, set, onValue } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';

type Student = {
    uid: string;
    id: string;
    name: string;
};

type Programme = { id: string; name: string; };
type Intake = { id: string; name: string; };
type Semester = { id: string; name: string; intakeId: string; year: number; semesterInYear: number; };
type Course = { id: string; name: string; code: string; assessmentTemplateId?: string; };

type AssessmentComponent = { id: string; name: string; weight: number; };
type AssessmentScore = { score?: number; feedback?: string; };
type AllScores = Record<string, Record<string, AssessmentScore>>; // studentUid -> componentId -> score

export default function CAEntryPage() {
    const [programmes, setProgrammes] = React.useState<Programme[]>([]);
    const [selectedProgrammeId, setSelectedProgrammeId] = React.useState('');
    const [intakes, setIntakes] = React.useState<Intake[]>([]);
    const [selectedIntakeId, setSelectedIntakeId] = React.useState('');
    
    const [courses, setCourses] = React.useState<Course[]>([]);
    const [selectedCourseId, setSelectedCourseId] = React.useState('');
    
    const [students, setStudents] = React.useState<Student[]>([]);
    const [scores, setScores] = React.useState<AllScores>({});
    const [templateComponents, setTemplateComponents] = React.useState<AssessmentComponent[]>([]);
    
    const [academicStanding, setAcademicStanding] = React.useState<any>(null);
    const [targetSemesterId, setTargetSemesterId] = React.useState<string | null>(null);
    
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState('');
    const { toast } = useToast();

    // Initial Data Fetch
    React.useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [pSnap, iSnap] = await Promise.all([
                    get(ref(db, 'programmes')),
                    get(ref(db, 'intakes'))
                ]);
                if (pSnap.exists()) setProgrammes(Object.entries(pSnap.val()).map(([id, data]: [string, any]) => ({ id, ...data })));
                if (iSnap.exists()) setIntakes(Object.entries(iSnap.val()).map(([id, data]: [string, any]) => ({ id, ...data })).sort((a, b) => b.name.localeCompare(a.name)));
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Calculate Academic Standing and Find Semester
    React.useEffect(() => {
        if (!selectedIntakeId) {
            setAcademicStanding(null);
            setTargetSemesterId(null);
            return;
        }

        const fetchStanding = async () => {
            const intake = intakes.find(i => i.id === selectedIntakeId);
            if (!intake) return;

            const [calendarSnap, semestersSnap] = await Promise.all([
                get(ref(db, 'settings/academicCalendar')),
                get(ref(db, 'semesters'))
            ]);

            const intakeStartStr = parseIntakeDate(intake.name);
            if (calendarSnap.exists() && intakeStartStr) {
                const state = calculateAcademicState(
                    intakeStartStr,
                    new Date(),
                    calendarSnap.val().standardCycles,
                    Object.values(calendarSnap.val().anomalies || {})
                );
                setAcademicStanding(state);

                if (semestersSnap.exists()) {
                    const found = Object.entries(semestersSnap.val() as Record<string, Semester>).find(([id, sem]) => 
                        sem.intakeId === selectedIntakeId && 
                        sem.year === state.year && 
                        sem.semesterInYear === state.semester
                    );
                    setTargetSemesterId(found ? found[0] : null);
                }
            }
        };
        fetchStanding();
    }, [selectedIntakeId, intakes]);

    // Fetch courses based on Programme, Intake, and identified Semester
    React.useEffect(() => {
        if (!selectedProgrammeId || !selectedIntakeId || !targetSemesterId) {
            setCourses([]);
            setSelectedCourseId('');
            return;
        }

        const fetchCourses = async () => {
            const [coursePathsSnap, allCoursesSnap] = await Promise.all([
                get(ref(db, 'coursePaths')),
                get(ref(db, 'courses'))
            ]);

            if (coursePathsSnap.exists() && allCoursesSnap.exists()) {
                const paths = Object.values(coursePathsSnap.val() || {});
                const userPath: any = paths.find((p: any) => p.intakeId === selectedIntakeId && p.programmeId === selectedProgrammeId);
                const allCoursesData = allCoursesSnap.val();

                if (userPath?.semesters?.[targetSemesterId]) {
                    const courseIds = userPath.semesters[targetSemesterId].courses || [];
                    setCourses(courseIds.map((id: string) => ({ id, ...allCoursesData[id] })).filter((c: any) => c.status === 'active'));
                } else {
                    setCourses([]);
                }
            }
        };
        fetchCourses();
    }, [selectedProgrammeId, selectedIntakeId, targetSemesterId]);

    // Load Students and Scores
    React.useEffect(() => {
        if (!selectedCourseId || !targetSemesterId) {
            setStudents([]);
            setScores({});
            setTemplateComponents([]);
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                const course = courses.find(c => c.id === selectedCourseId);
                if (!course) throw new Error("Course not found");

                // 1. Template
                if (course.assessmentTemplateId) {
                    const tSnap = await get(ref(db, `settings/assessmentTemplates/${course.assessmentTemplateId}`));
                    if (tSnap.exists()) setTemplateComponents(Object.entries(tSnap.val().components).map(([id, c]: [string, any]) => ({ id, ...c })));
                }

                // 2. Students
                const [uSnap, rSnap, sSnap] = await Promise.all([
                    get(ref(db, 'users')),
                    get(ref(db, 'registrations')),
                    get(ref(db, `assessments/${selectedCourseId}`))
                ]);

                const enrolledUids: string[] = [];
                const allRegs = rSnap.val() || {};
                const allUsers = uSnap.val() || {};

                for (const userId in allRegs) {
                    const reg = allRegs[userId][targetSemesterId];
                    if (reg?.courses?.includes(selectedCourseId) && (reg.status === 'Completed' || reg.status === 'Pending Payment')) {
                        enrolledUids.push(userId);
                    }
                }

                setStudents(enrolledUids.map(uid => ({ uid, id: allUsers[uid]?.id || 'N/A', name: allUsers[uid]?.name || 'Unknown' })).sort((a,b) => a.name.localeCompare(b.name)));
                setScores(sSnap.exists() ? sSnap.val() : {});

            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetchData();
    }, [selectedCourseId, targetSemesterId, courses]);

    const handleScoreChange = (studentUid: string, componentId: string, value: string) => {
        const numericValue = value === '' ? undefined : Number(value);
        if (numericValue !== undefined && (numericValue < 0 || numericValue > 100)) return;
        setScores(prev => ({
            ...prev,
            [studentUid]: { ...(prev[studentUid] || {}), [componentId]: { ...(prev[studentUid]?.[componentId] || {}), score: numericValue } }
        }));
    };

    const handleSave = async () => {
        if (!selectedCourseId) return;
        setSaving(true);
        try {
            await set(ref(db, `assessments/${selectedCourseId}`), scores);
            toast({ title: "Scores Saved" });
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Save Failed", description: e.message });
        } finally {
            setSaving(false);
        }
    };

    const filteredStudents = students.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.id.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <Card>
            <CardHeader>
                <CardTitle>Continuous Assessment Entry</CardTitle>
                <CardDescription>Select a programme and intake. The system will identify the current semester for data entry.</CardDescription>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
                    <div className="space-y-1"><Label>Programme</Label><Select value={selectedProgrammeId} onValueChange={setSelectedProgrammeId}><SelectTrigger><SelectValue placeholder="Select programme..."/></SelectTrigger><SelectContent>{programmes.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1"><Label>Intake</Label><Select value={selectedIntakeId} onValueChange={setSelectedIntakeId}><SelectTrigger><SelectValue placeholder="Select intake..."/></SelectTrigger><SelectContent>{intakes.map(i=><SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
                    {academicStanding && (
                        <div className="space-y-1"><Label>Standing</Label><div className="flex h-10 items-center px-3 border rounded-md bg-muted/50 text-sm font-bold gap-2"><CalendarDays className="h-4 w-4 text-primary" /> Year {academicStanding.year}, Sem {academicStanding.semester}</div></div>
                    )}
                    <div className="space-y-1"><Label>Course</Label><Select value={selectedCourseId} onValueChange={setSelectedCourseId} disabled={courses.length === 0}><SelectTrigger><SelectValue placeholder={courses.length > 0 ? "Select course..." : "No courses available"}/></SelectTrigger><SelectContent>{courses.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {selectedCourseId && students.length > 0 && (
                    <div className="relative max-w-sm"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Filter students..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
                )}
                {loading ? <Skeleton className="h-64 w-full" /> : 
                 selectedCourseId && templateComponents.length > 0 && filteredStudents.length > 0 ? (
                    <div className="overflow-x-auto border rounded-md">
                        <Table>
                            <TableHeader className="bg-muted/50"><TableRow><TableHead className="min-w-[150px]">Student</TableHead><TableHead>ID</TableHead>{templateComponents.map(c=><TableHead key={c.id}>{c.name} ({c.weight}%)</TableHead>)}</TableRow></TableHeader>
                            <TableBody>
                                {filteredStudents.map(s => (
                                    <TableRow key={s.uid}>
                                        <TableCell className="font-medium">{s.name}</TableCell>
                                        <TableCell className="font-mono text-xs">{s.id}</TableCell>
                                        {templateComponents.map(c => (
                                            <TableCell key={c.id}>
                                                <Input type="number" className="w-20 h-8" value={scores[s.uid]?.[c.id]?.score ?? ''} onChange={e => handleScoreChange(s.uid, c.id, e.target.value)} />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : <Alert><AlertCircle className="h-4 w-4"/><AlertTitle>Information</AlertTitle><AlertDescription>{!selectedCourseId ? "Select a programme, intake, and course to begin." : (students.length === 0 ? "No students are currently enrolled in this path." : "This course has no assessment template assigned.")}</AlertDescription></Alert>}
            </CardContent>
            {students.length > 0 && (
                <CardFooter className="justify-end border-t pt-6"><Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Save All Scores</Button></CardFooter>
            )}
        </Card>
    );
}
