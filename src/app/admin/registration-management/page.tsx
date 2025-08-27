
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, Route, History, Info, Download, Power, PowerOff, ShieldAlert, Pencil, PlusCircle, Calendar as CalendarIcon, FileText, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
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
type Course = { id: string; name: string; code: string; year: number; cost: number; status: 'active' | 'archived'; lecturerName?: string; };
type Fee = { id: string; name: string; amount: number; };
type FeeTemplate = { id: string; name: string; amount: number; type: 'Mandatory' | 'Optional'; };
type GroupedCourses = { [year: string]: Course[]; };
type Programme = { id: string; name: string; courseIds?: Record<string, boolean>; coursesByYear?: GroupedCourses; tuitionFee?: number; };
type PaymentPlan = { id: string; name: string; installments: number; installmentPercentages: number[]; archived?: boolean; };
type Semester = { id: string; name: string; status: 'Open' | 'Closed' | 'Archived'; lateRegistrationActive?: boolean; startDate?: string; endDate?: string; paymentPlanIds?: Record<string, boolean>; mandatoryFees?: Record<string, Fee>; optionalFees?: Record<string, Fee>; intakeId?: string; year?: number; semesterInYear?: number; };
type DeadlineInfo = { title: string; date: string | null; eventId: string | null; };
type CalendarEvent = { id: string; title: string; date: string; semester?: string; };
type Intake = { id: string; name: string };
type CoursePath = { id: string; intakeId: string; programmeId: string; semesters: Record<string, { courses: string[] }> };


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
    const [semesterDates, setSemesterDates] = React.useState<DateRange | undefined>();
    const [selectedPaymentPlans, setSelectedPaymentPlans] = React.useState<Record<string, boolean>>({});
    const [mandatoryFees, setMandatoryFees] = React.useState<Record<string, Omit<Fee, 'id'>>>({});
    const [optionalFees, setOptionalFees] = React.useState<Record<string, Omit<Fee, 'id'>>>({});
    
    // New Semester fields
    const [selectedIntakeId, setSelectedIntakeId] = React.useState('');
    const [newSemesterYear, setNewSemesterYear] = React.useState<number | ''>('');
    const [newSemesterInYear, setNewSemesterInYear] = React.useState<number | ''>('');
    const [semesterNameInput, setSemesterNameInput] = React.useState('');

    // Fee Dialog States
    const [isFeeDialogOpen, setIsFeeDialogOpen] = React.useState(false);
    const [isFeeMandatory, setIsFeeMandatory] = React.useState(false);
    const [isImportingFee, setIsImportingFee] = React.useState(true);
    const [selectedFeeTemplate, setSelectedFeeTemplate] = React.useState('');
    const [feeName, setFeeName] = React.useState('');
    const [feeAmount, setFeeAmount] = React.useState('');

    const { toast } = useToast();
    
    React.useEffect(() => {
        if (editingSemester) {
            setSemesterNameInput(editingSemester.name || '');
            setSelectedIntakeId(editingSemester.intakeId || '');
            setNewSemesterYear(editingSemester.year || '');
            setNewSemesterInYear(editingSemester.semesterInYear || '');
            setSemesterDates({
                from: editingSemester.startDate ? parseISO(editingSemester.startDate) : undefined,
                to: editingSemester.endDate ? parseISO(editingSemester.endDate) : undefined
            });
            setSelectedPaymentPlans(editingSemester.paymentPlanIds || {});
            setMandatoryFees(editingSemester.mandatoryFees || {});
            setOptionalFees(editingSemester.optionalFees || {});
        } else {
            setSemesterNameInput('');
            setSelectedIntakeId('');
            setNewSemesterYear('');
            setNewSemesterInYear('');
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

    const handleAddFee = () => {
        let currentFeeName = isImportingFee ? feeTemplates.find(t => t.id === selectedFeeTemplate)?.name || '' : feeName;
        let currentFeeAmount = feeAmount;

        if (isImportingFee) {
            const template = feeTemplates.find(t => t.id === selectedFeeTemplate);
            if (!template) { toast({ variant: 'destructive', title: 'Please select a template.' }); return; }
            currentFeeName = template.name;
        }

        if (!currentFeeName || !currentFeeAmount) { toast({ variant: 'destructive', title: 'Fee name and amount are required.' }); return; }

        const newFee = { name: currentFeeName, amount: parseFloat(currentFeeAmount) };
        const feeId = push(ref(db, 'semesters')).key!;

        if (isFeeMandatory) {
            setMandatoryFees(prev => ({ ...prev, [feeId]: newFee }));
        } else {
            setOptionalFees(prev => ({ ...prev, [feeId]: newFee }));
        }
        
        setFeeName('');
        setFeeAmount('');
        setSelectedFeeTemplate('');
        setIsFeeDialogOpen(false);
    };

    const handleDeleteFee = (feeId: string, isMandatory: boolean) => {
        if (isMandatory) {
            setMandatoryFees(prev => { const newFees = { ...prev }; delete newFees[feeId]; return newFees; });
        } else {
            setOptionalFees(prev => { const newFees = { ...prev }; delete newFees[feeId]; return newFees; });
        }
    };

    const handleSaveSemester = async () => {
        const nameToSave = editingSemester ? semesterNameInput : `${intakes.find(i => i.id === selectedIntakeId)?.name} Year ${newSemesterYear} Semester ${newSemesterInYear}`;

        if (!nameToSave.trim() || !semesterDates?.from) { toast({ variant: 'destructive', title: 'Missing Semester Details'}); return; }
        if (!editingSemester && (!selectedIntakeId || !newSemesterYear || !newSemesterInYear)) {
             toast({ variant: 'destructive', title: 'Please specify intake, year, and semester number for a new semester.' }); return;
        }
        
        setSaving(true);
        try {
            const semesterData: Omit<Semester, 'id'> & { id?: string } = {
                ...(editingSemester || {}),
                name: nameToSave,
                status: editingSemester?.status || 'Closed',
                lateRegistrationActive: editingSemester?.lateRegistrationActive || false,
                startDate: format(semesterDates.from, 'yyyy-MM-dd'),
                endDate: semesterDates.to ? format(semesterDates.to, 'yyyy-MM-dd') : format(semesterDates.from, 'yyyy-MM-dd'),
                paymentPlanIds: selectedPaymentPlans,
                mandatoryFees,
                optionalFees,
                intakeId: editingSemester?.intakeId || selectedIntakeId,
                year: editingSemester?.year || Number(newSemesterYear),
                semesterInYear: editingSemester?.semesterInYear || Number(newSemesterInYear),
            };

            const refPath = editingSemester ? `semesters/${editingSemester.id}` : `semesters/${push(ref(db, 'semesters')).key}`;
            await set(ref(db, refPath), semesterData);
            
            toast({ variant: 'success', title: `Semester ${editingSemester ? 'Updated' : 'Created'}` });
            onSaveSuccess();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Operation Failed', description: error.message });
        } finally {
            setSaving(false);
        }
    };
    
    const openFeeDialog = (isMandatory: boolean) => {
        setIsFeeMandatory(isMandatory);
        setIsImportingFee(true);
        setSelectedFeeTemplate('');
        setFeeName('');
        setFeeAmount('');
        setIsFeeDialogOpen(true);
    };

    const renderFeeContent = (isMandatory: boolean) => {
        const fees = isMandatory ? mandatoryFees : optionalFees;

        return (
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <Label>{isMandatory ? 'Mandatory Fees' : 'Optional Fees'}</Label>
                    <Dialog open={isMandatory ? isMandatoryFeeDialogOpen : isOptionalFeeDialogOpen} onOpenChange={isMandatory ? setIsMandatoryFeeDialogOpen : setIsOptionalFeeDialogOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" type="button" variant="outline" onClick={() => openFeeDialog(isMandatory)}><PlusCircle className="h-4 w-4 mr-1"/>Add Fee</Button>
                        </DialogTrigger>
                        <DialogContent onInteractOutside={(e) => e.stopPropagation()}>
                            <DialogHeader><DialogTitle>Add {isMandatory ? 'Mandatory' : 'Optional'} Fee</DialogTitle></DialogHeader>
                            <Tabs defaultValue="import" onValueChange={(val) => setIsImportingFee(val === 'import')}><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="import">Import from Template</TabsTrigger><TabsTrigger value="custom">Create New</TabsTrigger></TabsList>
                                <TabsContent value="import" className="pt-4 space-y-4">
                                    <div className="space-y-1"><Label>Fee Name</Label><Select value={selectedFeeTemplate} onValueChange={(val) => {setSelectedFeeTemplate(val); setFeeAmount(String(feeTemplates.find(t => t.id === val)?.amount || ''));}}><SelectTrigger><SelectValue placeholder={`Select a ${isMandatory ? 'mandatory' : 'optional'} fee...`}/></SelectTrigger><SelectContent>{feeTemplates.filter(t => t.type === (isMandatory ? 'Mandatory' : 'Optional')).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
                                    <div className="space-y-1"><Label>Amount (ZMW)</Label><Input type="number" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} placeholder="e.g., 250" /></div>
                                </TabsContent>
                                <TabsContent value="custom" className="pt-4 space-y-4">
                                    <div className="space-y-1"><Label>Fee Name</Label><Input value={feeName} onChange={(e) => setFeeName(e.target.value)} placeholder="e.g., Lab Gown Fee"/></div>
                                    <div className="space-y-1"><Label>Amount (ZMW)</Label><Input type="number" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} placeholder="e.g., 300" /></div>
                                </TabsContent>
                            </Tabs>
                            <DialogFooter><Button variant="ghost" onClick={() => (isMandatory ? setIsMandatoryFeeDialogOpen : setIsOptionalFeeDialogOpen)(false)}>Cancel</Button><Button onClick={() => handleAddFee(isMandatory)}>Add Fee</Button></DialogFooter>
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
                <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                    {editingSemester ? (
                         <div className="space-y-1"><Label htmlFor="semester-name">Semester Name</Label><Input id="semester-name" value={semesterNameInput} onChange={(e) => setSemesterNameInput(e.target.value)} /></div>
                    ) : (
                        <div className="grid grid-cols-3 gap-2">
                             <div className="space-y-1"><Label>Intake</Label><Select value={selectedIntakeId} onValueChange={setSelectedIntakeId}><SelectTrigger><SelectValue placeholder="Intake"/></SelectTrigger><SelectContent>{intakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
                             <div className="space-y-1"><Label>Year</Label><Input type="number" min="1" value={newSemesterYear} onChange={e => setNewSemesterYear(Number(e.target.value))} placeholder="e.g. 1"/></div>
                             <div className="space-y-1"><Label>Semester</Label><Input type="number" min="1" max="3" value={newSemesterInYear} onChange={e => setNewSemesterInYear(Number(e.target.value))} placeholder="e.g. 1"/></div>
                        </div>
                    )}
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
            <TabsContent value="fees"><div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-4">{renderFeeContent(true)}<Separator className="my-4"/>{renderFeeContent(false)}</div></TabsContent>
        </Tabs>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSaveSemester} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{editingSemester ? 'Save Changes' : 'Create Semester'}</Button></DialogFooter>
        </>
    );
}

// --- MAIN PAGE COMPONENT ---
export default function RegistrationManagementPage() {
    const [allIntakes, setAllIntakes] = React.useState<Intake[]>([]);
    const [allProgrammes, setAllProgrammes] = React.useState<Programme[]>([]);
    const [allCourses, setAllCourses] = React.useState<Record<string, Course>>({});
    const [allCoursePaths, setAllCoursePaths] = React.useState<CoursePath[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    const [semesterOfferings, setSemesterOfferings] = React.useState<Record<string, { isOpen: boolean }>>({});
    
    const [allPaymentPlans, setAllPaymentPlans] = React.useState<PaymentPlan[]>([]);
    const [feeTemplates, setFeeTemplates] = React.useState<FeeTemplate[]>([]);
    const [semesters, setSemesters] = React.useState<Semester[]>([]);

    // Filter states
    const [intakeFilter, setIntakeFilter] = React.useState('all');
    const [activeTab, setActiveTab] = React.useState<'Open' | 'Closed' | 'Archived'>('Open');


    const [editingSemester, setEditingSemester] = React.useState<Semester | null>(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [isEditDialogOpen] = React.useState(false);

    const { toast } = useToast();
    
    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [
                semestersSnap, coursesSnap, programmesSnap, plansSnap, feesSnap, intakesSnap, coursePathsSnap, offeringsSnap
            ] = await Promise.all([
                get(ref(db, 'semesters')), get(ref(db, 'courses')), get(ref(db, 'programmes')),
                get(ref(db, 'settings/paymentPlans')), get(ref(db, 'settings/feeTemplates')),
                get(ref(db, 'intakes')), get(ref(db, 'coursePaths')), get(ref(db, 'semesterOfferings'))
            ]);
    
            setSemesters(semestersSnap.exists() ? Object.keys(semestersSnap.val()).map(id => ({ id, ...semestersSnap.val()[id] })) : []);
            setAllCourses(coursesSnap.val() || {});
            setAllProgrammes(programmesSnap.exists() ? Object.keys(programmesSnap.val()).map(id => ({ id, ...programmesSnap.val()[id] })) : []);
            setAllPaymentPlans(plansSnap.exists() ? Object.keys(plansSnap.val()).map(id => ({ id, ...plansSnap.val()[id] })) : []);
            setFeeTemplates(feesSnap.exists() ? Object.keys(feesSnap.val()).map(id => ({ id, ...feesSnap.val()[id] })) : []);
            const intakesData = intakesSnap.val() || {};
            setAllIntakes(intakesSnap.exists() ? Object.keys(intakesData).map(id => ({ id, ...intakesData[id] })).sort((a,b) => b.name.localeCompare(a.name)) : []);
            setAllCoursePaths(coursePathsSnap.exists() ? Object.values(coursePathsSnap.val()) : []);
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
    
    const handleToggleLateRegistration = async (semester: Semester) => {
        const newStatus = !(semester.lateRegistrationActive ?? false);
        try { await update(ref(db, `semesters/${semester.id}`), { lateRegistrationActive: newStatus });
             toast({ variant: 'success', title: `Late Registration ${newStatus ? 'Enabled' : 'Disabled'}` });
             fetchData();
        } catch (e: any) { toast({ variant: 'destructive', title: 'Update Failed', description: e.message }); }
    };
    
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
            <CardHeader className="flex flex-col md:flex-row md:justify-between md:items-center">
                <div>
                    <CardTitle className="font-headline text-2xl">Registration Management</CardTitle>
                    <CardDescription>Create, manage, and open semesters for student registration.</CardDescription>
                </div>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild><Button variant="default"><PlusCircle className="mr-2 h-4 w-4"/> New Semester</Button></DialogTrigger>
                    <DialogContent className="sm:max-w-xl"><CreateOrEditDialogContent editingSemester={null} onClose={() => setIsCreateDialogOpen(false)} onSaveSuccess={() => {fetchData(); setIsCreateDialogOpen(false);}} allPaymentPlans={allPaymentPlans} feeTemplates={feeTemplates} intakes={allIntakes} /></DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col md:flex-row gap-4 mb-4">
                    <div className="flex-1">
                        <Label htmlFor="intake-filter">Filter by Intake</Label>
                        <Select value={intakeFilter} onValueChange={setIntakeFilter}>
                            <SelectTrigger id="intake-filter"><SelectValue/></SelectTrigger>
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
                </div>
                 <Accordion type="multiple" className="w-full">
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
                                    <Button variant={semester.status === 'Open' ? 'destructive' : 'default'} onClick={() => handleToggleSemesterStatus(semester)}>{semester.status === 'Open' ? <PowerOff className="mr-2 h-4 w-4" /> : <Power className="mr-2 h-4 w-4" />}{semester.status === 'Open' ? 'Close Registration' : 'Open Registration'}</Button>
                                    {semester.status === 'Open' && (<Button variant={semester.lateRegistrationActive ? 'destructive' : 'secondary'} onClick={() => handleToggleLateRegistration(semester)}><ShieldAlert className="mr-2 h-4 w-4" />{semester.lateRegistrationActive ? 'Disable Late Registration' : 'Enable Late Registration'}</Button>)}
                                    <Button variant="outline" onClick={() => handleOpenEditDialog(semester)}><Pencil className="mr-2 h-4 w-4" /> Edit Details</Button>
                                    <Button variant="outline" onClick={() => handleArchiveSemester(semester.id)}><Trash2 className="mr-2 h-4 w-4"/> Archive</Button>
                               </div>
                                <FinancialSetupView semester={semester} allPaymentPlans={allPaymentPlans} />
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

function FinancialSetupView({ semester, allPaymentPlans }: { semester: Semester, allPaymentPlans: PaymentPlan[] }) {
    const availablePlans = semester.paymentPlanIds ? Object.keys(semester.paymentPlanIds).map(id => allPaymentPlans.find(p => p.id === id)).filter(Boolean) as PaymentPlan[] : [];

    return (
        <Card className="mt-4">
             <CardHeader><CardTitle>Financial Setup</CardTitle><CardDescription>Overview of fees and payment plans for this semester.</CardDescription></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
                <div>
                    <h4 className="font-semibold mb-2">Mandatory Fees</h4>
                    <Table>
                        <TableBody>
                            {semester.mandatoryFees && Object.values(semester.mandatoryFees).length > 0 ? Object.values(semester.mandatoryFees).map((fee, i) => (
                                <TableRow key={`mand-${i}`}><TableCell>{fee.name}</TableCell><TableCell className="text-right">ZMW {fee.amount.toFixed(2)}</TableCell></TableRow>
                            )) : <TableRow><TableCell colSpan={2} className="text-center h-24">No mandatory fees.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </div>
                 <div>
                    <h4 className="font-semibold mb-2">Optional Fees</h4>
                    <Table>
                        <TableBody>
                            {semester.optionalFees && Object.values(semester.optionalFees).length > 0 ? Object.values(semester.optionalFees).map((fee, i) => (
                                <TableRow key={`opt-${i}`}><TableCell>{fee.name}</TableCell><TableCell className="text-right">ZMW {fee.amount.toFixed(2)}</TableCell></TableRow>
                            )) : <TableRow><TableCell colSpan={2} className="text-center h-24">No optional fees.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </div>
                <div className="md:col-span-2">
                    <h4 className="font-semibold mb-2">Available Payment Plans</h4>
                     {availablePlans.length > 0 ? (
                        <div className="space-y-2">
                            {availablePlans.map(plan => (
                                <div key={plan.id} className="p-3 border rounded-md">
                                    <p className="font-medium">{plan.name}</p>
                                    <p className="text-sm text-muted-foreground">{plan.installments} Installment(s): {plan.installmentPercentages.join('% / ')}%</p>
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-sm text-muted-foreground">No payment plans assigned.</p>}
                </div>
                 <div className="md:col-span-2">
                     <h4 className="font-semibold mb-2">Late Registration Fee</h4>
                    <p className="text-sm text-muted-foreground">ZMW {(semester as any).lateRegistrationFee?.toFixed(2) || '0.00'}</p>
                </div>
            </CardContent>
        </Card>
    )
}
