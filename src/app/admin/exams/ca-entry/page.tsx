
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Save, AlertCircle, MessageSquare, Search, CalendarDays, PlusCircle, User, ChevronsUpDown, Check } from "lucide-react";
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
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
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
type Semester = { id: string; name: string; intakeId: string; year: number; semesterInYear: number; };
type Course = { id: string; name: string; code: string; assessmentTemplateId?: string; };

type AssessmentComponent = { id: string; name: string; weight: number; };
type AssessmentScore = { score?: number; feedback?: string; };
type AllScores = Record<string, Record<string, AssessmentScore>>; // studentUid -> componentId -> score

export default function CAEntryPage() {
    const [allStudents, setAllStudents] = React.useState<Student[]>([]);
    const [programmes, setProgrammes] = React.useState<Programme[]>([]);
    const [intakes, setIntakes] = React.useState<Intake[]>([]);
    const [allSemesters, setAllSemesters] = React.useState<Semester[]>([]);
    
    // Main Filters
    const [selectedProgrammeId, setSelectedProgrammeId] = React.useState('');
    const [selectedIntakeId, setSelectedIntakeId] = React.useState('');
    const [selectedYear, setSelectedYear] = React.useState<string>('');
    const [selectedSemesterInYear, setSelectedSemesterInYear] = React.useState<string>('');
    
    const [courses, setCourses] = React.useState<Course[]>([]);
    const [selectedCourseId, setSelectedCourseId] = React.useState('');
    
    const [studentsInRoster, setStudentsInRoster] = React.useState<Student[]>([]);
    const [scores, setScores] = React.useState<AllScores>({});
    const [templateComponents, setTemplateComponents] = React.useState<AssessmentComponent[]>([]);
    
    // Search student state
    const [isSearchOpen, setIsSearchOpen] = React.useState(false);
    const [studentSearchInput, setStudentSearchInput] = React.useState('');

    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [rosterSearch, setRosterSearch] = React.useState('');
    const { toast } = useToast();

    // 1. Initial Data Fetch
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
                if (uSnap.exists()) {
                    setAllStudents(Object.entries(uSnap.val()).filter(([_, u]: [string, any]) => u.role === 'Student').map(([uid, u]: [string, any]) => ({ uid, ...u })));
                }
                if (sSnap.exists()) setAllSemesters(Object.entries(sSnap.val()).map(([id, data]: [string, any]) => ({ id, ...data })));
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // 2. Handle Student Selection from Search
    const handleSelectStudentFromSearch = (student: Student) => {
        if (student.programmeId) setSelectedProgrammeId(student.programmeId);
        if (student.intakeId) {
            setSelectedIntakeId(student.intakeId);
            // Calculate standing and set year/sem
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
        toast({ title: `Loaded context for ${student.name}` });
    };

    // 3. Auto-Standing Logic (Triggered only when intake changes without a student search)
    React.useEffect(() => {
        if (!selectedIntakeId || (selectedYear && selectedSemesterInYear)) return;

        const intake = intakes.find(i => i.id === selectedIntakeId);
        if (!intake) return;

        get(ref(db, 'settings/academicCalendar')).then(calendarSnap => {
            const intakeStartStr = parseIntakeDate(intake.name);
            if (calendarSnap.exists() && intakeStartStr) {
                const state = calculateAcademicState(
                    intakeStartStr,
                    new Date(),
                    calendarSnap.val().standardCycles,
                    Object.values(calendarSnap.val().anomalies || {})
                );
                setSelectedYear(String(state.year));
                setSelectedSemesterInYear(String(state.semester));
            }
        });
    }, [selectedIntakeId, intakes]);

    // 4. Fetch courses and identify semester ID
    const targetSemesterId = React.useMemo(() => {
        if (!selectedIntakeId || !selectedYear || !selectedSemesterInYear) return null;
        return allSemesters.find(s => 
            s.intakeId === selectedIntakeId && 
            s.year === Number(selectedYear) && 
            s.semesterInYear === Number(selectedSemesterInYear)
        )?.id || null;
    }, [allSemesters, selectedIntakeId, selectedYear, selectedSemesterInYear]);

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

    // 5. Load Roster and Scores
    React.useEffect(() => {
        if (!selectedCourseId || !targetSemesterId) {
            setStudentsInRoster([]);
            setScores({});
            setTemplateComponents([]);
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                const course = courses.find(c => c.id === selectedCourseId);
                if (!course) throw new Error("Course not found");

                if (course.assessmentTemplateId) {
                    const tSnap = await get(ref(db, `settings/assessmentTemplates/${course.assessmentTemplateId}`));
                    if (tSnap.exists()) setTemplateComponents(Object.entries(tSnap.val().components).map(([id, c]: [string, any]) => ({ id, ...c })));
                } else {
                    setTemplateComponents([]);
                }

                const [rSnap, sSnap] = await Promise.all([
                    get(ref(db, 'registrations')),
                    get(ref(db, `assessments/${selectedCourseId}`))
                ]);

                const enrolledUids: string[] = [];
                const allRegs = rSnap.val() || {};

                for (const userId in allRegs) {
                    const reg = allRegs[userId][targetSemesterId];
                    if (reg?.courses?.includes(selectedCourseId) && (reg.status === 'Completed' || reg.status === 'Pending Payment')) {
                        enrolledUids.push(userId);
                    }
                }

                setStudentsInRoster(enrolledUids.map(uid => allStudents.find(s => s.uid === uid)).filter(Boolean) as Student[]);
                setScores(sSnap.exists() ? sSnap.val() : {});

            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetchData();
    }, [selectedCourseId, targetSemesterId, courses, allStudents]);

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

    const filteredRoster = studentsInRoster.filter(s => s.name.toLowerCase().includes(rosterSearch.toLowerCase()) || s.id.toLowerCase().includes(rosterSearch.toLowerCase()));
    const searchableStudents = allStudents.filter(s => s.name.toLowerCase().includes(studentSearchInput.toLowerCase()) || s.id.toLowerCase().includes(studentSearchInput.toLowerCase())).slice(0, 10);

    return (
        <Card className="shadow-lg border-0">
            <CardHeader className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-2xl font-headline">Continuous Assessment Entry</CardTitle>
                        <CardDescription>Enter weighted component scores. Filter by student search or manual criteria.</CardDescription>
                    </div>
                    
                    {/* Step 1: Student Search */}
                    <div className="flex items-center gap-2">
                        <Label className="text-xs font-bold uppercase text-muted-foreground whitespace-nowrap">Step 1: Jump to Student</Label>
                        <Popover open={isSearchOpen} onOpenChange={setIsSearchOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-[300px] justify-between text-left font-normal">
                                    <div className="flex items-center gap-2">
                                        <User className="h-4 w-4 text-primary" />
                                        <span className="truncate">Search by Student Name or ID...</span>
                                    </div>
                                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="end">
                                <div className="p-2">
                                    <div className="relative">
                                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input 
                                            placeholder="Type to search..." 
                                            className="pl-8 h-9" 
                                            value={studentSearchInput}
                                            onChange={e => setStudentSearchInput(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <Separator />
                                <ScrollArea className="h-64">
                                    <div className="p-1">
                                        {searchableStudents.map(student => (
                                            <Button 
                                                key={student.uid}
                                                variant="ghost" 
                                                className="w-full justify-start text-xs py-2"
                                                onClick={() => handleSelectStudentFromSearch(student)}
                                            >
                                                <div className="flex flex-col text-left">
                                                    <span className="font-bold">{student.name}</span>
                                                    <span className="text-[10px] text-muted-foreground">{student.id}</span>
                                                </div>
                                            </Button>
                                        ))}
                                        {searchableStudents.length === 0 && (
                                            <div className="p-4 text-center text-xs text-muted-foreground italic">No matches found.</div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                <Separator />

                <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="space-y-1">
                        <Label>Programme</Label>
                        <Select value={selectedProgrammeId} onValueChange={setSelectedProgrammeId}>
                            <SelectTrigger><SelectValue placeholder="Select programme..."/></SelectTrigger>
                            <SelectContent>{programmes.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label>Intake</Label>
                        <Select value={selectedIntakeId} onValueChange={setSelectedIntakeId}>
                            <SelectTrigger><SelectValue placeholder="Select intake..."/></SelectTrigger>
                            <SelectContent>{intakes.map(i=><SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label>Year</Label>
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger><SelectValue placeholder="Year..."/></SelectTrigger>
                            <SelectContent>
                                {[1,2,3,4,5].map(y => <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label>Semester</Label>
                        <Select value={selectedSemesterInYear} onValueChange={setSelectedSemesterInYear}>
                            <SelectTrigger><SelectValue placeholder="Semester..."/></SelectTrigger>
                            <SelectContent>
                                {[1,2,3].map(s => <SelectItem key={s} value={String(s)}>Semester {s}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label>Course</Label>
                        <Select value={selectedCourseId} onValueChange={setSelectedCourseId} disabled={courses.length === 0}>
                            <SelectTrigger><SelectValue placeholder={courses.length > 0 ? "Select course..." : "No courses available"}/></SelectTrigger>
                            <SelectContent>{courses.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {selectedCourseId && studentsInRoster.length > 0 && templateComponents.length > 0 && (
                    <div className="relative max-w-sm"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Filter student roster..." className="pl-8" value={rosterSearch} onChange={e => setRosterSearch(e.target.value)} /></div>
                )}
                {loading ? <Skeleton className="h-64 w-full" /> : 
                 selectedCourseId && templateComponents.length > 0 && filteredRoster.length > 0 ? (
                    <div className="overflow-x-auto border rounded-lg shadow-sm">
                        <Table>
                            <TableHeader className="bg-muted/50"><TableRow><TableHead className="min-w-[150px]">Student</TableHead><TableHead>ID</TableHead>{templateComponents.map(c=><TableHead key={c.id}>{c.name} ({c.weight}%)</TableHead>)}</TableRow></TableHeader>
                            <TableBody>
                                {filteredRoster.map(s => (
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
                ) : (
                    <Alert>
                        <AlertCircle className="h-4 w-4"/>
                        <AlertTitle>Information</AlertTitle>
                        <AlertDescription className="flex flex-col gap-4">
                            {!selectedCourseId ? (
                                "Select a programme, intake, year, and semester to begin. Searching for a student will fill these automatically."
                            ) : studentsInRoster.length === 0 ? (
                                "No students are currently enrolled in the identified academic phase for this intake/programme."
                            ) : (
                                <div className="space-y-4">
                                    <p>This course has no assessment template assigned. A template is required to define CA components like Quizzes and Assignments.</p>
                                    <Button asChild variant="outline" size="sm">
                                        <Link href="/admin/academics/assessment-setup">
                                            <PlusCircle className="mr-2 h-4 w-4"/> Create Assessment Template
                                        </Link>
                                    </Button>
                                </div>
                            )}
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
            {selectedCourseId && templateComponents.length > 0 && studentsInRoster.length > 0 && (
                <CardFooter className="justify-end border-t pt-6"><Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Save All Scores</Button></CardFooter>
            )}
        </Card>
    );
}
