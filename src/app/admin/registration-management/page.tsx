
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, Route, History, Info, Download, Power, PowerOff, ShieldAlert, Pencil, PlusCircle, Calendar as CalendarIcon, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth, createNotification, getAllStudentAndStaffIds } from '@/lib/firebase';
import { ref, get, set, onValue, update, push } from 'firebase/database';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogClose, DialogFooter } from '@/components/ui/dialog';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from '@/components/ui/table';

// --- TYPE DEFINITIONS ---
type Course = { id: string; name: string; code: string; };
type Intake = { id: string; name: string; };
type Programme = { id: string; name: string; };
type CoursePathHistoryItem = { reason: string; oldCourses: string[]; newCourses: string[]; timestamp: any; };
type CoursePathSemester = { courses: string[]; history?: Record<string, CoursePathHistoryItem>; };
type CoursePath = { id: string; intakeId: string; programmeId: string; semesters: Record<number, CoursePathSemester> };
type Fee = { id: string; name: string; amount: number; };
type FeeTemplate = { id: string; name: string; amount: number; type: 'Mandatory' | 'Optional'; };
type PaymentPlan = { id: string; name: string; installments: number; installmentPercentages: number[]; archived?: boolean; };
type Semester = { id: string; name: string; status: 'Open' | 'Closed' | 'Archived'; lateRegistrationActive?: boolean; startDate?: string; endDate?: string; paymentPlanIds?: Record<string, boolean>; mandatoryFees?: Record<string, Fee>; optionalFees?: Record<string, Fee>; lateRegistrationFee?: number; };
type DeadlineInfo = { title: string; date: string | null; eventId: string | null; };


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
};

function CreateOrEditDialogContent({ editingSemester, onClose, onSaveSuccess, allPaymentPlans, feeTemplates }: CreateOrEditDialogContentProps) {
    const [saving, setSaving] = React.useState(false);
    const [semesterNameInput, setSemesterNameInput] = React.useState('');
    const [semesterDates, setSemesterDates] = React.useState<DateRange | undefined>();
    const [selectedPaymentPlans, setSelectedPaymentPlans] = React.useState<Record<string, boolean>>({});
    const [mandatoryFees, setMandatoryFees] = React.useState<Record<string, Omit<Fee, 'id'>>>({});
    const [optionalFees, setOptionalFees] = React.useState<Record<string, Omit<Fee, 'id'>>>({});
    const [lateRegistrationFee, setLateRegistrationFee] = React.useState<number | string>('');
    
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
            setLateRegistrationFee(editingSemester.lateRegistrationFee || '');
        } else {
             setSemesterNameInput('');
             setSemesterDates(undefined);
             setSelectedPaymentPlans({});
             setMandatoryFees({});
             setOptionalFees({});
             setLateRegistrationFee('');
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
                lateRegistrationFee: Number(lateRegistrationFee) || 0
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
                            <Button size="sm" variant="outline"><PlusCircle className="h-4 w-4 mr-1"/>Import Fee</Button>
                        </DialogTrigger>
                        <DialogContent onInteractOutside={(e) => e.stopPropagation()}>
                            <DialogHeader>
                                <DialogTitle>Import Fee Template</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-1"><Label>Fee Name</Label>
                                    <Select value={selectedFeeTemplate} onValueChange={(val) => {setSelectedFeeTemplate(val); setFeeAmount(String(feeTemplates.find(t => t.id === val)?.amount || ''));}}>
                                        <SelectTrigger><SelectValue placeholder={`Select a fee...`}/></SelectTrigger>
                                        <SelectContent>{feeTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.name} ({t.type})</SelectItem>)}</SelectContent>
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
            <TabsContent value="fees"><div className="space-y-4 py-4">
                 {renderFeeContent(true)}
                 <Separator/>
                 {renderFeeContent(false)}
                 <Separator/>
                 <div className="space-y-1">
                    <Label htmlFor="late-fee">Late Registration Fee (ZMW)</Label>
                    <Input id="late-fee" type="number" value={lateRegistrationFee} onChange={e => setLateRegistrationFee(e.target.value)} />
                 </div>
            </div></TabsContent>
        </Tabs>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSaveSemester} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{editingSemester ? 'Save Changes' : 'Create Semester'}</Button></DialogFooter>
        </>
    );
}

// --- MAIN PAGE COMPONENT ---
export default function RegistrationManagementPage() {
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
    const [isDeadlineDialogOpen, setIsDeadlineDialogOpen] = React.useState(false);

    const { toast } = useToast();
    
    const refreshData = React.useCallback(async () => {
        const semestersRef = ref(db, 'semesters');
        const paymentPlansRef = ref(db, 'settings/paymentPlans');
        const feeTemplatesRef = ref(db, 'settings/feeTemplates');

        setLoading(true);
        try {
            const [semestersSnap, paymentPlansSnap, feeTemplatesSnap] = await Promise.all([
                get(semestersRef),
                get(paymentPlansRef),
                get(feeTemplatesRef)
            ]);

            const semestersData = semestersSnap.exists() ? semestersSnap.val() : {};
            const paymentPlansData = paymentPlansSnap.exists() ? paymentPlansSnap.val() : {};
            const feeTemplatesData = feeTemplatesSnap.exists() ? feeTemplatesSnap.val() : {};
            
            const list: Semester[] = Object.keys(semestersData).map(key => ({ id: key, ...semestersData[key] }));
            setSemesters(list.sort((a, b) => b.name.localeCompare(a.name)));
            if (!selectedSemester && list.length > 0) {
                setSelectedSemester(list[0].id);
            }

            setAllPaymentPlans(Object.keys(paymentPlansData).map(id => ({ id, ...paymentPlansData[id] })));
            setFeeTemplates(Object.keys(feeTemplatesData).map(id => ({ id, ...feeTemplatesData[id] })));
        } catch (error) {
            console.error("Failed to refresh data:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to load latest data." });
        } finally {
            setLoading(false);
        }
    }, [selectedSemester, toast]);

    React.useEffect(() => {
        refreshData();
    }, []);

    React.useEffect(() => {
        const semesterData = semesters.find(s => s.id === selectedSemester);
        if (!semesterData) {
            setSemesterDeadlines([]);
            return;
        }

        const fetchDeadlines = async () => {
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
        };

        fetchDeadlines();
    }, [selectedSemester, semesters, allPaymentPlans]);
    
    const handleToggleSemesterStatus = async (semester: Semester) => {
        let newStatus: Semester['status'];
        if (semester.status === 'Open') newStatus = 'Closed';
        else newStatus = 'Open';

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
    
    const handleSaveDeadline = async (title: string, eventId: string | null) => {
        const semester = semesters.find(s => s.id === selectedSemester);
        if(!semester) return;
        const date = deadlineDates[title];
        if (!date) { toast({ variant: 'destructive', title: 'Date required' }); return; }
        setSaving(true);
        const fullTitle = `${title} - ${semester.name}`;
        try {
            if(eventId) {
                await update(ref(db, `calendarEvents/${eventId}`), { date: format(date, 'yyyy-MM-dd') });
            } else {
                const newEventRef = push(ref(db, 'calendarEvents'));
                await set(newEventRef, { title: fullTitle, date: format(date, 'yyyy-MM-dd'), semester: semester.name });
            }
            toast({ title: "Deadline Updated" });
            setDeadlineDates(prev => ({...prev, [title]: undefined}));
            setEditingDeadlineId(null);
            refreshData();
        } catch (error: any) { 
            toast({ variant: 'destructive', title: 'Failed to save deadline' }); 
        } finally { 
            setSaving(false); 
        }
    }
    
    const currentSemester = semesters.find(s => s.id === selectedSemester);
    const canSave = semesterDeadlines.every(d => d.date !== null);

    return (
        <div className="space-y-6">
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="font-headline text-2xl">Registration Management</CardTitle>
                <CardDescription>Create and manage semesters, and activate which courses are available for student registration.</CardDescription>
            </CardHeader>
        </Card>
        
         <Card className="shadow-lg">
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>Semesters</CardTitle>
                    <CardDescription>Manage all academic semesters here.</CardDescription>
                </div>
                 <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild><Button type="button" onClick={() => setEditingSemester(null)}><PlusCircle className="mr-2 h-4"/>New Semester</Button></DialogTrigger>
                    <DialogContent className="sm:max-w-xl"><CreateOrEditDialogContent editingSemester={null} onClose={() => setIsCreateDialogOpen(false)} onSaveSuccess={() => {refreshData(); setIsCreateDialogOpen(false);}} allPaymentPlans={allPaymentPlans} feeTemplates={feeTemplates} /></DialogContent>
                </Dialog>
            </CardHeader>
             <CardContent>
                <Table>
                    <TableHeader><TableRow><TableHead>Semester Name</TableHead><TableHead>Status</TableHead><TableHead>Late Registration</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-20 w-full"/></TableCell></TableRow> :
                         semesters.map(semester => (
                             <TableRow key={semester.id}>
                                 <TableCell>{semester.name}</TableCell>
                                 <TableCell><span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${semester.status === 'Open' ? 'border-transparent bg-green-500 text-white' : 'border-transparent bg-gray-400 text-white'}`}>{semester.status}</span></TableCell>
                                 <TableCell><span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${semester.lateRegistrationActive ? 'border-transparent bg-green-500 text-white' : 'border-transparent bg-gray-400 text-white'}`}>{semester.lateRegistrationActive ? 'Active' : 'Inactive'}</span></TableCell>
                                 <TableCell className="text-right space-x-2">
                                     <Button size="sm" variant="outline" onClick={() => {setEditingSemester(semester); setIsEditDialogOpen(true);}}>Edit</Button>
                                     <Button size="sm" variant={semester.status === 'Open' ? 'destructive' : 'default'} onClick={() => handleToggleSemesterStatus(semester)} disabled={!canSave && semester.status !== 'Open'} title={!canSave && semester.status !== 'Open' ? 'Set payment deadlines first' : ''}>{semester.status === 'Open' ? 'Close' : 'Open'} Reg</Button>
                                     {semester.status === 'Open' && (<Button size="sm" variant="secondary" onClick={() => handleToggleLateRegistration(semester)}>{semester.lateRegistrationActive ? 'Disable Late' : 'Enable Late'} Reg</Button>)}
                                 </TableCell>
                             </TableRow>
                         ))
                        }
                    </TableBody>
                </Table>
             </CardContent>
        </Card>

        {currentSemester && (<Card><CardHeader><CardTitle>Payment Deadlines for {currentSemester.name}</CardTitle><CardDescription>An overview of payment due dates for this semester. Payment plans without all deadlines set will not be available to students.</CardDescription></CardHeader><CardContent>
                {semesterDeadlines.length > 0 ? (<div className="grid grid-cols-1 md:grid-cols-2 gap-4">{semesterDeadlines.map(({title, date, eventId}) => {
                    const isEditingThis = editingDeadlineId === (eventId || title);
                    const displayDate = deadlineDates[title] || (date ? parseISO(date) : undefined);
                    return (
                        <div key={title} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-md border p-3">
                            <span className="font-medium">{title}</span>
                            <div className="flex items-center gap-2">
                            {isEditingThis ? (
                                <>
                                    <Popover>
                                    <PopoverTrigger asChild><Button variant="outline" className="w-full justify-start text-left font-normal sm:w-[200px]"><CalendarIcon className="mr-2 h-4 w-4" />{displayDate ? format(displayDate, 'PPP') : <span>Pick a date</span>}</Button></PopoverTrigger>
                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={displayDate} onSelect={(d) => setDeadlineDates(p => ({ ...p, [title]: d }))} initialFocus /></PopoverContent>
                                    </Popover>
                                    <Button size="sm" onClick={() => handleSaveDeadline(title, eventId)} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin"/> : "Save"}</Button>
                                    <Button size="sm" variant="ghost" onClick={() => setEditingDeadlineId(null)}>Cancel</Button>
                                </>
                            ) : date ? (
                                <>
                                <span className="text-sm font-semibold">{format(parseISO(date), 'PPP')}</span>
                                <Button variant="ghost" size="icon" onClick={() => setEditingDeadlineId(eventId)}><Pencil className="h-4 w-4"/></Button>
                                </>
                            ) : (
                                <Button onClick={() => setEditingDeadlineId(title)}>Set Date</Button>
                            )}
                            </div>
                        </div>
                    );
                })}</div>
                ) : (<Alert variant="default"><Info className="h-4 w-4"/><AlertTitle>No Payment Plans Linked</AlertTitle><AlertDescription>There are no payment plans linked to this semester, so no deadlines are required.</AlertDescription></Alert>)}
            </CardContent><CardFooter className="flex justify-end"><Button variant="outline" asChild><Link href="/admin/calendar"><CalendarIcon className="mr-2 h-4 w-4" /> Manage in Calendar</Link></Button></CardFooter>
        </Card>
        )}
        
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-xl"><CreateOrEditDialogContent editingSemester={editingSemester} onClose={() => setIsEditDialogOpen(false)} onSaveSuccess={() => {refreshData(); setIsEditDialogOpen(false);}} allPaymentPlans={allPaymentPlans} feeTemplates={feeTemplates} /></DialogContent>
        </Dialog>
        </div>
    );
}
