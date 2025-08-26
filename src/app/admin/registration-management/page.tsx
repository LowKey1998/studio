
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, Route, History, Info, Download, Power, PowerOff, ShieldAlert, Pencil, PlusCircle, Calendar as CalendarIcon, FileText, CheckCircle2, AlertCircle, Wallet, HandCoins } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth, createNotification, getAllStudentAndStaffIds } from '@/lib/firebase';
import { ref, get, set, onValue, update, push, remove } from 'firebase/database';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogClose, DialogFooter } from '@/components/ui/dialog';
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
import { Badge } from '@/components/ui/badge';

// --- TYPE DEFINITIONS ---
type Fee = { id: string; name: string; amount: number; };
type FeeTemplate = { id: string; name: string; amount: number; type: 'Mandatory' | 'Optional'; };
type PaymentPlan = { id: string; name: string; installments: number; installmentPercentages: number[]; archived?: boolean; };
type Semester = { id: string; name: string; status: 'Open' | 'Closed' | 'Archived'; lateRegistrationActive?: boolean; lateRegistrationFee?: number; startDate?: string; endDate?: string; paymentPlanIds?: Record<string, boolean>; mandatoryFees?: Record<string, Omit<Fee, 'id'>>; optionalFees?: Record<string, Omit<Fee, 'id'>>; };
type CalendarEvent = { id: string; title: string; date: string; };
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
};

function CreateOrEditDialogContent({ editingSemester, onClose, onSaveSuccess }: CreateOrEditDialogContentProps) {
    const [saving, setSaving] = React.useState(false);
    const [semesterNameInput, setSemesterNameInput] = React.useState('');
    const [semesterDates, setSemesterDates] = React.useState<DateRange | undefined>();
    const { toast } = useToast();
    
    React.useEffect(() => {
        if (editingSemester) {
            setSemesterNameInput(editingSemester.name || '');
            setSemesterDates({
                from: editingSemester.startDate ? parseISO(editingSemester.startDate) : undefined,
                to: editingSemester.endDate ? parseISO(editingSemester.endDate) : undefined
            });
        } else {
             setSemesterNameInput('');
             setSemesterDates(undefined);
        }
    }, [editingSemester]);


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
    
    return (
        <><DialogHeader><DialogTitle>{editingSemester ? 'Edit' : 'Create'} Semester</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="space-y-1"><Label htmlFor="semester-name">Semester Name</Label><Input id="semester-name" value={semesterNameInput} onChange={(e) => setSemesterNameInput(e.target.value)} placeholder="e.g., 2024JAN Year 1 Semester 1"/></div>
                <div className="space-y-1"><Label htmlFor="semester-dates">Semester Start & End Dates</Label>
                    <Popover><PopoverTrigger asChild><Button id="semester-dates" variant="outline" className={cn("w-full justify-start text-left font-normal", !semesterDates?.from && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{semesterDates?.from ? (semesterDates.to ? `${format(semesterDates.from, "PPP")} - ${format(semesterDates.to, "PPP")}` : format(semesterDates.from, "PPP")) : <span>Pick a date range</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" selected={semesterDates} onSelect={setSemesterDates} numberOfMonths={2} /></PopoverContent></Popover>
                </div>
            </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSaveSemester} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{editingSemester ? 'Save Changes' : 'Create Semester'}</Button></DialogFooter>
        </>
    );
}

// --- MAIN PAGE COMPONENT ---
export default function RegistrationManagementPage() {
    const [loading, setLoading] = React.useState(true);
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [allPaymentPlans, setAllPaymentPlans] = React.useState<PaymentPlan[]>([]);
    const [feeTemplates, setFeeTemplates] = React.useState<FeeTemplate[]>([]);

    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
    const [editingSemester, setEditingSemester] = React.useState<Semester | null>(null);

    const [isFeesDialogOpen, setIsFeesDialogOpen] = React.useState(false);
    const [isPlansDialogOpen, setIsPlansDialogOpen] = React.useState(false);
    const [isDeadlinesDialogOpen, setIsDeadlinesDialogOpen] = React.useState(false);

    const { toast } = useToast();

    React.useEffect(() => {
        const refs = [ ref(db, 'semesters'), ref(db, 'settings/paymentPlans'), ref(db, 'settings/feeTemplates'), ref(db, 'courses') ];
        const unsubs = refs.map((r, i) => onValue(r, (snapshot) => {
            const data = snapshot.val() || {};
            switch(i) {
                case 0: setSemesters(Object.keys(data).map(id => ({ id, ...data[id] })).sort((a,b) => b.name.localeCompare(a.name))); break;
                case 1: setAllPaymentPlans(Object.keys(data).map(id => ({ id, ...data[id] }))); break;
                case 2: setFeeTemplates(Object.keys(data).map(id => ({ id, ...data[id] }))); break;
            }
        }));
        setLoading(false);
        return () => unsubs.forEach(unsub => unsub());
    }, []);
    
    const openEditDialog = (semester: Semester) => {
        setEditingSemester(semester);
        setIsEditDialogOpen(true);
    };

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
        } catch (e: any) { toast({ variant: 'destructive', title: 'Update Failed', description: e.message }); }
    };
    
    const handleToggleLateRegistration = async (semester: Semester) => {
        const newStatus = !(semester.lateRegistrationActive ?? false);
        try { await update(ref(db, `semesters/${semester.id}`), { lateRegistrationActive: newStatus });
             toast({ variant: 'success', title: `Late Registration ${newStatus ? 'Enabled' : 'Disabled'}` });
        } catch (e: any) { toast({ variant: 'destructive', title: 'Update Failed', description: e.message }); }
    };
    
    const calculateSemesterCost = (semester: Semester) => {
        let totalCost = 0;
        const mandatoryFees = Object.values(semester.mandatoryFees || {});
        totalCost += mandatoryFees.reduce((sum, fee) => sum + fee.amount, 0);
        return totalCost;
    };

    return (
        <div className="space-y-6">
        <Card className="shadow-lg">
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle className="font-headline text-2xl">Semester Management</CardTitle>
                    <CardDescription>Create academic semesters, link payment plans, and set applicable fees.</CardDescription>
                </div>
                 <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/> New Semester</Button></DialogTrigger>
                    <DialogContent className="sm:max-w-xl"><CreateOrEditDialogContent editingSemester={null} onClose={() => setIsCreateDialogOpen(false)} onSaveSuccess={() => {setIsCreateDialogOpen(false);}} allPaymentPlans={allPaymentPlans} feeTemplates={feeTemplates} /></DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                 {loading ? (<div className="space-y-4 pt-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
                ) : semesters.length > 0 ? (
                    <div className="space-y-4">
                        {semesters.map(semester => (
                            <Card key={semester.id}>
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle>{semester.name}</CardTitle>
                                            <CardDescription>
                                                <span className="mr-4">Status: <Badge variant={semester.status === 'Open' ? 'default' : 'secondary'}>{semester.status}</Badge></span>
                                                <span>Late Reg: <Badge variant={semester.lateRegistrationActive ? 'default' : 'secondary'}>{semester.lateRegistrationActive ? 'Active' : 'Inactive'}</Badge></span>
                                            </CardDescription>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" onClick={() => handleToggleSemesterStatus(semester)}>{semester.status === 'Open' ? <PowerOff className="mr-2 h-4"/> : <Power className="mr-2 h-4"/>}{semester.status === 'Open' ? 'Close' : 'Open'}</Button>
                                            <Button variant="outline" size="sm" onClick={() => { setEditingSemester(semester); setIsEditDialogOpen(true); }}><Pencil className="mr-2 h-4"/>Edit</Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardFooter className="flex-col items-start gap-4 bg-muted/50 p-4">
                                     <div className="w-full">
                                        <h4 className="text-sm font-semibold mb-2">Configuration</h4>
                                        <div className="flex flex-wrap gap-2">
                                            <Button size="sm" onClick={() => {setEditingSemester(semester); setIsPlansDialogOpen(true)}}><Wallet className="mr-2 h-4"/>Manage Payment Plans</Button>
                                            <Button size="sm" onClick={() => {setEditingSemester(semester); setIsFeesDialogOpen(true)}}><HandCoins className="mr-2 h-4"/>Set Semester Fees</Button>
                                            <Button size="sm" onClick={() => {setEditingSemester(semester); setIsDeadlinesDialogOpen(true)}}><CalendarIcon className="mr-2 h-4"/>Set Deadlines</Button>
                                            <Button size="sm" variant="secondary" onClick={() => handleToggleLateRegistration(semester)}><ShieldAlert className="mr-2 h-4"/>{semester.lateRegistrationActive ? 'Disable' : 'Enable'} Late Fee</Button>
                                        </div>
                                     </div>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                ) : (<p className="text-center py-8 text-muted-foreground">No semesters created yet.</p>)}
            </CardContent>
        </Card>
        
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
             {editingSemester && <DialogContent className="sm:max-w-xl"><CreateOrEditDialogContent editingSemester={editingSemester} onClose={() => setIsEditDialogOpen(false)} onSaveSuccess={() => {setIsEditDialogOpen(false);}} allPaymentPlans={allPaymentPlans} feeTemplates={feeTemplates} /></DialogContent>}
        </Dialog>

        <Dialog open={isPlansDialogOpen} onOpenChange={setIsPlansDialogOpen}>
            {editingSemester && <PaymentPlansDialogContent semester={editingSemester} allPaymentPlans={allPaymentPlans} onClose={() => setIsPlansDialogOpen(false)} />}
        </Dialog>
        
         <Dialog open={isFeesDialogOpen} onOpenChange={setIsFeesDialogOpen}>
            {editingSemester && <FeesDialogContent semester={editingSemester} feeTemplates={feeTemplates} onClose={() => setIsFeesDialogOpen(false)} />}
        </Dialog>

        <Dialog open={isDeadlinesDialogOpen} onOpenChange={setIsDeadlinesDialogOpen}>
             {editingSemester && <DeadlinesDialogContent semester={editingSemester} allPaymentPlans={allPaymentPlans} semesters={semesters} onClose={() => setIsDeadlinesDialogOpen(false)} />}
        </Dialog>
        </div>
    );
}

// --- SUB-COMPONENTS FOR DIALOGS ---

function PaymentPlansDialogContent({ semester, allPaymentPlans, onClose }: { semester: Semester, allPaymentPlans: PaymentPlan[], onClose: () => void }) {
    const [selectedPlanIds, setSelectedPlanIds] = React.useState<Record<string, boolean>>(semester.paymentPlanIds || {});
    const [saving, setSaving] = React.useState(false);
    const { toast } = useToast();

    const handlePlanSelection = (planId: string) => {
        setSelectedPlanIds(prev => ({...prev, [planId]: !prev[planId]}));
    };
    
    const handleSave = async () => {
        setSaving(true);
        try {
            await update(ref(db, `semesters/${semester.id}`), { paymentPlanIds: selectedPlanIds });
            toast({ title: 'Success', description: 'Payment plans for semester updated.' });
            onClose();
        } catch(e) {
             toast({ variant: 'destructive', title: 'Save Failed' });
        } finally {
            setSaving(false);
        }
    };
    
    return (
        <DialogContent>
            <DialogHeader><DialogTitle>Manage Payment Plans for {semester.name}</DialogTitle></DialogHeader>
             <div className="py-4 space-y-2 max-h-80 overflow-y-auto">
                {allPaymentPlans.filter(p => !p.archived).map(plan => (
                    <div key={plan.id} className="flex items-center gap-2 rounded-md border p-3">
                        <Checkbox id={`plan-${plan.id}`} checked={!!selectedPlanIds[plan.id]} onCheckedChange={() => handlePlanSelection(plan.id)} />
                        <Label htmlFor={`plan-${plan.id}`}>{plan.name} ({plan.installments} Installment{plan.installments > 1 ? 's' : ''})</Label>
                    </div>
                ))}
            </div>
            <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="mr-2"/>}Save</Button></DialogFooter>
        </DialogContent>
    );
}

function FeesDialogContent({ semester, feeTemplates, onClose }: { semester: Semester; feeTemplates: FeeTemplate[]; onClose: () => void }) {
    const [saving, setSaving] = React.useState(false);
    const [mandatoryFees, setMandatoryFees] = React.useState<Record<string, Omit<Fee, 'id'>>>(semester.mandatoryFees || {});
    const [optionalFees, setOptionalFees] = React.useState<Record<string, Omit<Fee, 'id'>>>(semester.optionalFees || {});
    const { toast } = useToast();

    const handleImportFee = (template: FeeTemplate) => {
        const feeId = push(ref(db, 'semesters')).key!;
        const newFee = { name: template.name, amount: template.amount };
        if (template.type === 'Mandatory') setMandatoryFees(p => ({...p, [feeId]: newFee}));
        else setOptionalFees(p => ({...p, [feeId]: newFee}));
    };

    const handleDeleteFee = (feeId: string, isMandatory: boolean) => {
        if(isMandatory) setMandatoryFees(p => { const o = {...p}; delete o[feeId]; return o; });
        else setOptionalFees(p => { const o = {...p}; delete o[feeId]; return o; });
    };

    const handleSaveFees = async () => {
        setSaving(true);
        try {
             await update(ref(db, `semesters/${semester.id}`), { mandatoryFees, optionalFees });
             toast({ variant: 'success', title: 'Fees Updated' });
             onClose();
        } catch (e) { toast({ variant: 'destructive', title: 'Save Failed'});
        } finally { setSaving(false); }
    };

    return (
        <DialogContent>
            <DialogHeader><DialogTitle>Set Fees for {semester.name}</DialogTitle></DialogHeader>
            <div className="max-h-[70vh] overflow-y-auto pr-4 py-4 space-y-4">
                {/* Mandatory Fees */}
                <div className="space-y-2"><div className="flex justify-between items-center"><h4 className="font-semibold">Mandatory Fees</h4><Popover><PopoverTrigger asChild><Button size="sm" variant="outline"><PlusCircle className="mr-2 h-4"/>Import</Button></PopoverTrigger><PopoverContent>{feeTemplates.filter(t => t.type === 'Mandatory').map(t => <Button key={t.id} variant="ghost" className="w-full justify-start" onClick={()=>handleImportFee(t)}>{t.name}</Button>)}</PopoverContent></Popover></div><Table><TableBody>{Object.entries(mandatoryFees).map(([id, fee]) => <TableRow key={id}><TableCell>{fee.name}</TableCell><TableCell className="text-right">ZMW {fee.amount.toFixed(2)}</TableCell><TableCell className="w-[50px] text-right"><Button variant="ghost" size="icon" onClick={()=>handleDeleteFee(id, true)}><Trash2 className="h-4 w-4"/></Button></TableCell></TableRow>)}</TableBody></Table></div>
                {/* Optional Fees */}
                <div className="space-y-2"><div className="flex justify-between items-center"><h4 className="font-semibold">Optional Fees</h4><Popover><PopoverTrigger asChild><Button size="sm" variant="outline"><PlusCircle className="mr-2 h-4"/>Import</Button></PopoverTrigger><PopoverContent>{feeTemplates.filter(t => t.type === 'Optional').map(t => <Button key={t.id} variant="ghost" className="w-full justify-start" onClick={()=>handleImportFee(t)}>{t.name}</Button>)}</PopoverContent></Popover></div><Table><TableBody>{Object.entries(optionalFees).map(([id, fee]) => <TableRow key={id}><TableCell>{fee.name}</TableCell><TableCell className="text-right">ZMW {fee.amount.toFixed(2)}</TableCell><TableCell className="w-[50px] text-right"><Button variant="ghost" size="icon" onClick={()=>handleDeleteFee(id, false)}><Trash2 className="h-4 w-4"/></Button></TableCell></TableRow>)}</TableBody></Table></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSaveFees} disabled={saving}>{saving && <Loader2 className="mr-2"/>}Save Fees</Button></DialogFooter>
        </DialogContent>
    );
}


function DeadlinesDialogContent({ semester, allPaymentPlans, semesters, onClose }: { semester: Semester; allPaymentPlans: PaymentPlan[]; semesters: Semester[], onClose: () => void; }) {
    const [saving, setSaving] = React.useState(false);
    const [deadlineDates, setDeadlineDates] = React.useState<Record<string, Date | undefined>>({});
    const [editingDeadlineId, setEditingDeadlineId] = React.useState<string | null>(null);
    const [semesterDeadlines, setSemesterDeadlines] = React.useState<DeadlineInfo[]>([]);
    const [sourceSemesterId, setSourceSemesterId] = React.useState('');
    const { toast } = useToast();
    
    const fetchDeadlines = React.useCallback(async () => {
        setEditingDeadlineId(null); setDeadlineDates({});
        const eventsSnapshot = await get(ref(db, 'calendarEvents'));
        const eventMap = new Map<string, {date: string, id: string}>();
        if (eventsSnapshot.exists()) {
            Object.entries(eventsSnapshot.val()).forEach(([id, event]:[string, any]) => {
                eventMap.set(event.title.trim(), { date: event.date, id });
            });
        }
        const linkedPlanIds = Object.keys(semester.paymentPlanIds || {});
        const linkedPlans = allPaymentPlans.filter(p => linkedPlanIds.includes(p.id));
        const required: DeadlineInfo[] = [];
        linkedPlans.forEach(plan => {
             for (let i = 0; i < plan.installments; i++) {
                const title = `${plan.name} (${getOrdinalSuffix(i + 1)} Installment) Deadline - ${semester.name}`;
                const existing = eventMap.get(title.trim());
                required.push({ title: title.replace(` - ${semester.name}`, ''), date: existing?.date || null, eventId: existing?.id || null });
            }
        })
        setSemesterDeadlines(required);
    }, [semester, allPaymentPlans]);

    React.useEffect(() => {
        fetchDeadlines();
    }, [fetchDeadlines]);

    const handleSaveDeadline = async (title: string, eventId: string | null) => {
        const date = deadlineDates[title];
        if (!date) { toast({ variant: 'destructive', title: 'Date required' }); return; }
        setSaving(true);
        const fullTitle = `${title} - ${semester.name}`;
        try {
            if (eventId) {
                await update(ref(db, `calendarEvents/${eventId}`), { date: format(date, 'yyyy-MM-dd') });
            } else {
                const newEventRef = push(ref(db, 'calendarEvents'));
                await set(newEventRef, { title: fullTitle, date: format(date, 'yyyy-MM-dd'), semester: semester.name });
            }
            toast({ title: "Deadline Updated" });
            setDeadlineDates(prev => ({...prev, [title]: undefined}));
            setEditingDeadlineId(null);
            fetchDeadlines();
        } catch (error) { toast({ variant: 'destructive', title: 'Failed to save deadline' });
        } finally { setSaving(false); }
    };
    
    const handleImportDeadlines = async () => {
        if(!sourceSemesterId) return;
        setSaving(true);
        const sourceSemesterName = semesters.find(s => s.id === sourceSemesterId)?.name;
        try {
            const eventsSnapshot = await get(ref(db, 'calendarEvents'));
            const eventMap = new Map<string, {date: string, id: string}>();
            if (eventsSnapshot.exists()) {
                Object.entries(eventsSnapshot.val()).forEach(([id, event]:[string, any]) => {
                    eventMap.set(event.title.trim(), { date: event.date, id });
                });
            }

            const updates: Record<string, any> = {};
            for (const deadline of semesterDeadlines) {
                const sourceTitle = `${deadline.title} - ${sourceSemesterName}`;
                const sourceEvent = eventMap.get(sourceTitle);
                if (sourceEvent) {
                    const targetTitle = `${deadline.title} - ${semester.name}`;
                    if(deadline.eventId) { // Update existing
                        updates[`/calendarEvents/${deadline.eventId}/date`] = sourceEvent.date;
                    } else { // Create new
                        const newKey = push(ref(db, 'calendarEvents')).key!;
                        updates[`/calendarEvents/${newKey}`] = { title: targetTitle, date: sourceEvent.date, semester: semester.name };
                    }
                }
            }
             await update(ref(db), updates);
             toast({title: "Deadlines Imported Successfully"});
             fetchDeadlines();
        } catch (e) {
            toast({variant: 'destructive', title: 'Import Failed'});
        } finally {
            setSaving(false);
        }
    };


    return (
         <DialogContent>
            <DialogHeader><DialogTitle>Set Payment Deadlines for {semester.name}</DialogTitle></DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto pr-4 py-4 space-y-4">
                <div className="flex items-end gap-2 p-3 border rounded-md">
                     <div className="flex-grow space-y-1">
                        <Label>Import Deadlines</Label>
                        <Select value={sourceSemesterId} onValueChange={setSourceSemesterId}>
                           <SelectTrigger><SelectValue placeholder="Import from another semester..."/></SelectTrigger>
                           <SelectContent>{semesters.filter(s => s.id !== semester.id).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                     </div>
                     <Button onClick={handleImportDeadlines} disabled={!sourceSemesterId || saving}>Import</Button>
                </div>
                {semesterDeadlines.length > 0 ? (
                semesterDeadlines.map(({ title, date, eventId }) => {
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
                })
                ) : <p className="text-sm text-muted-foreground">No applicable payment plans found.</p>}
            </div>
            <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
        </DialogContent>
    );
}

