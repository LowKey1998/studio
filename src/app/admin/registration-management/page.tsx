
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
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
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
type Semester = { id: string; name: string; status: 'Open' | 'Closed' | 'Archived'; lateRegistrationActive?: boolean; startDate?: string; endDate?: string; paymentPlanIds?: Record<string, boolean>; mandatoryFees?: Record<string, Fee>; optionalFees?: Record<string, Fee>; };
type DeadlineInfo = { title: string; date: string | null; eventId: string | null; };
type CalendarEvent = { id: string; title: string; date: string; semester?: string; };
type Intake = { id: string; name: string };
type NewSemesterEntry = { year: number | ''; semesterInYear: number | '' };

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
        let name = feeName;
        let amount = feeAmount;

        if (isImportingFee) {
            const template = feeTemplates.find(t => t.id === selectedFeeTemplate);
            if (!template) { toast({ variant: 'destructive', title: 'Please select a template.' }); return; }
            name = template.name;
        }

        if (!name || !amount) { toast({ variant: 'destructive', title: 'Fee name and amount are required.' }); return; }

        const newFee = { name, amount: parseFloat(amount) };
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
        const nameToSave = editingSemester ? semesterNameInput : `${intakes.find(i => i.id === selectedIntakeId)?.name} Year ${newSemesterYear} Semester ${newSemesterInYear}`;

        if (!nameToSave.trim() || !semesterDates?.from) { toast({ variant: 'destructive', title: 'Missing Semester Details'}); return; }
        if (!editingSemester && (!selectedIntakeId || !newSemesterYear || !newSemesterInYear)) {
             toast({ variant: 'destructive', title: 'Please specify intake, year, and semester number for a new semester.' }); return;
        }
        
        setSaving(true);
        try {
            const semesterData: Omit<Semester, 'id'> & { id?: string, intakeId?: string, year?: number, semesterInYear?: number } = {
                ...(editingSemester || {}),
                name: nameToSave,
                status: editingSemester?.status || 'Closed',
                lateRegistrationActive: editingSemester?.lateRegistrationActive || false,
                startDate: format(semesterDates.from, 'yyyy-MM-dd'),
                endDate: semesterDates.to ? format(semesterDates.to, 'yyyy-MM-dd') : format(semesterDates.from, 'yyyy-MM-dd'),
                paymentPlanIds: selectedPaymentPlans,
                mandatoryFees,
                optionalFees,
            };
            
            if(!editingSemester) {
                semesterData.intakeId = selectedIntakeId;
                semesterData.year = Number(newSemesterYear);
                semesterData.semesterInYear = Number(newSemesterInYear);
            }

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
    
    const openFeeDialog = (isMandatory: boolean) => {
        setIsFeeMandatory(isMandatory);
        setIsImportingFee(true);
        setSelectedFeeTemplate('');
        setFeeName('');
        setFeeAmount('');
        setIsFeeDialogOpen(true);
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
            <TabsContent value="fees">
                <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                     <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <Label>Mandatory Fees</Label>
                            <Button size="sm" type="button" variant="outline" onClick={() => openFeeDialog(true)}><PlusCircle className="h-4 w-4 mr-1"/>Add Fee</Button>
                        </div>
                        <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="w-[50px]"></TableHead></TableRow></TableHeader>
                            <TableBody>{Object.keys(mandatoryFees).length > 0 ? Object.entries(mandatoryFees).map(([id, fee]) =>
                                <TableRow key={id}><TableCell>{fee.name}</TableCell><TableCell className="text-right">{fee.amount.toFixed(2)}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleDeleteFee(id, true)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell></TableRow>
                            ) : <TableRow><TableCell colSpan={3} className="text-center h-24">No mandatory fees added.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <Label>Optional Fees</Label>
                            <Button size="sm" type="button" variant="outline" onClick={() => openFeeDialog(false)}><PlusCircle className="h-4 w-4 mr-1"/>Add Fee</Button>
                        </div>
                        <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="w-[50px]"></TableHead></TableRow></TableHeader>
                            <TableBody>{Object.keys(optionalFees).length > 0 ? Object.entries(optionalFees).map(([id, fee]) =>
                                <TableRow key={id}><TableCell>{fee.name}</TableCell><TableCell className="text-right">{fee.amount.toFixed(2)}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleDeleteFee(id, false)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell></TableRow>
                            ) : <TableRow><TableCell colSpan={3} className="text-center h-24">No optional fees added.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </TabsContent>
        </Tabs>
        <Dialog open={isFeeDialogOpen} onOpenChange={setIsFeeDialogOpen}>
            <DialogContent onInteractOutside={(e) => e.stopPropagation()}>
                <DialogHeader><DialogTitle>Add {isFeeMandatory ? 'Mandatory' : 'Optional'} Fee</DialogTitle></DialogHeader>
                <Tabs defaultValue="import" onValueChange={(val) => setIsImportingFee(val === 'import')}><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="import">Import from Template</TabsTrigger><TabsTrigger value="custom">Create New</TabsTrigger></TabsList>
                    <TabsContent value="import" className="pt-4 space-y-4">
                        <div className="space-y-1"><Label>Fee Name</Label><Select value={selectedFeeTemplate} onValueChange={(val) => {setSelectedFeeTemplate(val); setFeeAmount(String(feeTemplates.find(t => t.id === val)?.amount || ''));}}><SelectTrigger><SelectValue placeholder="Select a fee template..."/></SelectTrigger><SelectContent>{feeTemplates.filter(t => t.type === (isFeeMandatory ? 'Mandatory' : 'Optional')).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-1"><Label>Amount (ZMW)</Label><Input type="number" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} placeholder="e.g., 250" /></div>
                    </TabsContent>
                    <TabsContent value="custom" className="pt-4 space-y-4">
                        <div className="space-y-1"><Label>Fee Name</Label><Input value={feeName} onChange={(e) => setFeeName(e.target.value)} placeholder="e.g., Lab Gown Fee"/></div>
                        <div className="space-y-1"><Label>Amount (ZMW)</Label><Input type="number" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} placeholder="e.g., 300" /></div>
                    </TabsContent>
                </Tabs>
                <DialogFooter><Button variant="ghost" onClick={() => setIsFeeDialogOpen(false)}>Cancel</Button><Button onClick={handleAddFee}>Add Fee to Semester</Button></DialogFooter>
            </DialogContent>
        </Dialog>
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
    
    const [activePathSemesters, setActivePathSemesters] = React.useState<Record<string, Record<string, { active: boolean; showReason: boolean; }>>>({});
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = React.useState(false);
    const [viewingHistory, setViewingHistory] = React.useState<CoursePathHistoryItem[]>([]);
    
    const [allPaymentPlans, setAllPaymentPlans] = React.useState<PaymentPlan[]>([]);
    const [feeTemplates, setFeeTemplates] = React.useState<FeeTemplate[]>([]);
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [allCalendarEvents, setAllCalendarEvents] = React.useState<CalendarEvent[]>([]);

    
    const [editingDeadlinesFor, setEditingDeadlinesFor] = React.useState<Semester | null>(null);
    const [semesterDeadlines, setSemesterDeadlines] = React.useState<DeadlineInfo[]>([]);
    const [deadlineDates, setDeadlineDates] = React.useState<Record<string, Date | undefined>>({});
    const [editingDeadlineId, setEditingDeadlineId] = React.useState<string | null>(null);

    // Create Semester Dialog
    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
    const [editingSemester, setEditingSemester] = React.useState<Semester | null>(null);
    
    const [filterIntake, setFilterIntake] = React.useState('');
    const [filterStatus, setFilterStatus] = React.useState('Open');


    const { toast } = useToast();
    
    const refreshData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [
                intakesSnap, programmesSnap, coursesSnap, coursePathsSnap, 
                offeringsSnap, plansSnap, semestersSnap, feesSnap, calendarSnap
            ] = await Promise.all([
                get(ref(db, 'intakes')), get(ref(db, 'programmes')), get(ref(db, 'courses')),
                get(ref(db, 'coursePaths')), get(ref(db, 'semesterOfferings')), get(ref(db, 'settings/paymentPlans')),
                get(ref(db, 'semesters')), get(ref(db, 'settings/feeTemplates')), get(ref(db, 'calendarEvents'))
            ]);
    
            setAllIntakes(Object.values(intakesSnap.val() || {}));
            setAllProgrammes(Object.values(programmesSnap.val() || {}));
            setAllCourses(coursesSnap.val() || {});
            setAllCoursePaths(Object.values(coursePathsSnap.val() || {}));
            setActivePathSemesters(offeringsSnap.val() || {});
            setAllPaymentPlans(Object.values(plansSnap.val() || {}));
            setSemesters(Object.values(semestersSnap.val() || {}));
            setFeeTemplates(Object.values(feesSnap.val() || {}));
            setAllCalendarEvents(Object.values(calendarSnap.val() || {}));

        } catch (e) { console.error(e) } 
        finally { setLoading(false); }
    }, []);

    React.useEffect(() => {
        refreshData();
    }, [refreshData]);
    
    const openEditDialog = (semester: Semester) => {
        setEditingSemester(semester);
        setIsEditDialogOpen(true);
    };

    const handleToggleSemesterStatus = async (semester: Semester) => {
        const newStatus = semester.status === 'Open' ? 'Closed' : 'Open';
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
    
    const handleArchiveSemester = async (semesterId: string) => {
        if(!window.confirm("Are you sure? Archiving will hide this semester from most views.")) return;
        try {
            await update(ref(db, `semesters/${semesterId}`), { status: 'Archived' });
            toast({ title: 'Semester Archived' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to archive semester.'})
        }
    };
    
    const filteredSemesters = React.useMemo(() => {
        return semesters.filter(s => {
            const statusMatch = filterStatus === 'all' || s.status === filterStatus;
            const intakeMatch = !filterIntake || s.intakeId === filterIntake;
            return statusMatch && intakeMatch;
        }).sort((a,b) => b.name.localeCompare(a.name));
    }, [semesters, filterIntake, filterStatus]);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex-row items-center justify-between">
                    <CardTitle className="font-headline text-2xl">Semester Management</CardTitle>
                     <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                        <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4"/> New Semester</Button></DialogTrigger>
                        <DialogContent className="sm:max-w-xl"><CreateOrEditDialogContent editingSemester={null} onClose={() => setIsCreateDialogOpen(false)} onSaveSuccess={() => {refreshData(); setIsCreateDialogOpen(false);}} allPaymentPlans={allPaymentPlans} feeTemplates={feeTemplates} intakes={allIntakes} /></DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1"><Label>Filter by Intake</Label><Select value={filterIntake} onValueChange={setFilterIntake}><SelectTrigger><SelectValue placeholder="All Intakes..." /></SelectTrigger><SelectContent><SelectItem value="">All Intakes</SelectItem>{allIntakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
                        <div className="flex-1"><Label>Filter by Status</Label><Tabs value={filterStatus} onValueChange={setFilterStatus}><TabsList className="grid w-full grid-cols-3"><TabsTrigger value="Open">Open</TabsTrigger><TabsTrigger value="Closed">Closed</TabsTrigger><TabsTrigger value="Archived">Archived</TabsTrigger></TabsList></Tabs></div>
                    </div>
                </CardContent>
                 <Table>
                    <TableHeader><TableRow><TableHead>Semester Name</TableHead><TableHead>Dates</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-12 w-full"/></TableCell></TableRow> : 
                        filteredSemesters.map(s => (
                            <TableRow key={s.id}>
                                <TableCell className="font-medium">{s.name}</TableCell>
                                <TableCell>{s.startDate && s.endDate ? `${format(parseISO(s.startDate), 'PPP')} - ${format(parseISO(s.endDate), 'PPP')}`: 'Not set'}</TableCell>
                                <TableCell><Switch checked={s.status === 'Open'} onCheckedChange={() => handleToggleSemesterStatus(s)}/></TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(s)}><Pencil className="h-4 w-4"/></Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleArchiveSemester(s.id)}><Trash2 className="h-4 w-4"/></Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                 </Table>
            </Card>

            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="text-xl">Course Registration Openings</CardTitle>
                    <CardDescription>Activate which semesters are open for registration for each intake and programme path.</CardDescription>
                </CardHeader>
                <CardContent>
                     {loading ? (<div className="space-y-4 pt-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}</div>
                    ) : allIntakes.length > 0 ? (
                        <Accordion type="multiple" defaultValue={allIntakes.map(p => p.id)} className="w-full">
                            {allIntakes.map(intake => (
                                    <AccordionItem value={intake.id} key={intake.id}>
                                        <AccordionTrigger className="font-bold text-xl">{intake.name}</AccordionTrigger>
                                        <AccordionContent className="space-y-4">
                                            {allProgrammes.map(programme => {
                                                const path = allCoursePaths.find(p => p.intakeId === intake.id && p.programmeId === programme.id);
                                                if (!path || !path.semesters) return null;
                                                
                                                return (
                                                    <Card key={programme.id} className="my-2 bg-muted/50">
                                                        <CardHeader>
                                                            <CardTitle className="text-base">{programme.name}</CardTitle>
                                                        </CardHeader>
                                                        <CardContent className="space-y-4">
                                                            {Object.entries(path.semesters).map(([semNum, semData]) => {
                                                                const semester = semesters.find(s => s.intakeId === intake.id && s.year === Math.floor((Number(semNum) - 1) / 2) + 1 && s.semesterInYear === (Number(semNum) - 1) % 2 + 1);
                                                                if(!semester) return null;

                                                                const label = `Year ${semester.year}, Semester ${semester.semesterInYear}`;
                                                                
                                                                return (
                                                                <div key={semNum} className="p-4 border rounded-lg bg-card">
                                                                    <div className="flex justify-between items-center mb-2">
                                                                        <Label htmlFor={`${path.id}-${semNum}`} className="font-bold text-lg">{label}</Label>
                                                                        <div className="flex items-center gap-2">
                                                                            <Switch 
                                                                                id={`${path.id}-${semNum}`} 
                                                                                checked={!!activePathSemesters[semester.id]?.isOpen}
                                                                                onCheckedChange={() => handleToggleSemesterStatus(semester)}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                )
                                                            })}
                                                        </CardContent>
                                                    </Card>
                                                )
                                            })}
                                            {allProgrammes.every(p => !allCoursePaths.some(path => path.intakeId === intake.id && path.programmeId === p.id)) && (
                                                 <p className="text-sm text-muted-foreground p-4 text-center">No course paths defined for this intake.</p>
                                            )}
                                        </AccordionContent>
                                    </AccordionItem>
                            ))}
                            </Accordion>
                        ) : (<div className="py-16 text-center text-muted-foreground"><BookOpen className="mx-auto h-12 w-12" /><h3 className="mt-4 text-lg font-semibold">No Intakes Found</h3><p className="mt-2 text-sm">Create intakes from the "Intakes / Course Paths" page first.</p></div>
                        )
                    }
                </CardContent>
            </Card>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-xl">
                    <CreateOrEditDialogContent
                        editingSemester={editingSemester}
                        onClose={() => setIsEditDialogOpen(false)}
                        onSaveSuccess={() => { refreshData(); setIsEditDialogOpen(false); }}
                        allPaymentPlans={allPaymentPlans}
                        feeTemplates={feeTemplates}
                        intakes={allIntakes}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}
