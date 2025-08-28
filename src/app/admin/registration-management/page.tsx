
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, Route, History, Info, Download, Power, PowerOff, ShieldAlert, Pencil, PlusCircle, Calendar as CalendarIcon, FileText, CheckCircle2, AlertCircle, Trash2, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth, createNotification, getAllStudentAndStaffIds } from '@/lib/firebase';
import { ref, get, set, onValue, update, push, remove } from 'firebase/database';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogClose, DialogFooter } from '@/components/ui/dialog';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { onAuthStateChanged, User } from 'firebase/auth';
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

// --- TYPE DEFINITIONS ---
type Course = { id: string; name: string; code: string; cost: number; year: number; status: 'active' | 'archived'; lecturerName?: string; };
type CalendarEvent = { id: string; title: string; date: string; };
type Fee = { id: string; name: string; amount: number; };
type FeeTemplate = { id: string; name: string; amount: number; type: 'Mandatory' | 'Optional'; };
type GroupedCourses = { [year: string]: Course[]; };
type Programme = { id: string; name: string; courseIds?: Record<string, boolean>; coursesByYear?: GroupedCourses; tuitionFee?: number; };
type PaymentPlan = { id: string; name: string; installments: number; installmentPercentages: number[]; archived?: boolean; };
type Semester = { id: string; name: string; status: 'Open' | 'Closed' | 'Archived'; lateRegistrationActive?: boolean; startDate?: string; endDate?: string; paymentPlanIds?: Record<string, boolean>; mandatoryFees?: Record<string, Fee>; optionalFees?: Record<string, Fee>; intakeId?: string; year?: number; semesterInYear?: number; };
type DeadlineInfo = { title: string; date: string | null; eventId: string | null; };
type Intake = { id: string; name: string; };

const getOrdinalSuffix = (i: number) => {
    if (i === 1) return '1st';
    if (i === 2) return '2nd';
    if (i === 3) return '3rd';
    return `${i}th`;
};

// --- DIALOG CONTENT COMPONENT ---
type CreateOrEditDialogContentProps = {
    editingSemester: Semester | null;
    onClose: () => void;
    onSaveSuccess: () => void;
    allPaymentPlans: PaymentPlan[];
    feeTemplates: FeeTemplate[];
    intakes: Intake[];
};

function CreateOrEditDialogContent({ editingSemester, onClose, onSaveSuccess, allPaymentPlans, feeTemplates, intakes }: CreateOrEditDialogContentProps) {
    const [saving, setSaving] = React.useState(false);
    const [semesterNameInput, setSemesterNameInput] = React.useState('');
    const [semesterDates, setSemesterDates] = React.useState<DateRange | undefined>();
    const [selectedPaymentPlans, setSelectedPaymentPlans] = React.useState<Record<string, boolean>>({});
    const [mandatoryFees, setMandatoryFees] = React.useState<Record<string, Omit<Fee, 'id'>>>({});
    const [optionalFees, setOptionalFees] = React.useState<Record<string, Omit<Fee, 'id'>>>({});
    const [selectedIntake, setSelectedIntake] = React.useState('');
    const [year, setYear] = React.useState<number | ''>('');
    const [semesterInYear, setSemesterInYear] = React.useState<number | ''>('');
    
    const [isMandatoryFeeDialogOpen, setIsMandatoryFeeDialogOpen] = React.useState(false);
    const [isOptionalFeeDialogOpen, setIsOptionalFeeDialogOpen] = React.useState(false);

    const [selectedFeeTemplate, setSelectedFeeTemplate] = React.useState('');
    const [feeAmount, setFeeAmount] = React.useState('');

    const { toast } = useToast();
    
    React.useEffect(() => {
        if (editingSemester) {
            setSemesterNameInput(editingSemester.name || '');
            setSemesterDates({
                from: editingSemester.startDate ? parseISO(editingSemester.startDate) : undefined,
                to: editingSemester.endDate ? parseISO(editingSemester.endDate) : undefined
            });
            setSelectedPaymentPlans(editingSemester.paymentPlanIds || {});
            setMandatoryFees(editingSemester.mandatoryFees || {});
            setOptionalFees(editingSemester.optionalFees || {});
            setSelectedIntake(editingSemester.intakeId || '');
            setYear(editingSemester.year || '');
            setSemesterInYear(editingSemester.semesterInYear || '');
        } else {
             setSemesterNameInput('');
             setSemesterDates(undefined);
             setSelectedPaymentPlans({});
             setMandatoryFees({});
             setOptionalFees({});
             setSelectedIntake('');
             setYear('');
             setSemesterInYear('');
        }
    }, [editingSemester]);


    const handlePlanSelection = (planId: string) => {
        setSelectedPaymentPlans(prev => {
            const newSelection = { ...prev };
            if (newSelection[planId]) delete newSelection[planId];
            else newSelection[planId] = true;
            return newSelection;
        });
    };

    const handleImportFee = (isMandatory: boolean) => {
        if (!selectedFeeTemplate || !feeAmount) { toast({ variant: 'destructive', title: 'Missing Fee Details' }); return; }
        const template = feeTemplates.find(t => t.id === selectedFeeTemplate);
        if (!template) return;
        
        const newFee = { name: template.name, amount: parseFloat(feeAmount) };
        const feeId = push(ref(db, 'semesters')).key!;
        
        if (isMandatory) {
            setMandatoryFees(prev => ({ ...prev, [feeId]: newFee }));
            setIsMandatoryFeeDialogOpen(false);
        } else {
            setOptionalFees(prev => ({ ...prev, [feeId]: newFee }));
            setIsOptionalFeeDialogOpen(false);
        }
        setSelectedFeeTemplate('');
        setFeeAmount('');
    };
    
    const handleDeleteFee = (feeId: string, isMandatory: boolean) => {
        if (isMandatory) {
            setMandatoryFees(prev => {
                const newFees = { ...prev };
                delete newFees[feeId];
                return newFees;
            });
        } else {
            setOptionalFees(prev => {
                const newFees = { ...prev };
                delete newFees[feeId];
                return newFees;
            });
        }
    };

    const handleSaveSemester = async () => {
        if (!semesterNameInput.trim() || !semesterDates?.from) { toast({ variant: 'destructive', title: 'Missing Semester Details'}); return; }
        setSaving(true);
        try {
            const semesterData: Omit<Semester, 'id'> & { id?: string } = {
                ...(editingSemester || {}),
                name: semesterNameInput.trim(),
                status: editingSemester?.status || 'Closed',
                lateRegistrationActive: editingSemester?.lateRegistrationActive || false,
                startDate: format(semesterDates.from, 'yyyy-MM-dd'),
                endDate: semesterDates.to ? format(semesterDates.to, 'yyyy-MM-dd') : format(semesterDates.from, 'yyyy-MM-dd'),
                paymentPlanIds: selectedPaymentPlans,
                mandatoryFees,
                optionalFees,
                intakeId: selectedIntake,
                year: Number(year),
                semesterInYear: Number(semesterInYear),
            };

            if (editingSemester) {
                await update(ref(db, `semesters/${editingSemester.id}`), semesterData);
                toast({ variant: 'success', title: 'Semester Updated' });
            } else {
                await set(push(ref(db, 'semesters')), semesterData);
                toast({ variant: 'success', title: 'Semester Created' });
            }
            onSaveSuccess();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Operation Failed', description: error.message });
        } finally {
            setSaving(false);
        }
    };
    
    const renderFeeContent = (isMandatory: boolean) => {
        const fees = isMandatory ? mandatoryFees : optionalFees;
        const dialogOpenState = isMandatory ? isMandatoryFeeDialogOpen : isOptionalFeeDialogOpen;
        const setDialogOpenState = isMandatory ? setIsMandatoryFeeDialogOpen : setIsOptionalFeeDialogOpen;

        return (
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <Label>{isMandatory ? 'Mandatory Fees' : 'Optional Fees'}</Label>
                    <Dialog open={dialogOpenState} onOpenChange={setDialogOpenState}>
                        <DialogTrigger asChild>
                            <Button size="sm" variant="outline"><PlusCircle className="h-4 w-4 mr-1"/>Import {isMandatory ? 'Mandatory' : 'Optional'} Fee</Button>
                        </DialogTrigger>
                        <DialogContent onInteractOutside={(e) => e.stopPropagation()}>
                            <DialogHeader>
                                <DialogTitle>Import {isMandatory ? 'Mandatory' : 'Optional'} Fee Template</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-1"><Label>Fee Name</Label>
                                    <Select value={selectedFeeTemplate} onValueChange={(val) => {setSelectedFeeTemplate(val); setFeeAmount(String(feeTemplates.find(t => t.id === val)?.amount || ''))}}>
                                        <SelectTrigger><SelectValue placeholder={`Select a ${isMandatory ? 'mandatory' : 'optional'} fee...`}/></SelectTrigger>
                                        <SelectContent>{feeTemplates.filter(t => t.type.toLowerCase() === (isMandatory ? 'mandatory' : 'optional')).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1"><Label>Amount (ZMW)</Label><Input type="number" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} placeholder="e.g., 250" /></div>
                            </div>
                            <DialogFooter>
                                <Button variant="ghost" onClick={() => {setDialogOpenState(false);}}>Cancel</Button>
                                <Button onClick={() => handleImportFee(isMandatory)} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Add Fee to Semester</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
                <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="w-[50px]"></TableHead></TableRow></TableHeader>
                    <TableBody>{Object.keys(fees).length > 0 ? Object.entries(fees).map(([id, fee]) =>
                        <TableRow key={id}><TableCell>{fee.name}</TableCell><TableCell className="text-right">{fee.amount.toFixed(2)}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleDeleteFee(id, isMandatory)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell></TableRow>
                    ) : <TableRow><TableCell colSpan={3} className="text-center h-24">No {isMandatory ? 'mandatory' : 'optional'} fees added.</TableCell></TableRow>}
                    </TableBody>
                </Table>
            </div>
        );
    };


    return (
        <><DialogHeader><DialogTitle>{editingSemester ? 'Edit' : 'Create'} Semester</DialogTitle></DialogHeader>
        <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="details">Details & Plans</TabsTrigger><TabsTrigger value="fees">Fees</TabsTrigger></TabsList>
            <TabsContent value="details">
                <div className="grid gap-4 py-4">
                    <div className="space-y-1"><Label htmlFor="semester-name">Semester Name</Label><Input id="semester-name" value={semesterNameInput} onChange={(e) => setSemesterNameInput(e.target.value)} /></div>
                    <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1"><Label>Intake</Label><Select value={selectedIntake} onValueChange={setSelectedIntake}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{intakes.map(i=><SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-1"><Label>Year</Label><Input type="number" min={1} value={year} onChange={e=>setYear(Number(e.target.value))}/></div>
                        <div className="space-y-1"><Label>Semester in Year</Label><Input type="number" min={1} max={3} value={semesterInYear} onChange={e=>setSemesterInYear(Number(e.target.value))}/></div>
                    </div>
                    <div className="space-y-1"><Label htmlFor="semester-dates">Semester Start & End Dates</Label>
                        <Popover><PopoverTrigger asChild><Button id="semester-dates" variant="outline" className={cn("w-full justify-start text-left font-normal", !semesterDates?.from && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{semesterDates?.from ? (semesterDates.to ? `${format(semesterDates.from, "PPP")} - ${format(semesterDates.to, "PPP")}` : format(semesterDates.from, "PPP")) : <span>Pick a date range</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" selected={semesterDates} onSelect={setSemesterDates} numberOfMonths={2} /></PopoverContent></Popover>
                    </div>
                    <div className="space-y-2"><Label>Available Payment Plans</Label>
                        <div className="space-y-2 rounded-md border p-4 max-h-40 overflow-y-auto">
                            {allPaymentPlans.filter(p => !p.archived).map(plan => (<div key={plan.id} className="flex items-center gap-2"><Checkbox id={`plan-${plan.id}`} checked={!!selectedPaymentPlans[plan.id]} onCheckedChange={() => handlePlanSelection(plan.id)}/><Label htmlFor={`plan-${plan.id}`} className="font-normal">{plan.name}</Label></div>))}
                        </div>
                    </div>
                </div>
            </TabsContent>
            <TabsContent value="fees"><div className="space-y-4 py-4">{renderFeeContent(true)}{renderFeeContent(false)}</div></TabsContent>
        </Tabs>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSaveSemester} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{editingSemester ? 'Save Changes' : 'Create Semester'}</Button></DialogFooter>
        </>
    );
}

// --- AVAILABLE COURSES VIEW COMPONENT ---
function AvailableCoursesView({ semester, programme, allCoursesData, offeringsForSemester }: { semester: Semester, programme: Programme, allCoursesData: Record<string, Course>, offeringsForSemester: string[] }) {
    const [availableForSemester, setAvailableForSemester] = React.useState<string[]>(offeringsForSemester);
    const [coursesForProgramme, setCoursesForProgramme] = React.useState<GroupedCourses>({});
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const { toast } = useToast();

    React.useEffect(() => {
        const fetchCourseData = async () => {
            setLoading(true);
            const userMap = new Map<string, string>();
            const usersSnap = await get(ref(db, 'users'));
            if(usersSnap.exists()) {
                Object.entries(usersSnap.val()).forEach(([uid, userData]: [string, any]) => userMap.set(uid, userData.name));
            }
            const progCourses: Course[] = (programme.courseIds ? Object.keys(programme.courseIds) : [])
                .map((courseId: string) => {
                    const courseData = allCoursesData[courseId];
                    return courseData && courseData.status === 'active' ? { id: courseId, ...courseData, lecturerName: userMap.get(courseData.lecturerId) || 'N/A' } : null;
                }).filter((c): c is Course => !!c);

            const grouped = progCourses.reduce((acc, course) => {
                const yearKey = `Year ${course.year}`;
                if (!acc[yearKey]) acc[yearKey] = [];
                acc[yearKey].push(course);
                return acc;
            }, {} as GroupedCourses);
            setCoursesForProgramme(grouped);
            setLoading(false);
        };
        fetchCourseData();
    }, [programme, allCoursesData]);
    
    const handleSelectCourse = (courseId: string) => {
        setAvailableForSemester(prev => prev.includes(courseId) ? prev.filter(id => id !== courseId) : [...prev, courseId]);
    };

    const handleSaveChanges = async () => {
        setSaving(true);
        try {
            await set(ref(db, `semesterOfferings/${semester.name}/courseIds`), availableForSemester);
            toast({ variant: 'success', title: 'Courses Updated', description: 'Available courses for registration have been saved.' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
        } finally {
            setSaving(false);
        }
    };
    
    const isFlatFee = !!programme.tuitionFee && programme.tuitionFee > 0;

    return (
        <div className="space-y-4">
            {isFlatFee && (
                <Alert><Info className="h-4 w-4" /><AlertDescription>This programme uses a flat semester fee. All courses below are automatically included in registration.</AlertDescription></Alert>
            )}
            <Accordion type="multiple" defaultValue={Object.keys(coursesForProgramme)} className="w-full">
                {loading ? <Skeleton className="h-20" /> : Object.keys(coursesForProgramme).length > 0 ? (
                    Object.entries(coursesForProgramme).map(([year, courses]) => (
                        <AccordionItem value={year} key={year}>
                            <AccordionTrigger className="font-bold text-base">{year}</AccordionTrigger>
                            <AccordionContent>
                                <Table>
                                    <TableHeader><TableRow><TableHead className="w-[50px]">Enable</TableHead><TableHead>Course Code</TableHead><TableHead>Course Name</TableHead><TableHead>Lecturer</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {courses.map(course => (
                                            <TableRow key={course.id} data-state={availableForSemester.includes(course.id) ? 'selected' : undefined}>
                                                <TableCell><Checkbox checked={availableForSemester.includes(course.id)} onCheckedChange={() => handleSelectCourse(course.id)} disabled={isFlatFee} /></TableCell>
                                                <TableCell>{course.code}</TableCell><TableCell>{course.name}</TableCell><TableCell>{course.lecturerName}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </AccordionContent>
                        </AccordionItem>
                    ))
                ) : <p className="text-sm text-center py-4 text-muted-foreground">No courses defined for this programme.</p>}
            </Accordion>
             <div className="flex justify-end"><Button onClick={handleSaveChanges} disabled={saving}>{saving && <Loader2 className="mr-2 h-4"/>} Save Changes</Button></div>
        </div>
    );
}

// --- MAIN PAGE COMPONENT ---
export default function RegistrationManagementPage() {
    const [allIntakes, setAllIntakes] = React.useState<Intake[]>([]);
    const [allProgrammes, setAllProgrammes] = React.useState<Programme[]>([]);
    const [allCourses, setAllCourses] = React.useState<Record<string, Course>>({});
    const [loading, setLoading] = React.useState(true);
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [allPaymentPlans, setAllPaymentPlans] = React.useState<PaymentPlan[]>([]);
    const [feeTemplates, setFeeTemplates] = React.useState<FeeTemplate[]>([]);
    const [semesterOfferings, setSemesterOfferings] = React.useState<Record<string, any>>({});
    
    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
    const [editingSemester, setEditingSemester] = React.useState<Semester | null>(null);

    const [activeTab, setActiveTab] = React.useState<'Open' | 'Closed' | 'Archived'>('Open');
    const [intakeFilter, setIntakeFilter] = React.useState('all');

    const { toast } = useToast();
    
    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [intakesSnap, programmesSnap, coursesSnap, semestersSnap, feeTemplatesSnap, paymentPlansSnap, offeringsSnap] = await Promise.all([
                get(ref(db, 'intakes')), get(ref(db, 'programmes')), get(ref(db, 'courses')),
                get(ref(db, 'semesters')), get(ref(db, 'settings/feeTemplates')),
                get(ref(db, 'settings/paymentPlans')), get(ref(db, 'semesterOfferings')),
            ]);
            
            setAllIntakes(intakesSnap.exists() ? Object.keys(intakesSnap.val()).map(id => ({ id, ...intakesSnap.val()[id] })).sort((a,b) => b.name.localeCompare(a.name)) : []);
            setAllProgrammes(programmesSnap.exists() ? Object.keys(programmesSnap.val()).map(id => ({ id, ...programmesSnap.val()[id] })) : []);
            setAllCourses(coursesSnap.val() || {});
            setSemesters(semestersSnap.exists() ? Object.keys(semestersSnap.val()).map(id => ({ id, ...semestersSnap.val()[id] })) : []);
            setFeeTemplates(feeTemplatesSnap.exists() ? Object.keys(feeTemplatesSnap.val()).map(id => ({ id, ...feeTemplatesSnap.val()[id] })) : []);
            setAllPaymentPlans(paymentPlansSnap.exists() ? Object.keys(paymentPlansSnap.val()).map(id => ({ id, ...paymentPlansSnap.val()[id] })) : []);
            setSemesterOfferings(offeringsSnap.exists() ? offeringsSnap.val() : {});
        } catch (e) { console.error(e) } 
        finally { setLoading(false); }
    }, []);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleToggleSemesterStatus = async (semester: Semester) => {
        const newStatus = semester.status === 'Open' ? 'Closed' : 'Open';
        try {
            await update(ref(db, `semesters/${semester.id}`), { status: newStatus });
            if (newStatus === 'Open') {
                const studentAndStaffIds = await getAllStudentAndStaffIds();
                const notificationPromises = studentAndStaffIds.map(id => createNotification(id, `Registration for ${semester.name} is now open!`, '/student/registration'));
                await Promise.all(notificationPromises);
            }
            toast({ variant: 'success', title: `Semester status updated to ${newStatus}` });
            fetchData();
        } catch (e: any) { toast({ variant: 'destructive', title: 'Update Failed', description: e.message }); }
    };
    
    const handleArchiveSemester = async (semesterId: string) => {
        if(!window.confirm("Are you sure you want to archive this semester? This will hide it from the main view but won't delete data.")) return;
        try {
            await update(ref(db, `semesters/${semesterId}`), { status: 'Archived' });
            toast({ variant: 'success', title: `Semester archived.` });
            fetchData();
        } catch(e: any) {
            toast({ variant: 'destructive', title: 'Archive Failed', description: e.message });
        }
    }
    
    const handleOpenEditDialog = (semester: Semester) => {
        setEditingSemester(semester);
        setIsEditDialogOpen(true);
    };

    const filteredSemesters = React.useMemo(() => {
        return semesters.filter(s => {
            const intakeMatch = intakeFilter === 'all' || s.intakeId === intakeFilter;
            const statusMatch = s.status === activeTab;
            return intakeMatch && statusMatch;
        }).sort((a,b) => b.name.localeCompare(a.name));
    }, [semesters, intakeFilter, activeTab]);

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Registration Management</CardTitle>
                    <CardDescription>Create semesters, manage fees, and select which courses are available for student registration.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                        <div className="flex-1">
                            <Label htmlFor="intake-filter">Filter by Intake</Label>
                            <Select value={intakeFilter} onValueChange={setIntakeFilter}>
                                <SelectTrigger id="intake-filter"><SelectValue placeholder="All Intakes"/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Intakes</SelectItem>
                                    {allIntakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-1 w-full">
                            <Label>Filter by Status</Label>
                            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                                <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="Open">Open</TabsTrigger>
                                    <TabsTrigger value="Closed">Closed</TabsTrigger>
                                    <TabsTrigger value="Archived">Archived</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                        <div className="self-end">
                            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                                <DialogTrigger asChild><Button variant="default"><PlusCircle className="mr-2 h-4 w-4"/> New Semester</Button></DialogTrigger>
                                <DialogContent className="sm:max-w-xl"><CreateOrEditDialogContent editingSemester={null} onClose={() => setIsCreateDialogOpen(false)} onSaveSuccess={() => {fetchData(); setIsCreateDialogOpen(false);}} allPaymentPlans={allPaymentPlans} feeTemplates={feeTemplates} intakes={allIntakes} /></DialogContent>
                            </Dialog>
                        </div>
                    </div>
                     <Accordion type="single" collapsible className="w-full">
                        {loading ? <Skeleton className="h-40 w-full"/> : 
                        filteredSemesters.map(semester => (
                            <AccordionItem value={semester.id} key={semester.id}>
                                <AccordionTrigger className="font-semibold text-lg hover:no-underline">
                                    <div className="flex items-center gap-2">
                                        <span className={cn("h-3 w-3 rounded-full", semester.status === 'Open' ? 'bg-green-500' : semester.status === 'Closed' ? 'bg-red-500' : 'bg-gray-400')}></span>
                                        {semester.name}
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-4">
                                <div className="flex flex-wrap gap-2">
                                    <Button variant={semester.status === 'Open' ? 'destructive' : 'default'} onClick={() => handleToggleSemesterStatus(semester)}><Power className="mr-2 h-4 w-4" />{semester.status === 'Open' ? 'Close Registration' : 'Open Registration'}</Button>
                                    <Button variant="outline" onClick={() => handleOpenEditDialog(semester)}><Pencil className="mr-2 h-4 w-4" /> Edit</Button>
                                    {activeTab !== 'Archived' && (<Button variant="outline" onClick={() => handleArchiveSemester(semester.id)}><Trash2 className="mr-2 h-4 w-4"/> Archive</Button>)}
                                </div>
                                <Tabs defaultValue="courses">
                                    <TabsList>
                                        <TabsTrigger value="courses">Available Courses</TabsTrigger>
                                        <TabsTrigger value="financials">Financial Setup</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="courses" className="pt-4">
                                        <Accordion type="multiple" className="w-full">
                                            {allProgrammes.map(prog => (
                                                <AccordionItem value={prog.id} key={prog.id}>
                                                    <AccordionTrigger>{prog.name}</AccordionTrigger>
                                                    <AccordionContent className="pt-2">
                                                        <AvailableCoursesView 
                                                            semester={semester} 
                                                            programme={prog}
                                                            allCoursesData={allCourses}
                                                            offeringsForSemester={semesterOfferings[semester.name]?.courseIds || []}
                                                        />
                                                    </AccordionContent>
                                                </AccordionItem>
                                            ))}
                                        </Accordion>
                                    </TabsContent>
                                    <TabsContent value="financials" className="pt-4">
                                         <div className="p-4 border rounded-md">
                                            <h4 className="font-semibold mb-2">Semester Financials</h4>
                                            <p className="text-sm">These settings were configured in the semester editor.</p>
                                            <ul className="text-sm mt-2 space-y-1 list-disc pl-5">
                                                <li><strong>Payment Plans:</strong> {Object.keys(semester.paymentPlanIds || {}).length} selected</li>
                                                <li><strong>Mandatory Fees:</strong> {Object.keys(semester.mandatoryFees || {}).length} added</li>
                                                <li><strong>Optional Fees:</strong> {Object.keys(semester.optionalFees || {}).length} added</li>
                                            </ul>
                                         </div>
                                    </TabsContent>
                                </Tabs>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                    {!loading && filteredSemesters.length === 0 && <Alert><AlertCircle className="h-4 w-4"/><AlertTitle>No Semesters Found</AlertTitle><AlertDescription>There are no semesters matching the current filter.</AlertDescription></Alert>}
                </CardContent>
            </Card>
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-xl"><CreateOrEditDialogContent editingSemester={editingSemester} onClose={() => setIsEditDialogOpen(false)} onSaveSuccess={() => {fetchData(); setIsEditDialogOpen(false);}} allPaymentPlans={allPaymentPlans} feeTemplates={feeTemplates} intakes={allIntakes}/></DialogContent>
            </Dialog>
        </div>
    );
}
