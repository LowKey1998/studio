
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, PlusCircle, BookOpen, Calendar as CalendarIcon, Trash2, Plus, Power, PowerOff, DollarSign, Pencil, ShieldAlert, Info, Route } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, createNotification, getAllStudentAndStaffIds } from '@/lib/firebase';
import { ref, get, set, onValue, push, update, remove } from 'firebase/database';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"


// --- TYPE DEFINITIONS ---
type Course = { id: string; name: string; code: string; lecturerName?: string; status: 'active' | 'archived'; year: number; };
type CalendarEvent = { id: string; title: string; date: string; };
type Fee = { id: string; name: string; amount: number; };
type FeeTemplate = { id: string; name: string; amount: number; type: 'Mandatory' | 'Optional'; };
type GroupedCourses = { [year: string]: Course[]; };
type Programme = { id: string; name: string; };
type PaymentPlan = { id: string; name: string; installments: number; installmentPercentages: number[]; archived?: boolean; };
type Semester = { id: string; name: string; status: 'Open' | 'Closed' | 'Archived'; lateRegistrationActive?: boolean; innovationHubActive?: boolean; startDate?: string; endDate?: string; paymentPlanIds?: Record<string, boolean>; mandatoryFees?: Record<string, Omit<Fee, 'id'>>; optionalFees?: Record<string, Omit<Fee, 'id'>>; };
type DeadlineInfo = { title: string; date: string | null; eventId: string | null; };
type Intake = { id: string; name: string; };
type CoursePath = { id: string; intakeId: string; programmeId: string; semesters: Record<number, { courses: string[] }> };


const getOrdinalSuffix = (i: number) => {
    if (i === 1) return '1st';
    if (i === 2) return '2nd';
    if (i === 3) return '3rd';
    return `${i}th`;
};

// --- DIALOG CONTENT COMPONENT ---
type CreateOrEditDialogContentProps = { editingSemester: Semester | null; onClose: () => void; onSaveSuccess: () => void; allPaymentPlans: PaymentPlan[]; feeTemplates: FeeTemplate[]; };

function CreateOrEditDialogContent({ editingSemester, onClose, onSaveSuccess, allPaymentPlans, feeTemplates }: CreateOrEditDialogContentProps) {
    const [saving, setSaving] = React.useState(false);
    const [semesterNameInput, setSemesterNameInput] = React.useState('');
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
            setSemesterDates({ from: editingSemester.startDate ? parseISO(editingSemester.startDate) : undefined, to: editingSemester.endDate ? parseISO(editingSemester.endDate) : undefined });
            setSelectedPaymentPlans(editingSemester.paymentPlanIds || {});
            setMandatoryFees(editingSemester.mandatoryFees || {});
            setOptionalFees(editingSemester.optionalFees || {});
        } else {
             setSemesterNameInput(''); setSemesterDates(undefined); setSelectedPaymentPlans({}); setMandatoryFees({}); setOptionalFees({});
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
        const feeId = selectedFeeTemplate; // Use the template's ID as the key
        
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
            setMandatoryFees(prev => { const newFees = { ...prev }; delete newFees[feeId]; return newFees; });
        } else {
            setOptionalFees(prev => { const newFees = { ...prev }; delete newFees[feeId]; return newFees; });
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
                innovationHubActive: editingSemester?.innovationHubActive || false,
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
                            <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1"/>Import {isMandatory ? 'Mandatory' : 'Optional'} Fee</Button>
                        </DialogTrigger>
                        <DialogContent onInteractOutside={(e) => e.stopPropagation()}>
                            <DialogHeader><DialogTitle>Import {isMandatory ? 'Mandatory' : 'Optional'} Fee Template</DialogTitle></DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-1"><Label>Fee Name</Label>
                                    <Select value={selectedFeeTemplate} onValueChange={(val) => {setSelectedFeeTemplate(val); setFeeAmount(String(feeTemplates.find(t => t.id === val)?.amount || ''));}}>
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

// --- MAIN PAGE COMPONENT ---
export default function RegistrationManagementPage() {
    const [allIntakes, setAllIntakes] = React.useState<Intake[]>([]);
    const [allProgrammes, setAllProgrammes] = React.useState<Programme[]>([]);
    const [allCoursePaths, setAllCoursePaths] = React.useState<CoursePath[]>([]);
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
    
    const [activePathSemesters, setActivePathSemesters] = React.useState<Record<string, number>>({});

    const { toast } = useToast();
    
     React.useEffect(() => {
        const semestersRef = ref(db, 'semesters');
        const paymentPlansRef = ref(db, 'settings/paymentPlans');
        const feeTemplatesRef = ref(db, 'settings/feeTemplates');
        const intakesRef = ref(db, 'intakes');
        const programmesRef = ref(db, 'programmes');
        const coursePathsRef = ref(db, 'coursePaths');
        
        const unsubs = [
            onValue(semestersRef, (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    const list: Semester[] = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                    setSemesters(list.sort((a, b) => b.name.localeCompare(a.name)));
                    if (!selectedSemester && list.length > 0) setSelectedSemester(list[0].id);
                }
            }),
            onValue(paymentPlansRef, (snapshot) => {
                 setAllPaymentPlans(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })) : []);
            }),
            onValue(feeTemplatesRef, (snapshot) => {
                 setFeeTemplates(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })) : []);
            }),
            onValue(intakesRef, (snapshot) => {
                setAllIntakes(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })) : []);
            }),
            onValue(programmesRef, (snapshot) => {
                 setAllProgrammes(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })) : []);
            }),
             onValue(coursePathsRef, (snapshot) => {
                setAllCoursePaths(snapshot.exists() ? Object.values(snapshot.val()) : []);
            })
        ];

        setLoading(false);
        return () => unsubs.forEach(unsub => unsub());
    }, [selectedSemester]);
    
     React.useEffect(() => {
        const semesterName = semesters.find(s => s.id === selectedSemester)?.name;
        if (!semesterName) return;
        const offeringsRef = ref(db, `semesterOfferings/${semesterName}/activePathSemesters`);
        const unsub = onValue(offeringsRef, (snapshot) => {
            setActivePathSemesters(snapshot.exists() ? snapshot.val() : {});
        });
        return () => unsub();
     },[selectedSemester, semesters])

    const fetchDataForSemester = React.useCallback(async () => {
        const semesterData = semesters.find(s => s.id === selectedSemester);
        if (!semesterData) { setLoading(false); return; }
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
        }
    }, [selectedSemester, semesters, toast, allPaymentPlans]);

    React.useEffect(() => {
        if(selectedSemester){ fetchDataForSemester();
        } else { setLoading(false); }
    }, [selectedSemester, fetchDataForSemester]);

    const handleToggleSemesterStatus = async (semester: Semester) => {
        let newStatus: Semester['status'];
        if (semester.status === 'Open') newStatus = 'Closed'; else newStatus = 'Open';

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
    
    const handleToggleInnovationHub = async (semester: Semester) => {
        const newStatus = !(semester.innovationHubActive ?? false);
        try { await update(ref(db, `semesters/${semester.id}`), { innovationHubActive: newStatus });
             toast({ variant: 'success', title: `Innovation Hub ${newStatus ? 'Enabled' : 'Disabled'}` });
        } catch (e: any) { toast({ variant: 'destructive', title: 'Update Failed', description: e.message }); }
    };

    const handleSaveChanges = async () => {
        const semester = semesters.find(s => s.id === selectedSemester);
        if (!semester) return;
        setSaving(true);
        try { 
            await set(ref(db, `semesterOfferings/${semester.name}/activePathSemesters`), activePathSemesters);
            toast({ variant: 'success', title: 'Settings Saved', description: `Registration settings for ${semester.name} have been updated.` });
        } catch (error: any) { toast({ variant: 'destructive', title: 'Save Failed', description: error.message || 'An unexpected error occurred.' });
        } finally { setSaving(false); }
    };
    
    const handleSaveDeadline = async (title: string, eventId: string | null) => {
        const date = deadlineDates[title];
        if (!date) { toast({ variant: 'destructive', title: 'Date required' }); return; }
        setSaving(true);
        const fullTitle = `${title} - ${currentSemester?.name}`;
        try {
            if(eventId) { // Editing existing event
                await update(ref(db, `calendarEvents/${eventId}`), { date: format(date, 'yyyy-MM-dd') });
                toast({ title: "Deadline Updated" });
            } else { // Creating new event
                await set(push(ref(db, 'calendarEvents')), { title: fullTitle, date: format(date, 'yyyy-MM-dd'), semester: currentSemester?.name });
                toast({ title: `${title} Added` });
            }
            setDeadlineDates(prev => { const newDates = { ...prev }; delete newDates[title]; return newDates; });
            setEditingDeadlineId(null);
            fetchDataForSemester(); // Refetch data to update deadline list
        } catch (error: any) { 
            toast({ variant: 'destructive', title: 'Failed to save deadline' }); 
        } finally { 
            setSaving(false); 
        }
    }
    
     const handleDeleteSemester = async () => {
        if (!currentSemester) return;
        setSaving(true);
        try {
            // Also need to remove semesterOfferings
            await remove(ref(db, `semesters/${currentSemester.id}`));
            await remove(ref(db, `semesterOfferings/${currentSemester.name}`));
            toast({ title: 'Semester Deleted' });
            setSelectedSemester(''); // Reset selection
        } catch(e: any) {
            toast({ variant: 'destructive', title: 'Deletion Failed', description: e.message });
        } finally {
            setSaving(false);
        }
    };
    
    const currentSemester = semesters.find(s => s.id === selectedSemester);
    const semesterName = currentSemester?.name || '';
    const canSave = semesterDeadlines.every(d => d.date !== null);

    return (
        <div className="space-y-6">
        <Card className="shadow-lg"><CardHeader><CardTitle className="font-headline text-2xl">Registration Management</CardTitle><CardDescription>Create semesters, manage fees, and activate course paths for registration.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-end gap-2"><div className="flex-grow"><Label htmlFor="semester-select">Select Semester</Label>
                    <Select value={selectedSemester} onValueChange={setSelectedSemester}><SelectTrigger id="semester-select"><SelectValue placeholder="Select a semester..." /></SelectTrigger>
                        <SelectContent>{semesters.map(s => (<SelectItem key={s.id} value={s.id}><div className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", s.status === 'Open' ? 'bg-green-500' : s.status === 'Closed' ? 'bg-red-500' : 'bg-gray-400')}></span>{s.name} ({s.status})</div></SelectItem>))}</SelectContent>
                    </Select>
                </div>
                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                        <DialogTrigger asChild><Button variant="outline"><PlusCircle className="mr-2 h-4 w-4"/> New Semester</Button></DialogTrigger>
                        <DialogContent className="sm:max-w-xl"><CreateOrEditDialogContent editingSemester={null} onClose={() => setIsCreateDialogOpen(false)} onSaveSuccess={() => {fetchDataForSemester(); setIsCreateDialogOpen(false);}} allPaymentPlans={allPaymentPlans} feeTemplates={feeTemplates} /></DialogContent>
                    </Dialog>
                </div>
                 {currentSemester && (
                    <div className="space-y-4"><div className='flex flex-wrap gap-2'>
                        <Button variant={currentSemester.status === 'Open' ? 'destructive' : 'default'} onClick={() => handleToggleSemesterStatus(currentSemester)} disabled={!canSave && currentSemester.status !== 'Open'} title={!canSave && currentSemester.status !== 'Open' ? 'Set payment deadlines first' : ''}>{currentSemester.status === 'Open' ? <PowerOff className="mr-2 h-4 w-4" /> : <Power className="mr-2 h-4 w-4" />}{currentSemester.status === 'Open' ? 'Close Registration' : 'Open Registration'}</Button>
                        {currentSemester.status === 'Open' && (<Button variant={currentSemester.lateRegistrationActive ? 'destructive' : 'secondary'} onClick={() => handleToggleLateRegistration(currentSemester)}><ShieldAlert className="mr-2 h-4 w-4" />{currentSemester.lateRegistrationActive ? 'Disable Late Registration' : 'Enable Late Registration'}</Button>)}
                        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                            <DialogTrigger asChild><Button variant="outline" onClick={() => setEditingSemester(currentSemester)}><Pencil className="mr-2 h-4 w-4" /> Edit</Button></DialogTrigger>
                            <DialogContent className="sm:max-w-xl"><CreateOrEditDialogContent editingSemester={editingSemester} onClose={() => setIsEditDialogOpen(false)} onSaveSuccess={() => {fetchDataForSemester(); setIsEditDialogOpen(false);}} allPaymentPlans={allPaymentPlans} feeTemplates={feeTemplates} /></DialogContent>
                        </Dialog>
                         <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="destructive"><Trash2 className="mr-2 h-4 w-4"/>Delete</Button></AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action will permanently delete the <strong>{currentSemester.name}</strong> semester and all associated settings. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteSemester}>Yes, delete semester</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                         </AlertDialog>
                         <div className="flex items-center space-x-2 p-2 border rounded-md">
                            <Switch id="innovation-hub-switch" checked={currentSemester.innovationHubActive} onCheckedChange={() => handleToggleInnovationHub(currentSemester)} />
                            <Label htmlFor="innovation-hub-switch" className="flex items-center gap-2"><Lightbulb className="h-4 w-4" /> Innovation Hub Active</Label>
                        </div>
                    </div>
                        {!loading && !canSave && currentSemester.status !== 'Open' && (<Alert variant="destructive" className="mt-4"><AlertCircle className="h-4 w-4" /><AlertTitle>Action Required: Missing Payment Deadlines</AlertTitle><AlertDescription><p>You cannot open registration for <strong>{semesterName}</strong> until all payment deadlines for its linked payment plans are set in the Academic Calendar. The following are missing:</p><ul className="list-disc pl-5 mt-2 mb-3 text-xs">{semesterDeadlines.filter(d => d.date === null).map(d => <li key={d.title}>{d.title}</li>)}</ul><Button asChild variant="link" className="p-0 h-auto"><Link href="/admin/calendar">Go to Calendar to add deadlines</Link></Button></AlertDescription></Alert>)}
                    </div>
                 )}
            </CardContent>
        </Card>
        {currentSemester && (<Card><CardHeader><CardTitle>Payment Deadlines for {semesterName}</CardTitle><CardDescription>An overview of payment due dates for this semester. Payment plans without all deadlines set will not be available to students.</CardDescription></CardHeader><CardContent>
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
                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={displayDate} onSelect={(d) => setDeadlineDates(p => ({...p, [title]: d}))} initialFocus /></PopoverContent>
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
                    )
                })}</div>
                ) : (<Alert variant="default"><Info className="h-4 w-4"/><AlertTitle>No Payment Plans Linked</AlertTitle><AlertDescription>There are no payment plans linked to this semester, so no deadlines are required.</AlertDescription></Alert>)}
            </CardContent><CardFooter className="flex justify-end"><Button variant="outline" asChild><Link href="/admin/calendar"><CalendarIcon className="mr-2 h-4 w-4" /> Manage in Calendar</Link></Button></CardFooter>
        </Card>
        )}
        <Card className="shadow-lg"><CardHeader><CardTitle className="text-xl">Available Course Paths for {semesterName}</CardTitle><CardDescription>Activate the relevant semester from a course path to make its courses available for registration.</CardDescription></CardHeader>
            <CardContent>
                 {loading ? (<div className="space-y-4 pt-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}</div>
                ) : selectedSemester ? (allIntakes.length > 0 ? (
                    <Accordion type="multiple" defaultValue={allIntakes.map(p => p.id)} className="w-full">
                           {allIntakes.map(intake => (
                                <AccordionItem value={intake.id} key={intake.id}><AccordionTrigger className="font-bold text-xl">{intake.name}</AccordionTrigger>
                                    <AccordionContent>{allProgrammes.map(programme => {
                                        const path = allCoursePaths.find(p => p.intakeId === intake.id && p.programmeId === programme.id);
                                        if (!path || !path.semesters) return null;
                                        return (
                                            <Card key={programme.id} className="my-2">
                                                <CardHeader><CardTitle className="text-base">{programme.name}</CardTitle></CardHeader>
                                                <CardContent>
                                                    <p className="text-sm text-muted-foreground mb-2">Select which semester of this path is active for registration:</p>
                                                    <Select
                                                        value={activePathSemesters[path.id]?.toString()}
                                                        onValueChange={(val) => setActivePathSemesters(prev => ({...prev, [path.id]: Number(val)}))}
                                                    >
                                                        <SelectTrigger><SelectValue placeholder="No semester active..."/></SelectTrigger>
                                                        <SelectContent>
                                                            {Object.keys(path.semesters).map(semNum => (
                                                                <SelectItem key={semNum} value={semNum}>
                                                                    Semester {semNum}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </CardContent>
                                            </Card>
                                        )
                                    })}
                                    </AccordionContent>
                                </AccordionItem>
                           ))}
                        </Accordion>
                    ) : (<div className="py-16 text-center text-muted-foreground"><BookOpen className="mx-auto h-12 w-12" /><h3 className="mt-4 text-lg font-semibold">No Intakes Found</h3><p className="mt-2 text-sm">Create intakes from the "Intakes & Course Paths" page first.</p></div>
                    )
                ) : (<div className="py-16 text-center text-muted-foreground"><p>Please select a semester to view and manage available courses.</p></div>)}
            </CardContent>
            <CardFooter className="flex justify-end items-center gap-4 border-t pt-6">
                <Button onClick={handleSaveChanges} disabled={saving || loading || (!canSave && currentSemester?.status !== 'Open')}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{saving ? 'Saving...' : 'Save Changes'}</Button>
            </CardFooter>
        </Card>
        </div>
    );
}
