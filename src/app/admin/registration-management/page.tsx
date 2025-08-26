
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

// --- TYPE DEFINITIONS ---
type Course = { id: string; name: string; code: string; };
type Intake = { id: string; name: string; };
type Programme = { id: string; name: string; };
type CoursePathHistoryItem = { reason: string; oldCourses: string[]; newCourses: string[]; timestamp: any; };
type CoursePathSemester = { courses: string[]; history?: Record<string, CoursePathHistoryItem>; };
type CoursePath = { id: string; intakeId: string; programmeId: string; semesters: Record<string, CoursePathSemester> }; // Key is semesterId
type Fee = { id: string; name: string; amount: number; };
type FeeTemplate = { id: string; name: string; amount: number; type: 'Mandatory' | 'Optional'; };
type PaymentPlan = { id: string; name: string; installments: number; installmentPercentages: number[]; archived?: boolean; };
type Semester = { id: string; name: string; status: 'Open' | 'Closed' | 'Archived'; lateRegistrationActive?: boolean; lateRegistrationFee?: number; startDate?: string; endDate?: string; paymentPlanIds?: Record<string, boolean>; mandatoryFees?: Record<string, Fee>; optionalFees?: Record<string, Fee>; };
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
            };

            if (editingSemester) {
                await update(ref(db, `semesters/${editingSemester.id}`), semesterData);
                toast({ variant: 'success', title: 'Semester Updated' });
            } else {
                await set(push(ref(db, 'semesters')), {...semesterData});
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
        const dialogOpenState = isMandatory ? isMandatoryFeeDialogOpen : setIsOptionalFeeDialogOpen;
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
                            <TableRow key={id}><TableCell>{fee.name}</TableCell><TableCell className="text-right">{fee.amount.toFixed(2)}</TableCell><TableCell className="text-right"><Button variant="ghost" type="button" size="icon" onClick={() => handleDeleteFee(id, isMandatory)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell></TableRow>
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
    const [saving, setSaving] = React.useState(false);
    
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [selectedSemester, setSelectedSemester] = React.useState<string>('');
    const [allPaymentPlans, setAllPaymentPlans] = React.useState<PaymentPlan[]>([]);
    const [feeTemplates, setFeeTemplates] = React.useState<FeeTemplate[]>([]);
    const [allCalendarEvents, setAllCalendarEvents] = React.useState<CalendarEvent[]>([]);

    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
    const [editingSemester, setEditingSemester] = React.useState<Semester | null>(null);

    const { toast } = useToast();
    
    const refreshData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [
                coursesSnap,
                paymentPlansSnap, 
                semestersSnap, 
                feeTemplatesSnap, 
                eventsSnap
            ] = await Promise.all([
                get(ref(db, 'courses')),
                get(ref(db, 'settings/paymentPlans')),
                get(ref(db, 'semesters')), 
                get(ref(db, 'settings/feeTemplates')),
                get(ref(db, 'calendarEvents'))
            ]);

            setAllCourses(coursesSnap.exists() ? coursesSnap.val() : {});
            
            const semesterList = semestersSnap.exists() ? Object.keys(semestersSnap.val()).map(id => ({ id, ...semestersSnap.val()[id] })).sort((a,b) => b.name.localeCompare(a.name)) : [];
            setSemesters(semesterList);
            
            setAllPaymentPlans(paymentPlansSnap.exists() ? Object.keys(paymentPlansSnap.val()).map(id => ({ id, ...paymentPlansSnap.val()[id] })) : []);
            setFeeTemplates(feeTemplatesSnap.exists() ? Object.keys(feeTemplatesSnap.val()).map(id => ({ id, ...feeTemplatesSnap.val()[id] })) : []);
            setAllCalendarEvents(eventsSnap.exists() ? Object.keys(eventsSnap.val()).map(id => ({ id, ...eventsSnap.val()[id] })) : []);

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
    
    const handleToggleSemesterStatus = async (semester: Semester) => {
        const canOpen = semesterDeadlines.every(d => d.date !== null);
        if (!canOpen && semester.status !== 'Open') {
            toast({variant: 'destructive', title: 'Action Required', description: 'Set all payment deadlines before opening registration.'});
            return;
        }

        let newStatus: Semester['status'] = semester.status === 'Open' ? 'Closed' : 'Open';
        
        try {
            await update(ref(db, `semesters/${semester.id}`), { status: newStatus });
            if (newStatus === 'Open') {
                const studentIds = await getAllStudentAndStaffIds();
                const notificationPromises = studentIds.map(id => createNotification(id, `Registration for ${semester.name} is now open!`, '/student/registration'));
                await Promise.all(notificationPromises);
            }
            toast({ variant: 'success', title: `Semester status updated to ${newStatus}` });
        } catch (e: any) { toast({ variant: 'destructive', title: 'Update Failed', description: e.message }); }
    };
    
    const handleToggleLateRegistration = async (semester: Semester) => {
        const newStatus = !(semester.lateRegistrationActive ?? false);
        try { await update(ref(db, `semesters/${semester.id}`), { lateRegistrationActive: newStatus });
             toast({ variant: 'success', title: `Late Registration ${newStatus ? 'Enabled' : 'Disabled'}` });
        } catch (e: any) { toast({ variant: 'destructive', title: 'Update Failed', description: e.message }); }
    };
    
    const currentSemester = semesters.find(s => s.id === selectedSemester);
    
    const semesterDeadlines = React.useMemo(() => {
        if (!currentSemester) return [];
        const linkedPlanIds = Object.keys(currentSemester.paymentPlanIds || {});
        const linkedPlans = allPaymentPlans.filter(p => linkedPlanIds.includes(p.id));
        const eventMap = new Map(allCalendarEvents.map(e => [e.title.trim(), { date: e.date, id: e.id }]));
        const requiredDeadlines: DeadlineInfo[] = [];

        linkedPlans.forEach(plan => {
            for (let i = 0; i < plan.installments; i++) {
                const deadlineTitle = `${plan.name} (${getOrdinalSuffix(i + 1)} Installment) Deadline - ${currentSemester.name}`;
                const existing = eventMap.get(deadlineTitle.trim());
                requiredDeadlines.push({ title: `${plan.name} (${getOrdinalSuffix(i + 1)} Installment)`, date: existing?.date || null, eventId: existing?.id || null });
            }
        });
        return requiredDeadlines;
    }, [currentSemester, allPaymentPlans, allCalendarEvents]);

    const canSave = semesterDeadlines.every(d => d.date !== null);

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="font-headline text-2xl">Registration Management</CardTitle>
                            <CardDescription>Create semesters, manage fees, and control registration periods.</CardDescription>
                        </div>
                        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                            <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/> New Semester</Button></DialogTrigger>
                            <DialogContent className="sm:max-w-xl"><CreateOrEditDialogContent editingSemester={null} onClose={() => setIsCreateDialogOpen(false)} onSaveSuccess={() => { refreshData(); setIsCreateDialogOpen(false); }} allPaymentPlans={allPaymentPlans} feeTemplates={feeTemplates} /></DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent>
                     <div className="flex items-end gap-2"><div className="flex-grow"><Label htmlFor="semester-select">Select Semester</Label>
                        <Select value={selectedSemester} onValueChange={setSelectedSemester}><SelectTrigger id="semester-select"><SelectValue placeholder="Select a semester..." /></SelectTrigger>
                            <SelectContent>{semesters.map(s => (<SelectItem key={s.id} value={s.id}><div className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", s.status === 'Open' ? 'bg-green-500' : s.status === 'Closed' ? 'bg-red-500' : 'bg-gray-400')}></span>{s.name} ({s.status})</div></SelectItem>))}</SelectContent>
                        </Select>
                    </div>
                    {currentSemester && (
                        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                            <DialogTrigger asChild><Button variant="outline" onClick={() => setEditingSemester(currentSemester)}><Pencil className="mr-2 h-4 w-4" /> Edit</Button></DialogTrigger>
                            <DialogContent className="sm:max-w-xl"><CreateOrEditDialogContent editingSemester={editingSemester} onClose={() => setIsEditDialogOpen(false)} onSaveSuccess={() => { refreshData(); setIsEditDialogOpen(false); }} allPaymentPlans={allPaymentPlans} feeTemplates={feeTemplates} /></DialogContent>
                        </Dialog>
                    )}
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
                {!loading && !canSave && currentSemester.status !== 'Open' && (<CardContent><Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Action Required: Missing Payment Deadlines</AlertTitle><AlertDescription><p>You cannot open registration for <strong>{currentSemester.name}</strong> until all payment deadlines for its linked payment plans are set. The following are missing:</p><ul className="list-disc pl-5 mt-2 mb-3 text-xs">{semesterDeadlines.filter(d => d.date === null).map(d => <li key={d.title}>{d.title}</li>)}</ul><Button asChild variant="link" className="p-0 h-auto"><Link href="/admin/calendar">Go to Calendar to add deadlines</Link></Button></AlertDescription></Alert></CardContent>)}
            </Card>
            )}

            {currentSemester && (
            <Card>
                <CardHeader>
                    <CardTitle>Financial Setup for {currentSemester.name}</CardTitle>
                    <CardDescription>An overview of fees, payment plans, and their deadlines for this semester.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <h4 className="font-semibold">Mandatory Fees</h4>
                            <div className="border rounded-md p-2 space-y-1 text-sm">{currentSemester.mandatoryFees ? Object.values(currentSemester.mandatoryFees).map((fee, i) => <div key={i} className="flex justify-between"><span>{fee.name}</span><span>ZMW {fee.amount.toFixed(2)}</span></div>) : <p className="text-muted-foreground">None</p>}</div>
                        </div>
                         <div className="space-y-2">
                            <h4 className="font-semibold">Optional Fees</h4>
                            <div className="border rounded-md p-2 space-y-1 text-sm">{currentSemester.optionalFees ? Object.values(currentSemester.optionalFees).map((fee, i) => <div key={i} className="flex justify-between"><span>{fee.name}</span><span>ZMW {fee.amount.toFixed(2)}</span></div>) : <p className="text-muted-foreground">None</p>}</div>
                        </div>
                         <div className="space-y-2">
                            <h4 className="font-semibold">Late Registration Fee</h4>
                            <p className="font-bold text-lg">ZMW {(currentSemester.lateRegistrationFee || 0).toFixed(2)}</p>
                         </div>
                    </div>
                    <Separator/>
                     <div>
                        <h4 className="font-semibold mb-2">Linked Payment Plans & Deadlines</h4>
                        <div className="grid md:grid-cols-2 gap-4">
                            {(currentSemester.paymentPlanIds ? allPaymentPlans.filter(p => currentSemester.paymentPlanIds![p.id]) : []).map(plan => (
                                <div key={plan.id} className="border rounded-md p-3">
                                    <h5 className="font-bold">{plan.name}</h5>
                                    <ul className="text-sm text-muted-foreground mt-2 list-disc pl-5">
                                        {semesterDeadlines.filter(d => d.title.startsWith(plan.name)).map(deadline => (
                                            <li key={deadline.title}>{deadline.title}: <span className={cn("font-semibold", !deadline.date && "text-destructive")}>{deadline.date ? format(parseISO(deadline.date), 'PPP') : 'Not Set'}</span></li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
            )}

            {currentSemester && (
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="text-xl">Available Courses for {currentSemester.name}</CardTitle>
                    <CardDescription>This information is now managed on the <Link href="/admin/course-paths" className="underline text-primary">Intakes / Course Paths</Link> page.</CardDescription>
                </CardHeader>
            </Card>
            )}
        </div>
    );
}
