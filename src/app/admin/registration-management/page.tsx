
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, HandCoins, Info, Download, Power, PowerOff, ShieldAlert, Pencil, PlusCircle, Calendar as CalendarIcon, Wallet, Route, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth, createNotification, getAllStudentAndStaffIds } from '@/lib/firebase';
import { ref, get, set, onValue, update, push, remove } from 'firebase/database';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogClose, DialogFooter } from '@/components/ui/dialog';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// --- TYPE DEFINITIONS ---
type Course = { id: string; name: string; code: string; cost: number; };
type Programme = { id: string; name: string; tuitionFee?: number; };
type Fee = { id: string; name: string; amount: number; };
type FeeTemplate = { id: string; name: string; amount: number; type: 'Mandatory' | 'Optional'; };
type PaymentPlan = { id: string; name: string; installments: number; installmentPercentages: number[]; archived?: boolean; };
type Semester = { id: string; name: string; status: 'Open' | 'Closed' | 'Archived'; lateRegistrationFee?: number; lateRegistrationActive?: boolean; startDate?: string; endDate?: string; paymentPlanIds?: Record<string, boolean>; mandatoryFees?: Record<string, Fee>; optionalFees?: Record<string, Fee>; };
type DeadlineInfo = { title: string; date: string | null; eventId: string | null; };

const getOrdinalSuffix = (i: number) => {
    if (i === 1) return '1st';
    if (i === 2) return '2nd';
    if (i === 3) return '3rd';
    return `${i}th`;
};

// --- DIALOG CONTENT COMPONENTS ---

function CreateOrEditDialogContent({ editingSemester, onClose, onSaveSuccess }: { editingSemester: Semester | null; onClose: () => void; onSaveSuccess: () => void; }) {
    const [saving, setSaving] = React.useState(false);
    const [semesterNameInput, setSemesterNameInput] = React.useState('');
    const [semesterDates, setSemesterDates] = React.useState<DateRange | undefined>();
    const [lateRegistrationFee, setLateRegistrationFee] = React.useState<number>(0);
    const { toast } = useToast();
    
    React.useEffect(() => {
        if (editingSemester) {
            setSemesterNameInput(editingSemester.name || '');
            setSemesterDates({
                from: editingSemester.startDate ? parseISO(editingSemester.startDate) : undefined,
                to: editingSemester.endDate ? parseISO(editingSemester.endDate) : undefined
            });
            setLateRegistrationFee(editingSemester.lateRegistrationFee || 0);
        } else {
             setSemesterNameInput('');
             setSemesterDates(undefined);
             setLateRegistrationFee(0);
        }
    }, [editingSemester]);

    const handleSaveSemester = async () => {
        if (!semesterNameInput.trim() || !semesterDates?.from) { toast({ variant: 'destructive', title: 'Missing Semester Details'}); return; }
        setSaving(true);
        try {
            const semesterData: Partial<Semester> = {
                name: semesterNameInput.trim(),
                status: editingSemester?.status || 'Closed',
                lateRegistrationFee: lateRegistrationFee,
                startDate: format(semesterDates.from, 'yyyy-MM-dd'),
                endDate: semesterDates.to ? format(semesterDates.to, 'yyyy-MM-dd') : format(semesterDates.from, 'yyyy-MM-dd'),
            };

            if (editingSemester) {
                await update(ref(db, `semesters/${editingSemester.id}`), semesterData);
                toast({ variant: 'success', title: 'Semester Updated' });
            } else {
                await set(push(ref(db, 'semesters')), {...semesterData, lateRegistrationActive: false, paymentPlanIds: {}, mandatoryFees: {}, optionalFees: {}});
                toast({ variant: 'success', title: 'Semester Created' });
            }
            onSaveSuccess();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Operation Failed', description: error.message });
        } finally {
            setSaving(false);
        }
    };
    
    return (
        <><DialogHeader><DialogTitle>{editingSemester ? 'Edit' : 'Create'} Semester</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
            <div className="space-y-1"><Label htmlFor="semester-name">Semester Name</Label><Input id="semester-name" value={semesterNameInput} onChange={(e) => setSemesterNameInput(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="semester-dates">Semester Start & End Dates</Label>
                <Popover><PopoverTrigger asChild><Button id="semester-dates" variant="outline" className={cn("w-full justify-start text-left font-normal", !semesterDates?.from && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{semesterDates?.from ? (semesterDates.to ? `${format(semesterDates.from, "PPP")} - ${format(semesterDates.to, "PPP")}` : format(semesterDates.from, "PPP")) : <span>Pick a date range</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" selected={semesterDates} onSelect={setSemesterDates} numberOfMonths={2} /></PopoverContent></Popover>
            </div>
             <div className="space-y-1"><Label htmlFor="late-fee">Late Registration Fee (ZMW)</Label><Input id="late-fee" type="number" value={lateRegistrationFee} onChange={(e) => setLateRegistrationFee(Number(e.target.value))} /></div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSaveSemester} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{editingSemester ? 'Save Changes' : 'Create Semester'}</Button></DialogFooter>
        </>
    );
}

function FeesDialogContent({ semester, onSaveSuccess }: { semester: Semester, onSaveSuccess: () => void }) {
    const [mandatoryFees, setMandatoryFees] = React.useState<Record<string, Fee>>(semester.mandatoryFees || {});
    const [optionalFees, setOptionalFees] = React.useState<Record<string, Fee>>(semester.optionalFees || {});
    const [feeTemplates, setFeeTemplates] = React.useState<FeeTemplate[]>([]);
    const [saving, setSaving] = React.useState(false);
    const { toast } = useToast();

    React.useEffect(() => {
        const templatesRef = ref(db, 'settings/feeTemplates');
        onValue(templatesRef, snap => {
            if(snap.exists()) setFeeTemplates(Object.entries(snap.val()).map(([id, data]) => ({id, ...(data as any)})));
        });
    }, []);

    const handleImportFee = (template: FeeTemplate, isMandatory: boolean) => {
        const newFee = { name: template.name, amount: template.amount };
        const feeId = push(ref(db, 'semesters')).key!;
        if (isMandatory) setMandatoryFees(prev => ({ ...prev, [feeId]: newFee }));
        else setOptionalFees(prev => ({ ...prev, [feeId]: newFee }));
    };
    
    const handleDeleteFee = (feeId: string, isMandatory: boolean) => {
        if (isMandatory) setMandatoryFees(prev => { const n = {...prev}; delete n[feeId]; return n; });
        else setOptionalFees(prev => { const n = {...prev}; delete n[feeId]; return n; });
    };

    const handleSaveFees = async () => {
        setSaving(true);
        try {
            await update(ref(db, `semesters/${semester.id}`), { mandatoryFees, optionalFees });
            toast({ title: 'Success', description: 'Semester fees have been updated.' });
            onSaveSuccess();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <><DialogHeader><DialogTitle>Set Fees for {semester.name}</DialogTitle></DialogHeader>
            <div className="max-h-[70vh] overflow-y-auto pr-4 py-4 space-y-4">
                <div className="space-y-2">
                    <div className="flex justify-between items-center"><h4 className="font-semibold">Mandatory Fees</h4><Popover><PopoverTrigger asChild><Button size="sm" variant="outline"><PlusCircle className="mr-2 h-4"/>Import</Button></PopoverTrigger><PopoverContent className="w-56 p-1">{feeTemplates.filter(t => t.type === 'Mandatory').map(t => <Button key={t.id} variant="ghost" className="w-full justify-start" onClick={()=>handleImportFee(t, true)}>{t.name}</Button>)}</PopoverContent></Popover></div>
                    <Table><TableBody>{Object.entries(mandatoryFees).map(([id, fee]) => <TableRow key={id}><TableCell>{fee.name}</TableCell><TableCell className="text-right">ZMW {fee.amount.toFixed(2)}</TableCell><TableCell className="w-[50px] text-right"><Button variant="ghost" size="icon" onClick={()=>handleDeleteFee(id, true)}><Trash2 className="h-4 w-4"/></Button></TableCell></TableRow>)}</TableBody></Table>
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between items-center"><h4 className="font-semibold">Optional Fees</h4><Popover><PopoverTrigger asChild><Button size="sm" variant="outline"><PlusCircle className="mr-2 h-4"/>Import</Button></PopoverTrigger><PopoverContent className="w-56 p-1">{feeTemplates.filter(t => t.type === 'Optional').map(t => <Button key={t.id} variant="ghost" className="w-full justify-start" onClick={()=>handleImportFee(t, false)}>{t.name}</Button>)}</PopoverContent></Popover></div>
                    <Table><TableBody>{Object.entries(optionalFees).map(([id, fee]) => <TableRow key={id}><TableCell>{fee.name}</TableCell><TableCell className="text-right">ZMW {fee.amount.toFixed(2)}</TableCell><TableCell className="w-[50px] text-right"><Button variant="ghost" size="icon" onClick={()=>handleDeleteFee(id, false)}><Trash2 className="h-4 w-4"/></Button></TableCell></TableRow>)}</TableBody></Table>
                </div>
            </div>
            <DialogFooter><DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose><Button onClick={handleSaveFees} disabled={saving}>{saving && <Loader2 className="mr-2"/>}Save Fees</Button></DialogFooter>
        </>
    );
}

function PlansDialogContent({ semester, allPaymentPlans, onSaveSuccess }: { semester: Semester, allPaymentPlans: PaymentPlan[], onSaveSuccess: () => void }) {
    const [selectedPlans, setSelectedPlans] = React.useState<Record<string, boolean>>(semester.paymentPlanIds || {});
    const [saving, setSaving] = React.useState(false);
    const { toast } = useToast();

    const handleSavePlans = async () => {
        setSaving(true);
        try {
            await update(ref(db, `semesters/${semester.id}`), { paymentPlanIds: selectedPlans });
            toast({ title: 'Success', description: 'Payment plans for this semester have been updated.' });
            onSaveSuccess();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <><DialogHeader><DialogTitle>Manage Payment Plans for {semester.name}</DialogTitle></DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto pr-4 py-4 space-y-2">
                {allPaymentPlans.filter(p => !p.archived).map(plan => (<div key={plan.id} className="flex items-center gap-2 p-3 border rounded-md"><Checkbox id={plan.id} checked={!!selectedPlans[plan.id]} onCheckedChange={() => setSelectedPlans(prev => ({ ...prev, [plan.id]: !prev[plan.id] }))} /><Label htmlFor={plan.id}>{plan.name} ({plan.installments} Installments)</Label></div>))}
            </div>
            <DialogFooter><DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose><Button onClick={handleSavePlans} disabled={saving}>{saving && <Loader2 className="mr-2"/>}Save Plans</Button></DialogFooter>
        </>
    );
}

function DeadlinesDialogContent({ semester, allPaymentPlans, onSaveSuccess }: { semester: Semester, allPaymentPlans: PaymentPlan[], onSaveSuccess: () => void }) {
    const [deadlines, setDeadlines] = React.useState<DeadlineInfo[]>([]);
    const [deadlineDates, setDeadlineDates] = React.useState<Record<string, Date | undefined>>({});
    const [editingDeadlineId, setEditingDeadlineId] = React.useState<string | null>(null);
    const [saving, setSaving] = React.useState(false);
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [importSemesterId, setImportSemesterId] = React.useState('');
    const { toast } = useToast();

    const fetchDeadlines = React.useCallback(async () => {
        const [eventsSnapshot, semestersSnapshot] = await Promise.all([ get(ref(db, 'calendarEvents')), get(ref(db, 'semesters')) ]);
        if (semestersSnapshot.exists()) setSemesters(Object.values(semestersSnapshot.val()));

        const eventMap = new Map<string, {date: string, id: string}>();
        if (eventsSnapshot.exists()) Object.entries(eventsSnapshot.val()).forEach(([id, event]:[string, any]) => eventMap.set(event.title.trim(), { date: event.date, id }));
        
        const linkedPlanIds = Object.keys(semester.paymentPlanIds || {});
        const linkedPlans = allPaymentPlans.filter(p => linkedPlanIds.includes(p.id));

        const requiredDeadlines: string[] = [];
        linkedPlans.forEach(plan => {
             for (let i = 0; i < plan.installments; i++) {
                requiredDeadlines.push(`${plan.name} (${getOrdinalSuffix(i + 1)} Installment) Deadline - ${semester.name}`);
            }
        })
        setDeadlines(requiredDeadlines.map(title => {
            const existing = eventMap.get(title.trim());
            return { title: title.replace(` - ${semester.name}`, ''), date: existing?.date || null, eventId: existing?.id || null };
        }));
    }, [semester, allPaymentPlans]);

    React.useEffect(() => { fetchDeadlines(); }, [fetchDeadlines]);

    const handleSaveDeadline = async (title: string, eventId: string | null) => {
        const date = deadlineDates[title];
        if (!date) { toast({ variant: 'destructive', title: 'Date required' }); return; }
        setSaving(true);
        try {
            const fullTitle = `${title} - ${semester.name}`;
            if(eventId) await update(ref(db, `calendarEvents/${eventId}`), { date: format(date, 'yyyy-MM-dd') });
            else await set(push(ref(db, 'calendarEvents')), { title: fullTitle, date: format(date, 'yyyy-MM-dd'), semester: semester.name });
            toast({ title: "Deadline Updated" });
            setDeadlineDates(p => ({...p, [title]: undefined}));
            setEditingDeadlineId(null);
            fetchDeadlines(); // Re-fetch
        } catch (e:any) { toast({ variant: 'destructive', title: 'Failed to save deadline', description: e.message }); } 
        finally { setSaving(false); }
    };
    
    const handleImportDeadlines = async () => {
        if (!importSemesterId) return;
        setSaving(true);
        try {
            const sourceSemester = semesters.find(s => s.id === importSemesterId);
            if (!sourceSemester) throw new Error("Source semester not found.");

            const eventsSnapshot = await get(ref(db, 'calendarEvents'));
            const eventMap = new Map<string, string>(); // title -> date
            if (eventsSnapshot.exists()) Object.values(eventsSnapshot.val()).forEach((e: any) => { if (e.semester === sourceSemester.name) eventMap.set(e.title.replace(` - ${sourceSemester.name}`, ''), e.date); });

            const updates: Record<string, any> = {};
            deadlines.forEach(deadline => {
                 const sourceDate = eventMap.get(deadline.title);
                 if (sourceDate) {
                     const fullTitle = `${deadline.title} - ${semester.name}`;
                     updates[fullTitle] = { title: fullTitle, date: sourceDate, semester: semester.name };
                 }
            });
            
            const allEventsRef = ref(db, 'calendarEvents');
            const allEventsSnap = await get(allEventsRef);
            const allEventsData = allEventsSnap.exists() ? allEventsSnap.val() : {};
            
            for(const fullTitle in updates){
                const existingEvent = Object.entries(allEventsData).find(([id, ev]: [string, any]) => ev.title === fullTitle);
                if(existingEvent) await update(ref(db, `calendarEvents/${existingEvent[0]}`), { date: updates[fullTitle].date });
                else await push(allEventsRef, updates[fullTitle]);
            }

            toast({ title: 'Deadlines Imported!', description: 'Deadlines have been copied from the selected semester.'});
            fetchDeadlines();
            setImportSemesterId('');

        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Import Failed', description: e.message });
        } finally {
            setSaving(false);
        }
    }


    return (
        <><DialogHeader><DialogTitle>Set Payment Deadlines for {semester.name}</DialogTitle></DialogHeader>
            <div className="max-h-[70vh] overflow-y-auto pr-4 py-4 space-y-4">
                <div className="p-3 border rounded-lg bg-muted/50 space-y-2">
                    <Label>Import from another semester</Label>
                    <div className="flex gap-2"><Select value={importSemesterId} onValueChange={setImportSemesterId}><SelectTrigger><SelectValue placeholder="Select semester..."/></SelectTrigger><SelectContent>{semesters.filter(s => s.id !== semester.id).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select><Button onClick={handleImportDeadlines} disabled={!importSemesterId || saving}>Import</Button></div>
                </div>
                {deadlines.length > 0 ? (deadlines.map(({ title, date, eventId }) => {
                    const isEditingThis = editingDeadlineId === (eventId || title);
                    const displayDate = deadlineDates[title] || (date ? parseISO(date) : undefined);
                    return (<div key={title} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-md border p-3"><span className="font-medium">{title}</span><div className="flex items-center gap-2">
                        {isEditingThis ? (<>
                            <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start text-left font-normal sm:w-[200px]"><CalendarIcon className="mr-2 h-4 w-4" />{displayDate ? format(displayDate, 'PPP') : <span>Pick a date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={displayDate} onSelect={(d) => setDeadlineDates(p => ({ ...p, [title]: d }))} initialFocus /></PopoverContent></Popover>
                            <Button size="sm" onClick={() => handleSaveDeadline(title, eventId)} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin"/> : "Save"}</Button><Button size="sm" variant="ghost" onClick={() => setEditingDeadlineId(null)}>Cancel</Button>
                        </>) : date ? (<><span className="text-sm font-semibold">{format(parseISO(date), 'PPP')}</span><Button variant="ghost" size="icon" onClick={() => setEditingDeadlineId(eventId)}><Pencil className="h-4 w-4"/></Button></>) : (<Button onClick={() => setEditingDeadlineId(title)}>Set Date</Button>)}
                    </div></div>)
                })) : <p className="text-sm text-muted-foreground">No applicable payment plans found.</p>}
            </div><DialogFooter><DialogClose asChild><Button variant="ghost">Close</Button></DialogClose></DialogFooter>
        </>
    );
}

// --- MAIN PAGE COMPONENT ---
export default function RegistrationManagementPage() {
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    // Data from DB
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [allPaymentPlans, setAllPaymentPlans] = React.useState<PaymentPlan[]>([]);
    const [feeTemplates, setFeeTemplates] = React.useState<FeeTemplate[]>([]);
    
    // Dialog states
    const [dialogContent, setDialogContent] = React.useState<'plans' | 'fees' | 'deadlines' | null>(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
    const [selectedSemester, setSelectedSemester] = React.useState<Semester | null>(null);
    const [editingSemester, setEditingSemester] = React.useState<Semester | null>(null);


    const { toast } = useToast();
    
    const fetchData = React.useCallback(async () => {
        setLoading(true);
        const [semestersSnap, paymentPlansSnap, feeTemplatesSnap] = await Promise.all([
            get(ref(db, 'semesters')),
            get(ref(db, 'settings/paymentPlans')),
            get(ref(db, 'settings/feeTemplates')),
        ]);
        
        setSemesters(semestersSnap.exists() ? Object.keys(semestersSnap.val()).map(id => ({ id, ...semestersSnap.val()[id] })).sort((a,b) => b.name.localeCompare(a.name)) : []);
        setAllPaymentPlans(paymentPlansSnap.exists() ? Object.keys(paymentPlansSnap.val()).map(id => ({ id, ...paymentPlansSnap.val()[id] })) : []);
        setFeeTemplates(feeTemplatesSnap.exists() ? Object.keys(feeTemplatesSnap.val()).map(id => ({ id, ...feeTemplatesSnap.val()[id] })) : []);

        setLoading(false);
    }, []);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleToggleSemesterStatus = async (semester: Semester) => {
        let newStatus: Semester['status'];
        if (semester.status === 'Open') {
            newStatus = 'Closed';
        } else { // Covers 'Closed' and 'Archived'
            newStatus = 'Open';
        }

        try {
            await update(ref(db, `semesters/${semester.id}`), { status: newStatus });
            if (newStatus === 'Open') {
                const studentIds = await getAllStudentAndStaffIds();
                const notificationPromises = studentIds.map(id => createNotification(id, `Registration for ${semester.name} is now open!`, '/student/registration'));
                await Promise.all(notificationPromises);
            }
            toast({ variant: 'success', title: `Semester status updated to ${newStatus}` });
            fetchData();
        } catch (e: any) { toast({ variant: 'destructive', title: 'Update Failed', description: e.message }); }
    };
    
    const handleToggleLateRegistration = async (semester: Semester) => {
        const newStatus = !(semester.lateRegistrationActive ?? false);
        try { await update(ref(db, `semesters/${semester.id}`), { lateRegistrationActive: newStatus });
             toast({ variant: 'success', title: `Late Registration ${newStatus ? 'Enabled' : 'Disabled'}` });
             fetchData();
        } catch (e: any) { toast({ variant: 'destructive', title: 'Update Failed', description: e.message }); }
    };

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="font-headline text-2xl">Registration Management</CardTitle>
                        <CardDescription>Create semesters, manage fees, and control which courses are available for registration.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" asChild><Link href="/admin/payment-plans">Manage Plan Templates</Link></Button>
                        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                            <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/> New Semester</Button></DialogTrigger>
                            <DialogContent className="sm:max-w-xl"><CreateOrEditDialogContent editingSemester={null} onClose={() => setIsCreateDialogOpen(false)} onSaveSuccess={() => { fetchData(); setIsCreateDialogOpen(false); }} /></DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (<div className="space-y-4 pt-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}</div>
                    ) : semesters.length > 0 ? (
                        <Accordion type="multiple" defaultValue={semesters.map(s => s.id)} className="w-full space-y-4">
                            {semesters.map(semester => (
                                <AccordionItem value={semester.id} key={semester.id} className="border rounded-lg overflow-hidden">
                                    <AccordionTrigger className="p-4 hover:no-underline bg-muted/50 data-[state=open]:border-b">
                                        <div className="flex justify-between items-center w-full">
                                            <div>
                                                <h3 className="font-semibold text-lg">{semester.name}</h3>
                                                <CardDescription>
                                                    <span className="mr-4">Status: <Badge variant={semester.status === 'Open' ? 'default' : 'secondary'}>{semester.status}</Badge></span>
                                                    <span>Late Reg: <Badge variant={semester.lateRegistrationActive ? 'default' : 'secondary'}>{semester.lateRegistrationActive ? 'Active' : 'Inactive'}</Badge></span>
                                                </CardDescription>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="p-4 space-y-4">
                                         <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            <Card><CardHeader><CardTitle className="text-base">Late Fee</CardTitle></CardHeader><CardContent><p>ZMW {(semester.lateRegistrationFee || 0).toFixed(2)}</p></CardContent></Card>
                                            <Card><CardHeader><CardTitle className="text-base">Mandatory Fees</CardTitle></CardHeader><CardContent><p>{Object.keys(semester.mandatoryFees || {}).length} fee(s)</p></CardContent></Card>
                                            <Card><CardHeader><CardTitle className="text-base">Optional Fees</CardTitle></CardHeader><CardContent><p>{Object.keys(semester.optionalFees || {}).length} fee(s)</p></CardContent></Card>
                                        </div>
                                         <Separator />
                                         <h4 className="font-semibold">Configuration</h4>
                                         <div className="flex flex-wrap gap-2">
                                             <Button size="sm" variant="outline" onClick={() => {setSelectedSemester(semester); setDialogContent('plans')}}><Wallet className="mr-2 h-4"/>Manage Payment Plans</Button>
                                             <Button size="sm" variant="outline" onClick={() => {setSelectedSemester(semester); setDialogContent('fees')}}><HandCoins className="mr-2 h-4"/>Set Semester Fees</Button>
                                             <Button size="sm" variant="outline" onClick={() => {setSelectedSemester(semester); setDialogContent('deadlines')}}><CalendarIcon className="mr-2 h-4"/>Set Deadlines</Button>
                                             <Button size="sm" variant="secondary" onClick={() => handleToggleLateRegistration(semester)}><ShieldAlert className="mr-2 h-4"/>{semester.lateRegistrationActive ? 'Disable' : 'Enable'} Late Fee</Button>
                                         </div>
                                         <Separator/>
                                         <div className="flex justify-end gap-2">
                                            <Button size="sm" variant="outline" onClick={() => { setEditingSemester(semester); setIsEditDialogOpen(true); }}><Pencil className="mr-2 h-4"/>Edit Details</Button>
                                            <Button size="sm" onClick={() => handleToggleSemesterStatus(semester)}>{semester.status === 'Open' ? <PowerOff className="mr-2 h-4 w-4" /> : <Power className="mr-2 h-4 w-4" />}{semester.status === 'Open' ? 'Close Registration' : 'Open Registration'}</Button>
                                         </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    ) : (
                        <div className="py-16 text-center text-muted-foreground"><BookOpen className="mx-auto h-12 w-12" /><h3 className="mt-4 text-lg font-semibold">No Semesters Found</h3><p className="mt-2 text-sm">Create the first semester to get started.</p></div>
                    )}
                </CardContent>
            </Card>
            
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-xl"><CreateOrEditDialogContent editingSemester={editingSemester} onClose={() => setIsEditDialogOpen(false)} onSaveSuccess={() => { fetchData(); setIsEditDialogOpen(false); }} /></DialogContent>
            </Dialog>

            <Dialog open={!!dialogContent} onOpenChange={() => setDialogContent(null)}>
                <DialogContent className="sm:max-w-2xl">
                    {selectedSemester && dialogContent === 'fees' && <FeesDialogContent semester={selectedSemester} onSaveSuccess={() => { fetchData(); setDialogContent(null); }} />}
                    {selectedSemester && dialogContent === 'plans' && <PlansDialogContent semester={selectedSemester} allPaymentPlans={allPaymentPlans} onSaveSuccess={() => { fetchData(); setDialogContent(null); }} />}
                    {selectedSemester && dialogContent === 'deadlines' && <DeadlinesDialogContent semester={selectedSemester} allPaymentPlans={allPaymentPlans} onSaveSuccess={() => { fetchData(); setDialogContent(null); }} />}
                </DialogContent>
            </Dialog>

        </div>
    );
}

    