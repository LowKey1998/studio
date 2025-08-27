
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, Info, Power, PowerOff, ShieldAlert, Pencil, PlusCircle, Calendar as CalendarIcon, FileText, CheckCircle2, AlertCircle, Trash2, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth, createNotification, getAllStudentAndStaffIds } from '@/lib/firebase';
import { ref, get, set, onValue, update, push } from 'firebase/database';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { format, parseISO } from 'date-fns';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

// --- TYPE DEFINITIONS ---
type Course = {
    id: string;
    name: string;
    code: string;
    year: number;
    cost: number;
    status: 'active' | 'archived';
    lecturerName?: string;
};
type Fee = { id: string; name: string; amount: number; };
type FeeTemplate = { id: string; name: string; amount: number; type: 'Mandatory' | 'Optional'; };
type GroupedCourses = { [year: string]: Course[]; };
type Programme = { id: string; name: string; courseIds?: Record<string, boolean>; coursesByYear?: GroupedCourses; tuitionFee?: number; };
type PaymentPlan = { id: string; name: string; installments: number; installmentPercentages: number[]; archived?: boolean; };
type Semester = { id: string; name: string; status: 'Open' | 'Closed' | 'Archived'; lateRegistrationActive?: boolean; startDate?: string; endDate?: string; paymentPlanIds?: Record<string, boolean>; mandatoryFees?: Record<string, Fee>; optionalFees?: Record<string, Fee>; };
type DeadlineInfo = { title: string; date: string | null; eventId: string | null; };
type CoursePath = {
    id: string;
    intakeId: string;
    programmeId: string;
    semesters: Record<string, { courses: string[] }>;
};

// --- MAIN PAGE COMPONENT ---
export default function RegistrationManagementPage() {
    const [programmesWithCourses, setProgrammesWithCourses] = React.useState<Programme[]>([]);
    const [availableForSemester, setAvailableForSemester] = React.useState<string[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [selectedSemester, setSelectedSemester] = React.useState<string>('');
    const [allPaymentPlans, setAllPaymentPlans] = React.useState<PaymentPlan[]>([]);
    const [feeTemplates, setFeeTemplates] = React.useState<FeeTemplate[]>([]);
    
    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
    const [editingSemester, setEditingSemester] = React.useState<Semester | null>(null);

    const [semesterDeadlines, setSemesterDeadlines] = React.useState<DeadlineInfo[]>([]);
    const [deadlineDates, setDeadlineDates] = React.useState<Record<string, Date | undefined>>({});
    const [editingDeadlineId, setEditingDeadlineId] = React.useState<string | null>(null);

    const [semesterOfferings, setSemesterOfferings] = React.useState<Record<string, any>>({});


    const { toast } = useToast();
    
    React.useEffect(() => {
        const refsToWatch = [
            ref(db, 'semesters'),
            ref(db, 'settings/paymentPlans'),
            ref(db, 'settings/feeTemplates'),
            ref(db, 'semesterOfferings')
        ];
        
        const unsubs = refsToWatch.map((refPath, index) => onValue(refPath, (snapshot) => {
            const data = snapshot.val() || {};
            switch(index) {
                case 0:
                    const semesterList: Semester[] = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                    setSemesters(semesterList.sort((a,b) => b.name.localeCompare(a.name)));
                    if (!selectedSemester && semesterList.length > 0) {
                        setSelectedSemester(semesterList[0].id);
                    }
                    break;
                case 1:
                    setAllPaymentPlans(Object.keys(data).map(id => ({ id, ...data[id] })));
                    break;
                case 2:
                    setFeeTemplates(Object.keys(data).map(id => ({ id, ...data[id] })));
                    break;
                case 3:
                    setSemesterOfferings(data);
                    break;
            }
        }));

        return () => unsubs.forEach(unsub => unsub());
    }, [selectedSemester]);


    const fetchDataForSemester = React.useCallback(async () => {
        const semesterData = semesters.find(s => s.id === selectedSemester);
        if (!semesterData) { setLoading(false); return; }
        setLoading(true);
        setSemesterDeadlines([]);
        try {
            const [eventsSnapshot, coursesSnap, usersSnapshot, programmesSnap, coursePathsSnap] = await Promise.all([
                get(ref(db, 'calendarEvents')),
                get(ref(db, 'courses')),
                get(ref(db, 'users')),
                get(ref(db, 'programmes')),
                get(ref(db, 'coursePaths'))
            ]);

            const allCoursesData = coursesSnap.exists() ? coursesSnap.val() : {};
            const allCoursePaths = coursePathsSnap.exists() ? Object.values(coursePathsSnap.val() as Record<string, CoursePath>) : [];
            const pathForSemester = allCoursePaths.find(p => p.semesters && p.semesters[semesterData.id]);
            
            if (pathForSemester && programmesSnap.exists() && coursesSnap.exists()) {
                const userMap = new Map<string, string>();
                if (usersSnapshot.exists()) { Object.entries(usersSnapshot.val()).forEach(([uid, userData]: [string, any]) => userMap.set(uid, userData.name)); }

                const programme = programmesSnap.val()[pathForSemester.programmeId];
                if (programme) {
                    const semesterCourseIds = pathForSemester.semesters[semesterData.id]?.courses || [];
                    const progCourses = semesterCourseIds
                        .map((courseId: string) => {
                            const courseData = allCoursesData[courseId];
                            return courseData && courseData.status === 'active' ? { id: courseId, ...courseData, lecturerName: userMap.get(courseData.lecturerId) || 'N/A' } : null;
                        }).filter(Boolean) as Course[];

                    const coursesByYear = progCourses.reduce((acc, course) => {
                        const yearKey = `Year ${course.year}`;
                        if (!acc[yearKey]) acc[yearKey] = [];
                        acc[yearKey].push(course);
                        return acc;
                    }, {} as GroupedCourses);

                    setProgrammesWithCourses([{ id: pathForSemester.programmeId, name: programme.name, tuitionFee: programme.tuitionFee, coursesByYear: coursesByYear }]);
                } else {
                     setProgrammesWithCourses([]);
                }
            } else {
                 setProgrammesWithCourses([]);
            }

            const semesterOfferingData = semesterOfferings[selectedSemester];
            setAvailableForSemester(semesterOfferingData?.courseIds || []);

        } catch (error) { console.error('Error fetching data:', error); toast({ variant: 'destructive', title: 'Failed to load data' });
        } finally { setLoading(false); }
    }, [selectedSemester, semesters, toast, semesterOfferings]);

    React.useEffect(() => {
        if(selectedSemester){ fetchDataForSemester();
        } else { setProgrammesWithCourses([]); setAvailableForSemester([]); setLoading(false); }
    }, [selectedSemester, fetchDataForSemester]);

    const handleToggleSemesterStatus = async (semester: Semester) => {
        const currentOffering = semesterOfferings[semester.id] || {};
        const newIsOpen = !currentOffering.isOpen;

        try {
            await update(ref(db, `semesterOfferings/${semester.id}`), { isOpen: newIsOpen });
            if (newIsOpen) {
                const studentIds = await getAllStudentAndStaffIds();
                const notificationPromises = studentIds.map(id => createNotification(id, `Registration for ${semester.name} is now open!`, '/student/registration'));
                await Promise.all(notificationPromises);
            }
            toast({ variant: 'success', title: `Registration ${newIsOpen ? 'Opened' : 'Closed'}` });
        } catch (e: any) { toast({ variant: 'destructive', title: 'Update Failed', description: e.message }); }
    };
    
    const handleSelectCourse = (courseId: string) => {
        setAvailableForSemester(prev => prev.includes(courseId) ? prev.filter(id => id !== courseId) : [...prev, courseId]);
    };

    const handleSaveChanges = async () => {
        if (!selectedSemester) return;
        setSaving(true);
        try { 
            await update(ref(db, `semesterOfferings/${selectedSemester}`), { courseIds: availableForSemester });
            toast({ variant: 'success', title: 'Settings Saved', description: `Available courses for ${currentSemester?.name} have been updated.` });
        } catch (error: any) { toast({ variant: 'destructive', title: 'Save Failed', description: error.message || 'An unexpected error occurred.' });
        } finally { setSaving(false); }
    };
    
    const totalSelected = availableForSemester.length;
    const currentSemester = semesters.find(s => s.id === selectedSemester);
    const semesterName = currentSemester?.name || '';
    const isSemesterOpen = !!semesterOfferings[selectedSemester]?.isOpen;

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Registration Management</CardTitle>
                    <CardDescription>Create semesters, manage fees, and select which courses are available for student registration.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-end gap-2">
                        <div className="flex-grow">
                            <Label htmlFor="semester-select">Select Semester</Label>
                            <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                                <SelectTrigger id="semester-select">
                                    <SelectValue placeholder="Select a semester..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {semesters.map(s => (
                                        <SelectItem key={s.id} value={s.id}>
                                            <div className="flex items-center gap-2">
                                                <span className={cn("h-2 w-2 rounded-full", semesterOfferings[s.id]?.isOpen ? 'bg-green-500' : 'bg-red-500')}></span>
                                                {s.name}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                     {currentSemester && (
                        <div className="space-y-4">
                            <div className='flex flex-wrap gap-2'>
                                <Button variant={isSemesterOpen ? 'destructive' : 'default'} onClick={() => handleToggleSemesterStatus(currentSemester)}>
                                    {isSemesterOpen ? <PowerOff className="mr-2 h-4 w-4" /> : <Power className="mr-2 h-4 w-4" />}
                                    {isSemesterOpen ? 'Close Registration' : 'Open Registration'}
                                </Button>
                            </div>
                        </div>
                     )}
                </CardContent>
            </Card>
        
            <Tabs defaultValue="courses" className="w-full">
                <TabsList>
                    <TabsTrigger value="courses">Available Courses</TabsTrigger>
                    <TabsTrigger value="finance">Financial Setup</TabsTrigger>
                </TabsList>
                <TabsContent value="courses">
                    <Card>
                        <CardHeader>
                            <CardTitle>Available Courses for {semesterName}</CardTitle>
                            <CardDescription>Select which courses should be available for registration in this semester.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (<div className="space-y-4 pt-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}</div>
                            ) : selectedSemester ? (programmesWithCourses.length > 0 ? (
                                <Accordion type="multiple" defaultValue={programmesWithCourses.map(p => p.id)} className="w-full">
                                    {programmesWithCourses.map(prog => {
                                        const isFlatFee = !!prog.tuitionFee && prog.tuitionFee > 0;
                                        return (
                                            <AccordionItem value={prog.id} key={prog.id}>
                                                <AccordionTrigger className="font-bold text-lg">{prog.name} {isFlatFee && <Badge className="ml-2">Flat Fee</Badge>}</AccordionTrigger>
                                                <AccordionContent>
                                                    {prog.coursesByYear && Object.keys(prog.coursesByYear).length > 0 ? (
                                                        <Accordion type="multiple" defaultValue={Object.keys(prog.coursesByYear)} className="w-full">
                                                            {Object.entries(prog.coursesByYear).map(([year, courses]) => (
                                                                <AccordionItem value={year} key={year}>
                                                                    <AccordionTrigger className="font-semibold text-base pl-4">{year} Courses</AccordionTrigger>
                                                                    <AccordionContent className="pl-8">
                                                                        <Table>
                                                                            <TableHeader>
                                                                                <TableRow>
                                                                                    <TableHead className="w-[50px]">Enable</TableHead>
                                                                                    <TableHead>Course Code</TableHead>
                                                                                    <TableHead>Course Name</TableHead>
                                                                                    <TableHead>Assigned Lecturer</TableHead>
                                                                                </TableRow>
                                                                            </TableHeader>
                                                                            <TableBody>
                                                                                {courses.map((course) => (
                                                                                    <TableRow key={course.id} data-state={availableForSemester.includes(course.id) ? "selected" : undefined}>
                                                                                        <TableCell>
                                                                                            <Checkbox id={`course-${course.id}`} checked={availableForSemester.includes(course.id)} onCheckedChange={() => handleSelectCourse(course.id)} disabled={isFlatFee}/>
                                                                                        </TableCell>
                                                                                        <TableCell className="font-medium">{course.code}</TableCell>
                                                                                        <TableCell>{course.name}</TableCell>
                                                                                        <TableCell>{course.lecturerName}</TableCell>
                                                                                    </TableRow>
                                                                                ))}
                                                                            </TableBody>
                                                                        </Table>
                                                                    </AccordionContent>
                                                                </AccordionItem>
                                                            ))}
                                                        </Accordion>
                                                    ) : (<p className="text-muted-foreground p-4">No courses assigned to this programme path for this semester.</p>)}
                                                </AccordionContent>
                                            </AccordionItem>
                                        )
                                    })}
                                </Accordion>
                            ) : (<div className="py-16 text-center text-muted-foreground"><BookOpen className="mx-auto h-12 w-12" /><h3 className="mt-4 text-lg font-semibold">No Programmes Found</h3><p className="mt-2 text-sm">No programmes are linked to this semester via a course path.</p></div>
                            )) : (<div className="py-16 text-center text-muted-foreground"><p>Please select a semester to view and manage available courses.</p></div>)}
                        </CardContent>
                        <CardFooter className="flex justify-end items-center gap-4 border-t pt-6">
                            <div className="text-sm text-muted-foreground"><span className="font-bold text-foreground">{totalSelected}</span> course(s) selected for registration</div>
                            <Button onClick={handleSaveChanges} disabled={saving || loading}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{saving ? 'Saving...' : 'Save Changes'}</Button>
                        </CardFooter>
                    </Card>
                </TabsContent>
                 <TabsContent value="finance">
                    <Card>
                        <CardHeader>
                            <CardTitle>Financial Setup for {semesterName}</CardTitle>
                            <CardDescription>An overview of fees and payment plans for this semester.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                           <div>
                                <h4 className="font-semibold mb-2">Mandatory Fees</h4>
                                <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Amount (ZMW)</TableHead></TableRow></TableHeader>
                                <TableBody>{currentSemester?.mandatoryFees ? Object.values(currentSemester.mandatoryFees).map((fee, i) => (
                                    <TableRow key={`mand-${i}`}><TableCell>{fee.name}</TableCell><TableCell className="text-right">{fee.amount.toFixed(2)}</TableCell></TableRow>
                                )) : <TableRow><TableCell colSpan={2} className="h-24 text-center">No mandatory fees.</TableCell></TableRow>}
                                </TableBody></Table>
                           </div>
                           <div>
                                <h4 className="font-semibold mb-2">Optional Fees</h4>
                                <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Amount (ZMW)</TableHead></TableRow></TableHeader>
                                <TableBody>{currentSemester?.optionalFees ? Object.values(currentSemester.optionalFees).map((fee, i) => (
                                    <TableRow key={`opt-${i}`}><TableCell>{fee.name}</TableCell><TableCell className="text-right">{fee.amount.toFixed(2)}</TableCell></TableRow>
                                )) : <TableRow><TableCell colSpan={2} className="h-24 text-center">No optional fees.</TableCell></TableRow>}
                                </TableBody></Table>
                           </div>
                           <div>
                                <h4 className="font-semibold mb-2">Available Payment Plans</h4>
                                {currentSemester?.paymentPlanIds ? (
                                    <div className="flex flex-wrap gap-2">
                                        {Object.keys(currentSemester.paymentPlanIds).map(planId => {
                                            const plan = allPaymentPlans.find(p => p.id === planId);
                                            return plan ? <Badge key={planId} variant="secondary">{plan.name}</Badge> : null;
                                        })}
                                    </div>
                                ) : <p className="text-sm text-muted-foreground">No payment plans are assigned to this semester.</p>}
                           </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
