
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
type Semester = { id: string; name: string; status: 'Open' | 'Closed' | 'Archived'; lateRegistrationActive?: boolean; startDate?: string; endDate?: string; paymentPlanIds?: Record<string, boolean>; mandatoryFees?: Record<string, Fee>; optionalFees?: Record<string, Fee>; lateRegistrationFee?: number; intakeId: string; };
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
    allIntakes: Intake[];
};

function CreateOrEditDialogContent({ editingSemester, onClose, onSaveSuccess, allPaymentPlans, feeTemplates, allIntakes }: CreateOrEditDialogContentProps) {
    const [saving, setSaving] = React.useState(false);
    const [semesterNameInput, setSemesterNameInput] = React.useState('');
    const [semesterDates, setSemesterDates] = React.useState<DateRange | undefined>();
    const [selectedPaymentPlans, setSelectedPaymentPlans] = React.useState<Record<string, boolean>>({});
    const [mandatoryFees, setMandatoryFees] = React.useState<Record<string, Omit<Fee, 'id'>>>({});
    const [optionalFees, setOptionalFees] = React.useState<Record<string, Omit<Fee, 'id'>>>({});
    const [lateRegistrationFee, setLateRegistrationFee] = React.useState<number | string>('');
    const [selectedIntakeId, setSelectedIntakeId] = React.useState('');
    
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
            setSelectedIntakeId(editingSemester.intakeId || '');
        } else {
             setSemesterNameInput('');
             setSemesterDates(undefined);
             setSelectedPaymentPlans({});
             setMandatoryFees({});
             setOptionalFees({});
             setLateRegistrationFee('');
             setSelectedIntakeId('');
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
        if (!semesterNameInput.trim() || !semesterDates?.from || !selectedIntakeId) { toast({ variant: 'destructive', title: 'Missing Semester Details'}); return; }
        setSaving(true);
        try {
            const semesterData: Omit<Semester, 'id'> & { id?: string } = {
                ...(editingSemester || {}),
                name: semesterNameInput.trim(),
                intakeId: selectedIntakeId,
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
                    <div className="space-y-1"><Label htmlFor="semester-intake">Intake</Label>
                        <Select value={selectedIntakeId} onValueChange={setSelectedIntakeId}><SelectTrigger><SelectValue placeholder="Select intake..."/></SelectTrigger><SelectContent>{allIntakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select>
                    </div>
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
    
    const [allIntakes, setAllIntakes] = React.useState<Intake[]>([]);
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [allPaymentPlans, setAllPaymentPlans] = React.useState<PaymentPlan[]>([]);
    const [feeTemplates, setFeeTemplates] = React.useState<FeeTemplate[]>([]);
    const [selectedIntake, setSelectedIntake] = React.useState<string>('all');
    
    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
    const [editingSemester, setEditingSemester] = React.useState<Semester | null>(null);

    const [semesterDeadlines, setSemesterDeadlines] = React.useState<DeadlineInfo[]>([]);
    const [deadlineDates, setDeadlineDates] = React.useState<Record<string, Date | undefined>>({});
    const [editingDeadlineId, setEditingDeadlineId] = React.useState<string | null>(null);
    const [isDeadlineDialogOpen, setIsDeadlineDialogOpen] = React.useState(false);

    const { toast } = useToast();
    
    const refreshData = React.useCallback(async () => {
        const refs = [
            ref(db, 'semesters'),
            ref(db, 'settings/paymentPlans'),
            ref(db, 'settings/feeTemplates'),
            ref(db, 'intakes')
        ];
        
        setLoading(true);
        try {
            const [semestersSnap, paymentPlansSnap, feeTemplatesSnap, intakesSnap] = await Promise.all(refs.map(r => get(r)));

            const semestersData = semestersSnap.exists() ? semestersSnap.val() : {};
            const paymentPlansData = paymentPlansSnap.exists() ? paymentPlansSnap.val() : {};
            const feeTemplatesData = feeTemplatesSnap.exists() ? feeTemplatesSnap.val() : {};
            const intakesData = intakesSnap.exists() ? intakesSnap.val() : {};
            
            const list: Semester[] = Object.keys(semestersData).map(key => ({ id: key, ...semestersData[key] }));
            setSemesters(list.sort((a, b) => b.name.localeCompare(a.name)));

            setAllPaymentPlans(Object.keys(paymentPlansData).map(id => ({ id, ...paymentPlansData[id] })));
            setFeeTemplates(Object.keys(feeTemplatesData).map(id => ({ id, ...feeTemplatesData[id] })));
            setAllIntakes(Object.keys(intakesData).map(id => ({ id, ...intakesData[id] })).sort((a,b) => b.name.localeCompare(a.name)));
        } catch (error) {
            console.error("Failed to refresh data:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to load latest data." });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        refreshData();
    }, []);

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
    
    const filteredSemesters = React.useMemo(() => {
        if(selectedIntake === 'all') return semesters;
        return semesters.filter(s => s.intakeId === selectedIntake);
    }, [semesters, selectedIntake]);

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
                    <DialogContent className="sm:max-w-xl"><CreateOrEditDialogContent editingSemester={null} onClose={() => setIsCreateDialogOpen(false)} onSaveSuccess={() => {refreshData(); setIsCreateDialogOpen(false);}} allPaymentPlans={allPaymentPlans} feeTemplates={feeTemplates} allIntakes={allIntakes} /></DialogContent>
                </Dialog>
            </CardHeader>
             <CardContent>
                <div className="mb-4">
                    <Label htmlFor="intake-filter">Filter by Intake</Label>
                    <Select value={selectedIntake} onValueChange={setSelectedIntake}>
                        <SelectTrigger id="intake-filter" className="max-w-sm"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="all">All Intakes</SelectItem>{allIntakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <Table>
                    <TableHeader><TableRow><TableHead>Semester Name</TableHead><TableHead>Status</TableHead><TableHead>Late Registration</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-20 w-full"/></TableCell></TableRow> :
                         filteredSemesters.map(semester => (
                             <TableRow key={semester.id}>
                                 <TableCell>{semester.name}</TableCell>
                                 <TableCell><span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${semester.status === 'Open' ? 'border-transparent bg-green-500 text-white' : 'border-transparent bg-gray-400 text-white'}`}>{semester.status}</span></TableCell>
                                 <TableCell><span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${semester.lateRegistrationActive ? 'border-transparent bg-green-500 text-white' : 'border-transparent bg-gray-400 text-white'}`}>{semester.lateRegistrationActive ? 'Active' : 'Inactive'}</span></TableCell>
                                 <TableCell className="text-right space-x-2">
                                     <Button size="sm" variant="outline" onClick={() => {setEditingSemester(semester); setIsEditDialogOpen(true);}}>Edit</Button>
                                     <Button size="sm" variant={semester.status === 'Open' ? 'destructive' : 'default'} onClick={() => handleToggleSemesterStatus(semester)}>{semester.status === 'Open' ? 'Close' : 'Open'} Reg</Button>
                                     {semester.status === 'Open' && (<Button size="sm" variant="secondary" onClick={() => handleToggleLateRegistration(semester)}>{semester.lateRegistrationActive ? 'Disable Late' : 'Enable Late'} Reg</Button>)}
                                 </TableCell>
                             </TableRow>
                         ))
                        }
                    </TableBody>
                </Table>
             </CardContent>
        </Card>
        
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-xl"><CreateOrEditDialogContent editingSemester={editingSemester} onClose={() => setIsEditDialogOpen(false)} onSaveSuccess={() => {refreshData(); setIsEditDialogOpen(false);}} allPaymentPlans={allPaymentPlans} feeTemplates={feeTemplates} allIntakes={allIntakes} /></DialogContent>
        </Dialog>
        </div>
    );
}
