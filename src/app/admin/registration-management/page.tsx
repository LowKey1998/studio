
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, Route, History, Info, Download, Power, PowerOff, ShieldAlert, Pencil, PlusCircle, Calendar as CalendarIcon, FileText } from 'lucide-react';
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
import { CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
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
type Course = { id: string; name: string; code: string; year: number; cost: number; };
type GroupedCourses = { [year: string]: Course[]; };
type Programme = { id: string; name: string; courseIds?: Record<string, boolean>; coursesByYear?: GroupedCourses; };
type Intake = { id: string; name: string; };
type CoursePathHistoryItem = { reason: string; oldCourses: string[]; newCourses: string[]; timestamp: any; };
type CoursePathSemester = { courses: string[]; history?: Record<string, CoursePathHistoryItem>; };
type CoursePath = { id: string; intakeId: string; programmeId: string; semesters: Record<string, CoursePathSemester> }; // Key is now semesterId
type Fee = { id: string; name: string; amount: number; };
type FeeTemplate = { id: string; name: string; amount: number; type: 'Mandatory' | 'Optional'; };
type PaymentPlan = { id: string; name: string; installments: number; installmentPercentages: number[]; archived?: boolean; };
type Semester = { id: string; name: string; status: 'Open' | 'Closed' | 'Archived'; lateRegistrationActive?: boolean; lateRegistrationFee?: number; startDate?: string; endDate?: string; paymentPlanIds?: Record<string, boolean>; mandatoryFees?: Record<string, Fee>; optionalFees?: Record<string, Fee>; intakeId: string };
type DeadlineInfo = { title: string; date: string | null; eventId: string | null; };


const getOrdinalSuffix = (i: number) => {
    if (i === 1) return '1st';
    if (i === 2) return '2nd';
    if (i === 3) return '3rd';
    return `${i}th`;
};

// --- DIALOG CONTENT COMPONENT ---
function CreateOrEditDialogContent({ editingSemester, onClose, onSaveSuccess, allPaymentPlans, feeTemplates }: {
    editingSemester: Semester | null;
    onClose: () => void;
    onSaveSuccess: () => void;
    allPaymentPlans: PaymentPlan[];
    feeTemplates: FeeTemplate[];
}) {
    const [saving, setSaving] = React.useState(false);
    const [semesterNameInput, setSemesterNameInput] = React.useState('');
    const [lateRegistrationFee, setLateRegistrationFee] = React.useState<number>(0);
    const [semesterDates, setSemesterDates] = React.useState<DateRange | undefined>();
    const [selectedPaymentPlans, setSelectedPaymentPlans] = React.useState<Record<string, boolean>>({});
    const [mandatoryFees, setMandatoryFees] = React.useState<Record<string, Omit<Fee, 'id'>>>({});
    const [optionalFees, setOptionalFees] = React.useState<Record<string, Omit<Fee, 'id'>>>({});
    
    const [isMandatoryFeeDialogOpen, setIsMandatoryFeeDialogOpen] = React.useState(false);
    const [isOptionalFeeDialogOpen, setIsOptionalFeeDialogOpen] = React.useState(false);

    const [selectedFeeTemplate, setSelectedFeeTemplate] = React.useState('');
    const [feeAmount, setFeeAmount] = React.useState('');

    const { toast } = useToast();
    
    React.useEffect(() => {
        if (editingSemester) {
            setSemesterNameInput(editingSemester.name || '');
            setLateRegistrationFee(editingSemester.lateRegistrationFee || 0);
            setSemesterDates({
                from: editingSemester.startDate ? parseISO(editingSemester.startDate) : undefined,
                to: editingSemester.endDate ? parseISO(editingSemester.endDate) : undefined
            });
            setSelectedPaymentPlans(editingSemester.paymentPlanIds || {});
            setMandatoryFees(editingSemester.mandatoryFees || {});
            setOptionalFees(editingSemester.optionalFees || {});
        } else {
             setSemesterNameInput('');
             setLateRegistrationFee(0);
             setSemesterDates(undefined);
             setSelectedPaymentPlans({});
             setMandatoryFees({});
             setOptionalFees({});
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
                lateRegistrationFee: lateRegistrationFee,
                lateRegistrationActive: editingSemester?.lateRegistrationActive || false,
                startDate: format(semesterDates.from, 'yyyy-MM-dd'),
                endDate: semesterDates.to ? format(semesterDates.to, 'yyyy-MM-dd') : format(semesterDates.from, 'yyyy-MM-dd'),
                paymentPlanIds: selectedPaymentPlans,
                mandatoryFees,
                optionalFees,
                intakeId: editingSemester?.intakeId || '',
            };

            if (editingSemester) {
                await update(ref(db, `semesters/${editingSemester.id}`), semesterData);
                toast({ variant: 'success', title: 'Semester Updated' });
            } else {
                toast({ variant: 'destructive', title: 'Cannot create new semesters here anymore.', description: 'Please use the Course Paths page.'});
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
                            <Button size="sm" type="button" variant="outline" onClick={() => {}}>
                                <PlusCircle className="h-4 w-4 mr-1"/>Add Fee
                            </Button>
                        </DialogTrigger>
                        <DialogContent onInteractOutside={(e) => e.stopPropagation()}>
                            <DialogHeader><DialogTitle>Import {isMandatory ? 'Mandatory' : 'Optional'} Fee</DialogTitle></DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-1"><Label>Fee Name</Label>
                                    <Select value={selectedFeeTemplate} onValueChange={(val) => {setSelectedFeeTemplate(val); setFeeAmount(String(feeTemplates.find(t => t.id === val)?.amount || ''));}}>
                                        <SelectTrigger><SelectValue placeholder={`Select a ${isMandatory ? 'mandatory' : 'optional'} fee...`}/></SelectTrigger>
                                        <SelectContent>{feeTemplates.filter(t => t.type === (isMandatory ? 'Mandatory' : 'Optional')).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1"><Label>Amount (ZMW)</Label><Input type="number" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} placeholder="e.g., 250" /></div>
                            </div>
                            <DialogFooter><Button variant="ghost" onClick={() => {setDialogOpenState(false);}}>Cancel</Button><Button onClick={() => handleImportFee(isMandatory)} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Add Fee to Semester</Button></DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
                 <div className="rounded-md border">
                    <Table>
                        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="w-[50px]"></TableHead></TableRow></TableHeader>
                        <TableBody>{Object.keys(fees).length > 0 ? Object.entries(fees).map(([id, fee]) =>
                            <TableRow key={id}><TableCell>{fee.name}</TableCell><TableCell className="text-right">{(fee.amount || 0).toFixed(2)}</TableCell><TableCell className="text-right"><Button variant="ghost" type="button" size="icon" onClick={() => handleDeleteFee(id, isMandatory)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell></TableRow>
                        ) : <TableRow><TableCell colSpan={3} className="text-center h-24">No {isMandatory ? 'mandatory' : 'optional'} fees added.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </div>
            </div>
        );
    };


    return (
        <><DialogHeader><DialogTitle>{editingSemester ? 'Edit' : 'Create'} Semester</DialogTitle></DialogHeader>
        <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="details">Details & Plans</TabsTrigger><TabsTrigger value="fees">Fees</TabsTrigger></TabsList>
            <TabsContent value="details" className="pt-4">
                <div className="grid gap-4 py-4">
                    <div className="space-y-1"><Label htmlFor="semester-name">Semester Name</Label><Input id="semester-name" value={semesterNameInput} onChange={(e) => setSemesterNameInput(e.target.value)} /></div>
                    <div className="space-y-1"><Label htmlFor="semester-dates">Semester Start & End Dates</Label>
                        <Popover><PopoverTrigger asChild><Button id="semester-dates" variant="outline" className={cn("w-full justify-start text-left font-normal", !semesterDates?.from && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{semesterDates?.from ? (semesterDates.to ? `${format(semesterDates.from, "PPP")} - ${format(semesterDates.to, "PPP")}` : format(semesterDates.from, "PPP")) : <span>Pick a date range</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" selected={semesterDates} onSelect={setSemesterDates} numberOfMonths={2} /></PopoverContent></Popover>
                    </div>
                     <div className="space-y-1"><Label htmlFor="late-fee">Late Registration Fee (ZMW)</Label><Input id="late-fee" type="number" value={lateRegistrationFee} onChange={(e) => setLateRegistrationFee(Number(e.target.value))} /></div>
                    <div className="space-y-2"><Label>Available Payment Plans</Label>
                        <div className="space-y-2 rounded-md border p-4 max-h-40 overflow-y-auto">
                            {allPaymentPlans.filter(p => !p.archived).map(plan => (<div key={plan.id} className="flex items-center gap-2"><Checkbox id={`plan-${plan.id}`} checked={!!selectedPaymentPlans[plan.id]} onCheckedChange={() => handlePlanSelection(plan.id)}/><Label htmlFor={`plan-${plan.id}`} className="font-normal">{plan.name}</Label></div>))}
                        </div>
                    </div>
                </div>
            </TabsContent>
            <TabsContent value="fees" className="pt-4"><div className="space-y-4 py-4">{renderFeeContent(true)}{renderFeeContent(false)}</div></TabsContent>
        </Tabs>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSaveSemester} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{editingSemester ? 'Save Changes' : 'Create Semester'}</Button></DialogFooter>
        </>
    );
}

// --- MAIN PAGE COMPONENT ---
export default function RegistrationManagementPage() {
    const [allCourses, setAllCourses] = React.useState<Record<string, Course>>({});
    const [loading, setLoading] = React.useState(true);
    
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [selectedSemester, setSelectedSemester] = React.useState<string>('');
    const [allPaymentPlans, setAllPaymentPlans] = React.useState<PaymentPlan[]>([]);
    const [feeTemplates, setFeeTemplates] = React.useState<FeeTemplate[]>([]);
    const [allProgrammes, setAllProgrammes] = React.useState<Programme[]>([]);
    const [allCoursePaths, setAllCoursePaths] = React.useState<CoursePath[]>([]);

    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
    const [editingSemester, setEditingSemester] = React.useState<Semester | null>(null);

    const [semesterDeadlines, setSemesterDeadlines] = React.useState<DeadlineInfo[]>([]);

    const { toast } = useToast();
    
    const refreshData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [
                paymentPlansSnap, 
                semestersSnap, 
                feeTemplatesSnap, 
                programmesSnap,
                coursePathsSnap,
                coursesSnap,
            ] = await Promise.all([
                get(ref(db, 'settings/paymentPlans')),
                get(ref(db, 'semesters')), 
                get(ref(db, 'settings/feeTemplates')),
                get(ref(db, 'programmes')),
                get(ref(db, 'coursePaths')),
                get(ref(db, 'courses')),
            ]);

            const semesterList = semestersSnap.exists() ? Object.keys(semestersSnap.val()).map(id => ({ id, ...semestersSnap.val()[id] })).sort((a,b) => b.name.localeCompare(a.name)) : [];
            setSemesters(semesterList);

            setAllProgrammes(programmesSnap.exists() ? Object.keys(programmesSnap.val()).map(id => ({ id, ...programmesSnap.val()[id] })) : []);
            setAllCoursePaths(coursePathsSnap.exists() ? Object.values(coursePathsSnap.val()) : []);
            setAllCourses(coursesSnap.val() || {});
            
            setAllPaymentPlans(paymentPlansSnap.exists() ? Object.keys(paymentPlansSnap.val()).map(id => ({ id, ...paymentPlansSnap.val()[id] })) : []);
            setFeeTemplates(feeTemplatesSnap.exists() ? Object.keys(feeTemplatesSnap.val()).map(id => ({ id, ...feeTemplatesSnap.val()[id] })) : []);

             if (!selectedSemester && semesterList.length > 0) {
                setSelectedSemester(semesterList[0].id);
            }
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Failed to refresh data' });
        } finally {
            setLoading(false);
        }
    }, [toast, selectedSemester]);

    React.useEffect(() => {
        refreshData();
    }, []);

    const fetchDataForSemester = React.useCallback(async () => {
        const semesterData = semesters.find(s => s.id === selectedSemester);
        if (!semesterData) { return; }
        setLoading(true);
        setSemesterDeadlines([]);
        try {
            const eventsSnapshot = await get(ref(db, 'calendarEvents'));

            const eventMap = new Map<string, {date: string, id: string}>();
            if (eventsSnapshot.exists()) { 
                Object.entries(eventsSnapshot.val()).forEach(([id, event]:[string, any]) => {
                    eventMap.set(event.title.trim(), { date: event.date, id });
                });
            }
            const linkedPlanIds = Object.keys(semesterData.paymentPlanIds || {});
            const linkedPlans = allPaymentPlans.filter(p => linkedPlanIds.includes(p.id));

            const requiredDeadlines: string[] = [];
            linkedPlans.forEach(plan => {
                 for (let i = 0; i < plan.installments; i++) {
                    requiredDeadlines.push(`${plan.name} (${getOrdinalSuffix(i + 1)} Installment) Deadline - ${semesterData.name}`);
                }
            })
            setSemesterDeadlines(requiredDeadlines.map(title => {
                const existing = eventMap.get(title.trim());
                return { title: title.replace(` - ${semesterData.name}`, ''), date: existing?.date || null, eventId: existing?.id || null };
            }));

        } catch (error) { console.error('Error fetching data:', error); toast({ variant: 'destructive', title: 'Failed to load data' });
        } finally { setLoading(false); }
    }, [selectedSemester, semesters, toast, allPaymentPlans]);

    React.useEffect(() => {
        if(selectedSemester){ fetchDataForSemester();
        } else { setLoading(false); }
    }, [selectedSemester, fetchDataForSemester]);

    const handleToggleSemesterStatus = async (semester: Semester) => {
        let newStatus: Semester['status'] = semester.status === 'Open' ? 'Closed' : 'Open';
        
        try {
            await update(ref(db, `semesters/${semester.id}`), { status: newStatus });
            if (newStatus === 'Open') {
                const studentIds = await getAllStudentAndStaffIds();
                const notificationPromises = studentIds.map(id => createNotification(id, `Registration for ${semester.name} is now open!`, '/student/registration'));
                await Promise.all(notificationPromises);
            }
            toast({ variant: 'success', title: `Semester status updated to ${newStatus}` });
            refreshData();
        } catch (e: any) { toast({ variant: 'destructive', title: 'Update Failed', description: e.message }); }
    };
    
    const handleToggleLateRegistration = async (semester: Semester) => {
        const newStatus = !(semester.lateRegistrationActive ?? false);
        try { await update(ref(db, `semesters/${semester.id}`), { lateRegistrationActive: newStatus });
             toast({ variant: 'success', title: `Late Registration ${newStatus ? 'Enabled' : 'Disabled'}` });
             refreshData();
        } catch (e: any) { toast({ variant: 'destructive', title: 'Update Failed', description: e.message }); }
    };
    
    const currentSemester = semesters.find(s => s.id === selectedSemester);
    const semesterName = currentSemester?.name || '';
    const canSave = semesterDeadlines.every(d => d.date !== null);

    const programmesForSemester = React.useMemo(() => {
        if (!currentSemester) return [];
        return allProgrammes.filter(prog => 
            allCoursePaths.some(path => 
                path.intakeId === currentSemester.intakeId && path.programmeId === prog.id
            )
        );
    }, [currentSemester, allProgrammes, allCoursePaths]);

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="font-headline text-2xl">Registration Management</CardTitle>
                            <CardDescription>Create semesters, manage fees, and control registration periods.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                     <div className="flex items-end gap-2">
                        <div className="flex-grow">
                            <Label htmlFor="semester-select">Select Semester</Label>
                            <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                                <SelectTrigger id="semester-select"><SelectValue placeholder="Select a semester..." /></SelectTrigger>
                                <SelectContent>{semesters.map(s => (<SelectItem key={s.id} value={s.id}><div className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", s.status === 'Open' ? 'bg-green-500' : s.status === 'Closed' ? 'bg-red-500' : 'bg-gray-400')}></span>{s.name} ({s.status})</div></SelectItem>))}</SelectContent>
                            </Select>
                        </div>
                         <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                            <DialogTrigger asChild><Button variant="outline" disabled={!currentSemester} onClick={() => setEditingSemester(currentSemester)}><Pencil className="mr-2 h-4 w-4" /> Edit</Button></DialogTrigger>
                            <DialogContent className="sm:max-w-xl"><CreateOrEditDialogContent editingSemester={editingSemester} onClose={() => setIsEditDialogOpen(false)} onSaveSuccess={() => { refreshData(); setIsEditDialogOpen(false); }} allPaymentPlans={allPaymentPlans} feeTemplates={feeTemplates} /></DialogContent>
                        </Dialog>
                    </div>
                </CardContent>
            </Card>

            {currentSemester && (
            <Card>
                <CardHeader className="flex-row justify-between items-center">
                    <CardTitle className="text-xl">Controls for {currentSemester.name}</CardTitle>
                    <div className='flex flex-wrap gap-2'>
                        <Button variant={currentSemester.status === 'Open' ? 'destructive' : 'default'} onClick={() => handleToggleSemesterStatus(currentSemester)} disabled={!canSave && currentSemester.status !== 'Open'} title={!canSave && currentSemester.status !== 'Open' ? 'Set payment deadlines first' : ''}>{currentSemester.status === 'Open' ? <PowerOff className="mr-2 h-4 w-4" /> : <Power className="mr-2 h-4 w-4" />}{currentSemester.status === 'Open' ? 'Close Registration' : 'Open Registration'}</Button>
                        {currentSemester.status === 'Open' && (<Button variant={currentSemester.lateRegistrationActive ? 'destructive' : 'secondary'} onClick={() => handleToggleLateRegistration(currentSemester)}><ShieldAlert className="mr-2 h-4 w-4" />{currentSemester.lateRegistrationActive ? 'Disable Late Registration' : 'Enable Late Registration'}</Button>)}
                    </div>
                </CardHeader>
                 <CardContent>
                    {!loading && !canSave && currentSemester.status !== 'Open' && (
                        <Alert variant="destructive" className="mt-4">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Action Required: Missing Payment Deadlines</AlertTitle>
                            <AlertDescription>
                                <p>You cannot open registration for <strong>{semesterName}</strong> until all payment deadlines for its linked payment plans are set. Please go to the 'Financial Setup' tab below to set them.</p>
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>
            )}

            {currentSemester && (
                 <Tabs defaultValue="courses" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="courses">Courses</TabsTrigger>
                        <TabsTrigger value="finance">Financial Setup</TabsTrigger>
                    </TabsList>
                    <TabsContent value="courses">
                        <Card>
                             <CardHeader>
                                <CardTitle>Available Courses for {semesterName}</CardTitle>
                                <CardDescription>A summary of all courses that are part of this semester through a course path.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loading ? <Skeleton className="h-48 w-full" /> : 
                                programmesForSemester.length > 0 ? (
                                <Accordion type="multiple" defaultValue={programmesForSemester.map(p => p.id)} className="w-full">
                                    {programmesForSemester.map(prog => {
                                        const path = allCoursePaths.find(p => p.intakeId === currentSemester.intakeId && p.programmeId === prog.id);
                                        if (!path || !path.semesters) return null;
                                        
                                        const pathSemester = Object.entries(path.semesters).find(([semId, semData]) => semId === selectedSemester);
                                        if (!pathSemester) return null;
                                        
                                        const semesterCourseIds = pathSemester[1].courses || [];
                                        const courses = semesterCourseIds.map(id => ({...allCourses[id], id})).filter(c => c.name);

                                        return (
                                            <AccordionItem value={prog.id} key={prog.id}>
                                                <AccordionTrigger className="font-bold text-lg">{prog.name}</AccordionTrigger>
                                                <AccordionContent>
                                                    <Table>
                                                        <TableHeader><TableRow><TableHead>Course Code</TableHead><TableHead>Course Name</TableHead></TableRow></TableHeader>
                                                        <TableBody>{courses.map(c => (
                                                            <TableRow key={c.id}>
                                                                <TableCell>{c.code}</TableCell>
                                                                <TableCell>{c.name}</TableCell>
                                                            </TableRow>
                                                        ))}</TableBody>
                                                    </Table>
                                                </AccordionContent>
                                            </AccordionItem>
                                        )
                                    })}
                                    </Accordion>
                                ) : (
                                    <div className="py-16 text-center text-muted-foreground">
                                        <BookOpen className="mx-auto h-12 w-12" />
                                        <h3 className="mt-4 text-lg font-semibold">No Programmes Found</h3>
                                        <p className="mt-2 text-sm">No programmes have a course path defined that includes this semester.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="finance">
                         <Card>
                           <CardContent className="pt-6 grid md:grid-cols-2 gap-8">
                                 <div>
                                    <h4 className="font-semibold mb-2">Fees for {semesterName}</h4>
                                    <div className="border rounded-lg p-3 space-y-2 text-sm">
                                        <p className="font-bold">Mandatory:</p>
                                        {currentSemester.mandatoryFees ? Object.values(currentSemester.mandatoryFees).map((fee, i) => <div key={i} className="flex justify-between"><span>{fee.name}</span><span>ZMW {(fee.amount || 0).toFixed(2)}</span></div>) : <p className="text-muted-foreground text-xs">None</p>}
                                        <Separator className="my-2"/>
                                        <p className="font-bold">Optional:</p>
                                        {currentSemester.optionalFees ? Object.values(currentSemester.optionalFees).map((fee, i) => <div key={i} className="flex justify-between"><span>{fee.name}</span><span>ZMW {(fee.amount || 0).toFixed(2)}</span></div>) : <p className="text-muted-foreground text-xs">None</p>}
                                        <Separator className="my-2"/>
                                        <p className="font-bold">Late Fee:</p>
                                        <div className="flex justify-between"><span>Late Registration</span><span>ZMW {(currentSemester.lateRegistrationFee || 0).toFixed(2)}</span></div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="font-semibold">Linked Payment Plans & Deadlines</h4>
                                    <div className="space-y-4">
                                        {(currentSemester.paymentPlanIds ? allPaymentPlans.filter(p => currentSemester.paymentPlanIds![p.id]) : []).map(plan => {
                                            const deadlines = semesterDeadlines.filter(d => d.title.startsWith(plan.name));
                                            return (
                                                <div key={plan.id} className="border rounded-md p-3">
                                                    <h5 className="font-bold">{plan.name}</h5>
                                                    <ul className="text-sm text-muted-foreground mt-2 list-disc pl-5">
                                                        {deadlines.length > 0 ? deadlines.map(deadline => (
                                                            <li key={deadline.title}>{deadline.title.replace(`${plan.name} (`, '').replace(')', '')}: <span className="font-semibold">{deadline.date ? format(parseISO(deadline.date), 'PPP') : 'Not Set'}</span></li>
                                                        )) : <li>No deadlines set in Calendar.</li>}
                                                    </ul>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}
