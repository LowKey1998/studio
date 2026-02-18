
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Save, AlertCircle, MessageSquare, Search, CalendarDays, PlusCircle, User, ChevronsUpDown, Check, Link as LinkIcon, Info, Trash2 } from "lucide-react";
import { db } from '@/lib/firebase';
import { ref, get, set, onValue, update, push } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogCancel, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter, 
    AlertDialogHeader, 
    AlertDialogTitle, 
    AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

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

type AssessmentTemplate = { id: string; name: string; };
type AssessmentComponent = { id: string; name: string; weight: number; };
type AssessmentScore = { score?: number; feedback?: string; };
type AllScores = Record<string, Record<string, AssessmentScore>>; // studentUid -> componentId -> score

export default function CAEntryPage() {
    const [allStudents, setAllStudents] = React.useState<Student[]>([]);
    const [programmes, setProgrammes] = React.useState<Programme[]>([]);
    const [intakes, setIntakes] = React.useState<Intake[]>([]);
    const [allSemesters, setAllSemesters] = React.useState<Semester[]>([]);
    const [templates, setTemplates] = React.useState<AssessmentTemplate[]>([]);
    
    // Main Filters
    const [selectedProgrammeId, setSelectedProgrammeId] = React.useState('');
    const [selectedIntakeId, setSelectedIntakeId] = React.useState('');
    const [selectedYear, setSelectedYear] = React.useState<string>('');
    const [selectedSemesterInYear, setSelectedSemesterInYear] = React.useState<string>('');
    
    const [courses, setCourses] = React.useState<Course[]>([]);
    const [selectedCourseId, setSelectedCourseId] = React.useState('');
    const [loadAllCourses, setLoadAllCourses] = React.useState(false);
    
    const [studentsInRoster, setStudentsInRoster] = React.useState<Student[]>([]);
    const [scores, setScores] = React.useState<AllScores>({});
    const [templateComponents, setTemplateComponents] = React.useState<AssessmentComponent[]>([]);
    
    // Quick Link State
    const [linkingTemplateId, setLinkingTemplateId] = React.useState('');
    const [isLinking, setIsLinking] = React.useState(false);

    // Search student state
    const [isSearchOpen, setIsSearchOpen] = React.useState(false);
    const [studentSearchInput, setStudentSearchInput] = React.useState('');
    const [selectedSearchStudentName, setSelectedSearchStudentName] = React.useState<string | null>(null);
    const [selectedSearchStudentUid, setSelectedSearchStudentUid] = React.useState<string | null>(null);

    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [rosterSearch, setRosterSearch] = React.useState('');
    const { toast } = useToast();

    // 1. Initial Data Fetch
    React.useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [pSnap, iSnap, uSnap, sSnap, tSnap] = await Promise.all([
                    get(ref(db, 'programmes')),
                    get(ref(db, 'intakes')),
                    get(ref(db, 'users')),
                    get(ref(db, 'semesters')),
                    get(ref(db, 'settings/assessmentTemplates'))
                ]);
                if (pSnap.exists()) setProgrammes(Object.entries(pSnap.val()).map(([id, data]: [string, any]) => ({ id, ...data })));
                if (iSnap.exists()) setIntakes(Object.entries(iSnap.val()).map(([id, data]: [string, any]) => ({ id, ...data })).sort((a, b) => b.name.localeCompare(a.name)));
                if (uSnap.exists()) {
                    setAllStudents(Object.entries(uSnap.val()).filter(([_, u]: [string, any]) => u.role === 'Student').map(([uid, u]: [string, any]) => ({ uid, ...u })));
                }
                if (sSnap.exists()) setAllSemesters(Object.entries(sSnap.val()).map(([id, data]: [string, any]) => ({ id, ...data })));
                if (tSnap.exists()) setTemplates(Object.entries(tSnap.val()).map(([id, data]: [string, any]) => ({ id, name: data.name })));
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
        setSelectedSearchStudentName(student.name);
        setSelectedSearchStudentUid(student.uid);
        if (student.programmeId) setSelectedProgrammeId(student.programmeId);
        if (student.intakeId) {
            setSelectedIntakeId(student.intakeId);
            // Only auto-update year/semester if not already manually set
            if (!selectedYear || !selectedSemesterInYear) {
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
        }
        setIsSearchOpen(false);
        setStudentSearchInput('');
    };

    // 3. Auto-Standing Logic (When intake is selected manually)
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

    // 4. Resolve exact semester ID
    const targetSemesterId = React.useMemo(() => {
        if (!selectedIntakeId || !selectedYear || !selectedSemesterInYear) return null;
        return allSemesters.find(s => s.intakeId === selectedIntakeId && s.year === Number(selectedYear) && s.semesterInYear === Number(selectedSemesterInYear))?.id || null;
    }, [allSemesters, selectedIntakeId, selectedYear, selectedSemesterInYear]);

    // 5. Fetch available courses for selected phase
    React.useEffect(() => {
        const fetchCourses = async () => {
            const allCoursesSnap = await get(ref(db, 'courses'));
            if (!allCoursesSnap.exists()) return;
            const allCoursesData = allCoursesSnap.val();

            if (loadAllCourses) {
                setCourses(Object.keys(allCoursesData).map(id => ({ id, ...allCoursesData[id] })).filter(c => c.status === 'active'));
                return;
            }

            if (!selectedProgrammeId || !selectedIntakeId || !targetSemesterId) {
                setCourses([]);
                setSelectedCourseId('');
                return;
            }

            const coursePathsSnap = await get(ref(db, 'coursePaths'));
            if (coursePathsSnap.exists()) {
                const paths = Object.values(coursePathsSnap.val() || {});
                const userPath: any = paths.find((p: any) => p.intakeId === selectedIntakeId && p.programmeId === selectedProgrammeId);

                if (userPath?.semesters?.[targetSemesterId]) {
                    const courseIds = userPath.semesters[targetSemesterId].courses || [];
                    const foundCourses = courseIds.map((id: string) => ({ id, ...allCoursesData[id] })).filter((c: any) => c && c.status === 'active');
                    setCourses(foundCourses);
                    
                    if (selectedCourseId && !foundCourses.find(c => c.id === selectedCourseId)) {
                        setSelectedCourseId('');
                    }
                } else {
                    setCourses([]);
                    setSelectedCourseId('');
                }
            }
        };
        fetchCourses();
    }, [selectedProgrammeId, selectedIntakeId, targetSemesterId, loadAllCourses]);

    // 6. Load Roster and Existing Scores
    React.useEffect(() => {
        if (!selectedCourseId || (!targetSemesterId && !selectedSearchStudentUid)) {
            setStudentsInRoster([]);
            setScores({});
            setTemplateComponents([]);
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                const course = courses.find(c => c.id === selectedCourseId);
                if (!course) {
                    setStudentsInRoster([]);
                    setScores({});
                    setTemplateComponents([]);
                    setLoading(false);
                    return;
                }

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

                const enrolledUids = new Set<string>();
                const allRegs = rSnap.val() || {};

                if (targetSemesterId) {
                    for (const userId in allRegs) {
                        const reg = allRegs[userId][targetSemesterId];
                        if (reg?.courses?.includes(selectedCourseId) && (reg.status === 'Completed' || reg.status === 'Pending Payment')) {
                            enrolledUids.add(userId);
                        }
                    }
                }

                // IMPORTANT: If a student was specifically searched, force them into the roster
                // to allow adding past results or "ad-hoc" marks.
                if (selectedSearchStudentUid) {
                    enrolledUids.add(selectedSearchStudentUid);
                }

                setStudentsInRoster(Array.from(enrolledUids).map(uid => allStudents.find(s => s.uid === uid)).filter(Boolean) as Student[]);
                setScores(sSnap.exists() ? sSnap.val() : {});

            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetchData();
    }, [selectedCourseId, targetSemesterId, courses, allStudents, selectedSearchStudentUid]);

    const handleScoreChange = (studentUid: string, componentId: string, value: string) => {
        const numericValue = value === '' ? undefined : Number(value);
        if (numericValue !== undefined && (numericValue < 0 || numericValue > 100)) return;
        setScores(prev => ({
            ...prev,
            [studentUid]: { ...(prev[studentUid] || {}), [componentId]: { ...(prev[studentUid]?.[componentId] || {}), score: numericValue } }
        }));
    };

    const handleLinkTemplate = async () => {
        if (!selectedCourseId || !linkingTemplateId) return;
        setIsLinking(true);
        try {
            await update(ref(db, `courses/${selectedCourseId}`), { assessmentTemplateId: linkingTemplateId });
            toast({ title: "Template Linked" });
            setCourses(prev => prev.map(c => c.id === selectedCourseId ? { ...c, assessmentTemplateId: linkingTemplateId } : c));
            setLinkingTemplateId('');
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Linking Failed", description: e.message });
        } finally {
            setIsLinking(false);
        }
    };

    const handleUnlinkTemplate = async () => {
        if (!selectedCourseId) return;
        setSaving(true);
        try {
            await update(ref(db, `courses/${selectedCourseId}`), { assessmentTemplateId: null });
            toast({ title: "Template Unlinked" });
            setTemplateComponents([]);
            setCourses(prev => prev.map(c => c.id === selectedCourseId ? { ...c, assessmentTemplateId: undefined } : c));
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Unlink Failed" });
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        if (!selectedCourseId) return;
        setSaving(true);
        try {
            await update(ref(db, `assessments/${selectedCourseId}`), scores);
            toast({ title: "Results Recorded" });
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Save Failed" });
        } finally {
            setSaving(false);
        }
    };

    const filteredRoster = studentsInRoster.filter(s => s.name.toLowerCase().includes(rosterSearch.toLowerCase()) || s.id.toLowerCase().includes(rosterSearch.toLowerCase()));
    const searchableStudents = allStudents.filter(s => s.name.toLowerCase().includes(studentSearchInput.toLowerCase()) || s.id.toLowerCase().includes(studentSearchInput.toLowerCase()));

    return (
        <Card className="shadow-lg border-0">
            <CardHeader className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-2xl font-headline">Continuous Assessment Entry</CardTitle>
                        <CardDescription>Select an intake to auto-calculate standing, then record weighted scores.</CardDescription>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <Label className="text-xs font-black uppercase text-muted-foreground whitespace-nowrap">Step 1: Locate Student</Label>
                        <Popover open={isSearchOpen} onOpenChange={setIsSearchOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-[300px] justify-between text-left font-normal border-primary/30">
                                    <div className="flex items-center gap-2">
                                        <User className="h-4 w-4 text-primary" />
                                        <span className="truncate">{selectedSearchStudentName || "Search by Name or ID..."}</span>
                                    </div>
                                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="end">
                                <div className="p-2">
                                    <div className="relative">
                                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input 
                                            placeholder="Type to search all students..." 
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

                <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-4">
                    <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase">Programme</Label>
                        <Select value={selectedProgrammeId} onValueChange={setSelectedProgrammeId}>
                            <SelectTrigger className="bg-background"><SelectValue placeholder="Select..."/></SelectTrigger>
                            <SelectContent>{programmes.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase">Intake</Label>
                        <Select value={selectedIntakeId} onValueChange={setSelectedIntakeId}>
                            <SelectTrigger className="bg-background"><SelectValue placeholder="Select..."/></SelectTrigger>
                            <SelectContent>{intakes.map(i=><SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase">Study Year</Label>
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger className="bg-background"><SelectValue placeholder="Year..."/></SelectTrigger>
                            <SelectContent>
                                {[1,2,3,4,5].map(y => <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase">Semester</Label>
                        <Select value={selectedSemesterInYear} onValueChange={setSelectedSemesterInYear}>
                            <SelectTrigger className="bg-background"><SelectValue placeholder="Sem..."/></SelectTrigger>
                            <SelectContent>
                                {[1,2,3].map(s => <SelectItem key={s} value={String(s)}>Semester {s}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center justify-between mb-1">
                            <Label className="text-[10px] font-black uppercase">Course</Label>
                            <div className="flex items-center gap-1.5">
                                <Switch id="all-courses" checked={loadAllCourses} onCheckedChange={setLoadAllCourses} className="h-4 w-7" />
                                <Label htmlFor="all-courses" className="text-[8px] font-bold uppercase text-muted-foreground">Load All</Label>
                            </div>
                        </div>
                        <Select value={selectedCourseId} onValueChange={setSelectedCourseId} disabled={!loadAllCourses && courses.length === 0}>
                            <SelectTrigger className="bg-background"><SelectValue placeholder={loadAllCourses ? "All courses..." : (courses.length > 0 ? "Select course..." : "No courses")}/></SelectTrigger>
                            <SelectContent>{courses.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {selectedCourseId && selectedYear && selectedSemesterInYear && (
                    <Alert className="bg-blue-50 border-blue-200">
                        <Info className="h-4 w-4 text-blue-600" />
                        <AlertTitle className="text-xs font-black uppercase tracking-wider text-blue-800">Active Entry Scope</AlertTitle>
                        <AlertDescription className="text-xs text-blue-700 italic">
                            These results are being recorded for <strong>Year {selectedYear}, Semester {selectedSemesterInYear}</strong>. 
                            You may enter scores for any student who was registered for this academic phase, including past results.
                        </AlertDescription>
                    </Alert>
                )}

                {selectedCourseId && templateComponents.length > 0 && (
                    <div className="flex items-center justify-between mb-4">
                        <div className="relative max-w-sm flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Filter visible roster..." className="pl-8" value={rosterSearch} onChange={e => setRosterSearch(e.target.value)} />
                        </div>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive h-8 ml-4">
                                    <Trash2 className="h-4 w-4 mr-2"/> Unlink Structure
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Unlink Assessment Template?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will remove the current weighted grading structure from this course. 
                                        Existing raw scores in the database will be preserved.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleUnlinkTemplate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Unlink Structure</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                )}
                
                {loading ? <Skeleton className="h-64 w-full" /> : 
                 selectedCourseId && templateComponents.length > 0 && (filteredRoster.length > 0 || selectedSearchStudentUid) ? (
                    <div className="overflow-x-auto border rounded-lg shadow-sm">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="min-w-[150px]">Student</TableHead>
                                    <TableHead>System ID</TableHead>
                                    {templateComponents.map(c=><TableHead key={c.id} className="text-center">{c.name} ({c.weight}%)</TableHead>)}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRoster.map(s => (
                                    <TableRow key={s.uid}>
                                        <TableCell className="font-bold">{s.name}</TableCell>
                                        <TableCell className="font-mono text-xs opacity-70 uppercase">{s.id}</TableCell>
                                        {templateComponents.map(c => (
                                            <TableCell key={c.id} className="text-center">
                                                <div className="flex items-center justify-center">
                                                    <Input 
                                                        type="number" 
                                                        className="w-20 h-8 text-center font-bold" 
                                                        value={scores[s.uid]?.[c.id]?.score ?? ''} 
                                                        onChange={e => handleScoreChange(s.uid, c.id, e.target.value)} 
                                                    />
                                                </div>
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <Alert variant={selectedCourseId && templateComponents.length === 0 ? "destructive" : "default"}>
                        <AlertCircle className="h-4 w-4"/>
                        <AlertTitle>{selectedCourseId && templateComponents.length === 0 ? "Missing Configuration" : "Information"}</AlertTitle>
                        <AlertDescription className="flex flex-col gap-4">
                            {!selectedCourseId ? (
                                "Identify the cohort and course using the filters above to begin score entry."
                            ) : (studentsInRoster.length === 0 && !selectedSearchStudentUid) ? (
                                "No students match the selected academic phase. Ensure registration is completed for this Year/Semester."
                            ) : (
                                <div className="space-y-4">
                                    <p>This course has no continuous assessment template assigned. You must link a structure to define component weights.</p>
                                    <div className="flex flex-col sm:flex-row items-center gap-4 p-4 border rounded-md bg-background/50">
                                        <div className="flex-1 w-full space-y-1">
                                            <Label className="text-[10px] font-black uppercase">Apply Grading Structure</Label>
                                            <Select value={linkingTemplateId} onValueChange={setLinkingTemplateId}>
                                                <SelectTrigger className="bg-white"><SelectValue placeholder="Select a template..."/></SelectTrigger>
                                                <SelectContent>{templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                        <Button onClick={handleLinkTemplate} disabled={!linkingTemplateId || isLinking} className="mt-5 sm:mt-0">
                                            {isLinking ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <LinkIcon className="mr-2 h-4 w-4"/>}
                                            Link Structure
                                        </Button>
                                        <Separator orientation="vertical" className="hidden sm:block h-10"/>
                                        <Button asChild variant="outline" size="sm" className="mt-5 sm:mt-0">
                                            <Link href="/admin/academics/assessment-setup">
                                                <PlusCircle className="mr-2 h-4 w-4"/> Manage Templates
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
            {selectedCourseId && templateComponents.length > 0 && (filteredRoster.length > 0 || selectedSearchStudentUid) && (
                <CardFooter className="justify-end border-t pt-6"><Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Finalize & Save Scores</Button></CardFooter>
            )}
        </Card>
    );
}
