
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
        let currentFeeName = feeName;
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

    const renderFeeContent = (isMandatory: boolean) => {
        const fees = isMandatory ? mandatoryFees : optionalFees;
        return (
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <Label>{isMandatory ? 'Mandatory Fees' : 'Optional Fees'}</Label>
                    <Dialog open={isFeeDialogOpen && isFeeMandatory === isMandatory} onOpenChange={setIsFeeDialogOpen}>
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
                            <DialogFooter><Button variant="ghost" onClick={() => setIsFeeDialogOpen(false)}>Cancel</Button><Button onClick={handleAddFee}>Add Fee to Semester</Button></DialogFooter>
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
            <TabsContent value="fees">
                <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                    {renderFeeContent(true)}
                    <Separator/>
                    {renderFeeContent(false)}
                </div>
            </TabsContent>
        </Tabs>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSaveSemester} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{editingSemester ? 'Save Changes' : 'Create Semester'}</Button></DialogFooter>
        </>
    );
}

// --- MAIN PAGE COMPONENT ---
export default function RegistrationManagementPage() {
    const [allCourses, setAllCourses] = React.useState<Record<string, Course>>({});
    const [allProgrammes, setAllProgrammes] = React.useState<Programme[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [selectedSemester, setSelectedSemester] = React.useState<string>('');
    const [allPaymentPlans, setAllPaymentPlans] = React.useState<PaymentPlan[]>([]);
    const [feeTemplates, setFeeTemplates] = React.useState<FeeTemplate[]>([]);
    const [intakes, setIntakes] = React.useState<Intake[]>([]);
    
    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
    const [editingSemester, setEditingSemester] = React.useState<Semester | null>(null);

    const [availableForSemester, setAvailableForSemester] = React.useState<string[]>([]);
    const [semesterDeadlines, setSemesterDeadlines] = React.useState<DeadlineInfo[]>([]);

    const [filterIntake, setFilterIntake] = React.useState('all');
    const [filterStatus, setFilterStatus] = React.useState('Open');

    const { toast } = useToast();
    
    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [
                semestersSnap, coursesSnap, programmesSnap, plansSnap, feesSnap, intakesSnap
            ] = await Promise.all([
                get(ref(db, 'semesters')), get(ref(db, 'courses')), get(ref(db, 'programmes')),
                get(ref(db, 'settings/paymentPlans')), get(ref(db, 'settings/feeTemplates')),
                get(ref(db, 'intakes')),
            ]);
    
            setSemesters(semestersSnap.exists() ? Object.keys(semestersSnap.val()).map(id => ({ id, ...semestersSnap.val()[id] })) : []);
            setAllCourses(coursesSnap.val() || {});
            setAllProgrammes(programmesSnap.exists() ? Object.keys(programmesSnap.val()).map(id => ({ id, ...programmesSnap.val()[id] })) : []);
            setAllPaymentPlans(plansSnap.exists() ? Object.keys(plansSnap.val()).map(id => ({ id, ...plansSnap.val()[id] })) : []);
            setFeeTemplates(feesSnap.exists() ? Object.keys(feesSnap.val()).map(id => ({ id, ...feesSnap.val()[id] })) : []);
            setIntakes(intakesSnap.exists() ? Object.keys(intakesSnap.val()).map(id => ({ id, ...intakesSnap.val()[id] })) : []);

        } catch (e) { console.error(e) } 
        finally { setLoading(false); }
    }, []);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);
    

    const fetchSemesterSpecificData = React.useCallback(async () => {
        const semesterData = semesters.find(s => s.id === selectedSemester);
        if (!semesterData) return;
    
        const [offeringsSnap, eventsSnap, pathSnap] = await Promise.all([
            get(ref(db, `semesterOfferings/${semesterData.id}/courseIds`)),
            get(ref(db, 'calendarEvents')),
            get(ref(db, 'coursePaths'))
        ]);
    
        setAvailableForSemester(offeringsSnap.exists() ? offeringsSnap.val() : []);

        const eventMap = new Map<string, {date: string, id: string}>();
        if (eventsSnap.exists()) { 
            Object.entries(eventsSnap.val()).forEach(([id, event]:[string, any]) => {
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

    }, [selectedSemester, semesters, allPaymentPlans]);

    React.useEffect(() => {
        if(selectedSemester) fetchSemesterSpecificData();
    }, [selectedSemester, fetchSemesterSpecificData]);

    const handleToggleSemesterStatus = async (semester: Semester) => {
        let newStatus: Semester['status'];
        if (semester.status === 'Open') newStatus = 'Closed';
        else {
             if (semesterDeadlines.some(d => d.date === null)) {
                toast({ variant: 'destructive', title: "Cannot Open Semester", description: "All payment deadlines must be set in the Academic Calendar before opening." });
                return;
            }
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

    const handleSelectCourse = (courseId: string) => {
        setAvailableForSemester(prev => prev.includes(courseId) ? prev.filter(id => id !== courseId) : [...prev, courseId]);
    };

    const handleSaveChanges = async () => {
        if (!selectedSemester) return;
        setSaving(true);
        try { await set(ref(db, `semesterOfferings/${selectedSemester}`), { courseIds: availableForSemester, isOpen: true });
            toast({ variant: 'success', title: 'Settings Saved' });
        } catch (error: any) { toast({ variant: 'destructive', title: 'Save Failed', description: error.message || 'An unexpected error occurred.' });
        } finally { setSaving(false); }
    };

    const filteredSemesters = React.useMemo(() => {
        return semesters.filter(s => {
            const statusMatch = filterStatus === 'all' || s.status === filterStatus;
            const intakeMatch = filterIntake === 'all' || s.intakeId === filterIntake;
            return statusMatch && intakeMatch;
        }).sort((a,b) => b.name.localeCompare(a.name));
    }, [semesters, filterIntake, filterStatus]);

    const openEditDialog = (semester: Semester) => {
        setEditingSemester(semester);
        setIsEditDialogOpen(true);
    };

    const currentSemester = semesters.find(s => s.id === selectedSemester);
    const hasUnsetDeadlines = semesterDeadlines.some(d => d.date === null);
    
    return (
        <div className="space-y-6">
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="font-headline text-2xl">Registration Management</CardTitle>
                <CardDescription>Create semesters and manage registration settings for them.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1"><Label>Filter by Intake</Label><Select value={filterIntake} onValueChange={setFilterIntake}><SelectTrigger><SelectValue placeholder="All Intakes..." /></SelectTrigger><SelectContent><SelectItem value="all">All Intakes</SelectItem>{intakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="flex-1"><Label>Filter by Status</Label><Tabs value={filterStatus} onValueChange={setFilterStatus}><TabsList className="grid w-full grid-cols-3"><TabsTrigger value="Open">Open</TabsTrigger><TabsTrigger value="Closed">Closed</TabsTrigger><TabsTrigger value="Archived">Archived</TabsTrigger></TabsList></Tabs></div>
                    <div className="self-end"><Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}><DialogTrigger asChild><Button variant="outline"><PlusCircle className="mr-2 h-4 w-4"/> New Semester</Button></DialogTrigger><DialogContent className="sm:max-w-xl"><CreateOrEditDialogContent editingSemester={null} onClose={() => setIsCreateDialogOpen(false)} onSaveSuccess={() => {fetchData(); setIsCreateDialogOpen(false);}} allPaymentPlans={allPaymentPlans} feeTemplates={feeTemplates} intakes={intakes} /></DialogContent></Dialog></div>
                </div>
            </CardContent>
            <Table>
                <TableHeader><TableRow><TableHead>Semester Name</TableHead><TableHead>Status</TableHead><TableHead>Late Registration</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                    {loading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-12 w-full"/></TableCell></TableRow> : 
                    filteredSemesters.map(s => (
                        <TableRow key={s.id} onClick={() => setSelectedSemester(s.id)} className={cn("cursor-pointer", selectedSemester === s.id && "bg-accent")}>
                            <TableCell className="font-medium">{s.name}</TableCell>
                            <TableCell><Switch checked={s.status === 'Open'} onCheckedChange={() => handleToggleSemesterStatus(s)}/></TableCell>
                            <TableCell><Switch checked={s.lateRegistrationActive} onCheckedChange={() => handleToggleLateRegistration(s)}/></TableCell>
                            <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => openEditDialog(s)}><Pencil className="h-4 w-4"/></Button></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Card>

        {selectedSemester && !loading && (
        <Card>
            <CardHeader><CardTitle>Configuration for {semesters.find(s => s.id === selectedSemester)?.name}</CardTitle></CardHeader>
            <CardContent>
                <Tabs defaultValue="courses">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="courses">Available Courses</TabsTrigger>
                        <TabsTrigger value="financials">Financial Setup</TabsTrigger>
                    </TabsList>
                    <TabsContent value="courses" className="pt-4">
                       <AvailableCoursesView allCourses={allCourses} allProgrammes={allProgrammes} selectedSemester={selectedSemester} availableForSemester={availableForSemester} handleSelectCourse={handleSelectCourse} />
                    </TabsContent>
                    <TabsContent value="financials" className="pt-4">
                       <FinancialSetupView semester={semesters.find(s => s.id === selectedSemester)} deadlines={semesterDeadlines} />
                    </TabsContent>
                </Tabs>
            </CardContent>
            <CardFooter className="flex justify-end items-center gap-4 border-t pt-6">
                 <div className="text-sm text-muted-foreground"><span className="font-bold text-foreground">{availableForSemester.length}</span> course(s) selected for registration</div>
                <Button onClick={handleSaveChanges} disabled={saving || loading || (currentSemester?.status !== 'Open' && hasUnsetDeadlines)}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
            </CardFooter>
        </Card>
        )}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}><DialogContent className="sm:max-w-xl"><CreateOrEditDialogContent editingSemester={editingSemester} onClose={() => setIsEditDialogOpen(false)} onSaveSuccess={() => { fetchData(); setIsEditDialogOpen(false); }} allPaymentPlans={allPaymentPlans} feeTemplates={feeTemplates} intakes={intakes}/></DialogContent></Dialog>
        </div>
    );
}

function AvailableCoursesView({ allProgrammes, allCourses, selectedSemester, availableForSemester, handleSelectCourse }: { allProgrammes: Programme[], allCourses: Record<string, Course>, selectedSemester: string, availableForSemester: string[], handleSelectCourse: (courseId: string) => void }) {
    const programmeCourseMap = React.useMemo(() => {
        return allProgrammes.map(prog => {
            const courseIds = Object.keys(prog.courseIds || {});
            const coursesInProg = courseIds.map(id => allCourses[id]).filter(Boolean);
            const coursesByYear = coursesInProg.reduce((acc, course) => {
                const yearKey = `Year ${course.year}`;
                if(!acc[yearKey]) acc[yearKey] = [];
                acc[yearKey].push(course);
                return acc;
            }, {} as GroupedCourses);
            return { ...prog, coursesByYear: Object.fromEntries(Object.entries(coursesByYear).sort(([a], [b]) => parseInt(a.replace('Year ', '')) - parseInt(b.replace('Year ', '')))) };
        });
    }, [allProgrammes, allCourses]);
    
    return (
        <Accordion type="multiple" defaultValue={allProgrammes.map(p => p.id)} className="w-full">
            {programmeCourseMap.map(prog => (
                <AccordionItem value={prog.id} key={prog.id}>
                    <AccordionTrigger className="font-semibold text-lg">{prog.name}</AccordionTrigger>
                    <AccordionContent>
                        {prog.tuitionFee ? (
                             <Alert>
                                <Info className="h-4 w-4"/>
                                <AlertTitle>Flat Fee Programme</AlertTitle>
                                <AlertDescription>This programme charges a flat tuition fee per semester. All courses are mandatory and pre-selected for registration.</AlertDescription>
                            </Alert>
                        ) : null}
                         <Accordion type="multiple" defaultValue={Object.keys(prog.coursesByYear || {})}>
                            {Object.entries(prog.coursesByYear || {}).map(([year, courses]) => (
                                <AccordionItem value={year} key={year}>
                                    <AccordionTrigger>{year}</AccordionTrigger>
                                    <AccordionContent className="space-y-2">
                                        {courses.map(course => (
                                            <div key={course.id} className="flex items-center gap-2 p-2 rounded-md border">
                                                <Checkbox id={`${prog.id}-${course.id}`} checked={availableForSemester.includes(course.id)} onCheckedChange={() => handleSelectCourse(course.id)} disabled={!!prog.tuitionFee} />
                                                <Label htmlFor={`${prog.id}-${course.id}`}>{course.name} ({course.code})</Label>
                                            </div>
                                        ))}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    )
}

function FinancialSetupView({ semester, deadlines }: { semester: Semester | undefined, deadlines: DeadlineInfo[] }) {
     if(!semester) return null;
    return (
        <div className="grid md:grid-cols-2 gap-6">
            <div>
                <h4 className="font-semibold mb-2">Mandatory Fees</h4>
                <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Amount (ZMW)</TableHead></TableRow></TableHeader>
                <TableBody>{semester.mandatoryFees ? Object.values(semester.mandatoryFees).map((fee, i) => (
                    <TableRow key={`mand-${i}`}><TableCell>{fee.name}</TableCell><TableCell className="text-right">{fee.amount.toFixed(2)}</TableCell></TableRow>
                )) : <TableRow><TableCell colSpan={2} className="h-24 text-center">No mandatory fees.</TableCell></TableRow>}
                </TableBody>
                </Table>
            </div>
             <div>
                <h4 className="font-semibold mb-2">Optional Fees</h4>
                <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Amount (ZMW)</TableHead></TableRow></TableHeader>
                <TableBody>{semester.optionalFees ? Object.values(semester.optionalFees).map((fee, i) => (
                    <TableRow key={`opt-${i}`}><TableCell>{fee.name}</TableCell><TableCell className="text-right">{fee.amount.toFixed(2)}</TableCell></TableRow>
                )) : <TableRow><TableCell colSpan={2} className="h-24 text-center">No optional fees.</TableCell></TableRow>}
                </TableBody>
                </Table>
            </div>
             <div className="md:col-span-2">
                <h4 className="font-semibold mb-2">Payment Deadlines</h4>
                 <div className="border rounded-md p-4 space-y-2">
                 {deadlines.length > 0 ? deadlines.map((d, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                        <span>{d.title}</span>
                        {d.date ? <span className="font-semibold">{format(parseISO(d.date), 'PPP')}</span> : <Badge variant="destructive">Not Set</Badge>}
                    </div>
                )) : <p className="text-sm text-center text-muted-foreground">No payment plans linked to this semester.</p>}
                </div>
            </div>
        </div>
    )
}


    