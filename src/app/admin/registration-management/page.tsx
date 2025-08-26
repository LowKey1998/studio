
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, Route, History, Info, Download, Power, PowerOff, ShieldAlert, Pencil, PlusCircle, Calendar as CalendarIcon, FileText, Wallet, HandCoins, BookCopy, DollarSign } from 'lucide-react';
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
import { format, parseISO, isBefore } from 'date-fns';
import Link from 'next/link';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle } from 'lucide-react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';


// --- TYPE DEFINITIONS ---
type Course = { id: string; name: string; code: string; };
type Intake = { id: string; name: string; };
type Programme = { id: string; name: string; };
type CoursePathHistoryItem = { reason: string; oldCourses: string[]; newCourses: string[]; timestamp: any; };
type CoursePathSemester = { courses: string[]; history?: Record<string, CoursePathHistoryItem>; };
type CoursePath = { id: string; intakeId: string; programmeId: string; semesters: Record<string, CoursePathSemester> }; // Key is now semesterId
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
    const [lateRegistrationFee, setLateRegistrationFee] = React.useState<number>(0);
    const [semesterDates, setSemesterDates] = React.useState<DateRange | undefined>();
    const [selectedPaymentPlans, setSelectedPaymentPlans] = React.useState<Record<string, boolean>>({});
    const [mandatoryFees, setMandatoryFees] = React.useState<Record<string, Omit<Fee, 'id'>>>({});
    const [optionalFees, setOptionalFees] = React.useState<Record<string, Omit<Fee, 'id'>>>({});
    
    const [isFeeDialogOpen, setIsFeeDialogOpen] = React.useState(false);
    const [isMandatoryFee, setIsMandatoryFee] = React.useState(false);

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

    const handleOpenFeeDialog = (isMandatory: boolean) => {
        setIsMandatoryFee(isMandatory);
        setIsFeeDialogOpen(true);
    };

    const handleImportFee = (isMandatory: boolean) => {
        if (!selectedFeeTemplate || !feeAmount) { toast({ variant: 'destructive', title: 'Missing Fee Details' }); return; }
        const template = feeTemplates.find(t => t.id === selectedFeeTemplate);
        if (!template) return;
        
        const newFee = { name: template.name, amount: parseFloat(feeAmount) };
        const feeId = push(ref(db, 'semesters')).key!;
        
        if (isMandatory) {
            setMandatoryFees(prev => ({ ...prev, [feeId]: newFee }));
        } else {
            setOptionalFees(prev => ({ ...prev, [feeId]: newFee }));
        }
        setIsFeeDialogOpen(false);
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
    
        return (
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <Label>{isMandatory ? 'Mandatory Fees' : 'Optional Fees'}</Label>
                    <Dialog open={isFeeDialogOpen && isMandatoryFee === isMandatory} onOpenChange={(open) => { if (!open) setIsFeeDialogOpen(false) }}>
                        <DialogTrigger asChild>
                            <Button size="sm" type="button" variant="outline" onClick={() => handleOpenFeeDialog(isMandatory)}>
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
                            <DialogFooter><Button variant="ghost" onClick={() => {setIsFeeDialogOpen(false);}}>Cancel</Button><Button onClick={() => handleImportFee(isMandatory)} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Add Fee to Semester</Button></DialogFooter>
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
    
    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
    const [editingSemester, setEditingSemester] = React.useState<Semester | null>(null);

    const [editingDeadlinesFor, setEditingDeadlinesFor] = React.useState<{ semesterName: string; } | null>(null);
    const [semesterDeadlines, setSemesterDeadlines] = React.useState<DeadlineInfo[]>([]);
    const [deadlineDates, setDeadlineDates] = React.useState<Record<string, Date | undefined>>({});
    const [editingDeadlineId, setEditingDeadlineId] = React.useState<string | null>(null);


    const { toast } = useToast();
    
    const refreshData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [
                intakesSnap, programmesSnap, coursesSnap, coursePathsSnap, semesterOfferingsSnap,
                paymentPlansSnap, semestersSnap, feeTemplatesSnap
            ] = await Promise.all([
                get(ref(db, 'intakes')), get(ref(db, 'programmes')), get(ref(db, 'courses')),
                get(ref(db, 'coursePaths')), get(ref(db, 'semesterOfferings')), get(ref(db, 'settings/paymentPlans')),
                get(ref(db, 'semesters')), get(ref(db, 'settings/feeTemplates'))
            ]);

            setAllIntakes(intakesSnap.exists() ? Object.keys(intakesSnap.val()).map(id => ({ id, ...intakesSnap.val()[id] })).sort((a, b) => b.name.localeCompare(a.name)) : []);
            setAllProgrammes(programmesSnap.exists() ? Object.keys(programmesSnap.val()).map(id => ({ id, ...programmesSnap.val()[id] })) : []);
            setAllCourses(coursesSnap.exists() ? coursesSnap.val() : {});
            setAllCoursePaths(coursePathsSnap.exists() ? Object.keys(coursePathsSnap.val()).map(id => ({ id, ...coursePathsSnap.val()[id] })) : []);
            setActivePathSemesters(semesterOfferingsSnap.exists() ? semesterOfferingsSnap.val() : {});
            setAllPaymentPlans(paymentPlansSnap.exists() ? Object.keys(paymentPlansSnap.val()).map(id => ({ id, ...paymentPlansSnap.val()[id] })) : []);
            setSemesters(semestersSnap.exists() ? Object.keys(semestersSnap.val()).map(id => ({ id, ...semestersSnap.val()[id] })).sort((a,b) => b.name.localeCompare(a.name)) : []);
            setFeeTemplates(feeTemplatesSnap.exists() ? Object.keys(feeTemplatesSnap.val()).map(id => ({ id, ...feeTemplatesSnap.val()[id] })) : []);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Failed to refresh data' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        refreshData();
    }, [refreshData]);
    
    const handleSaveChanges = async () => {
        setSaving(true);
        try { 
            await set(ref(db, `semesterOfferings`), activePathSemesters);
            toast({ variant: 'success', title: 'Settings Saved', description: `Registration settings have been updated.` });
        } catch (error: any) { toast({ variant: 'destructive', title: 'Save Failed', description: error.message || 'An unexpected error occurred.' });
        } finally { setSaving(false); }
    };
    
    const handleToggleSemester = (pathId: string, semesterId: string) => {
      setActivePathSemesters(prev => {
        const newPaths = JSON.parse(JSON.stringify(prev)); // Deep copy
    
        if (!newPaths[pathId]) {
          newPaths[pathId] = {};
        }
        if (!newPaths[pathId][semesterId]) {
          newPaths[pathId][semesterId] = { active: false, showReason: false };
        }
    
        newPaths[pathId][semesterId].active = !newPaths[pathId][semesterId].active;
        return newPaths;
      });
    };
    
    const handleToggleReasonVisibility = (pathId: string, semesterId: string) => {
        setActivePathSemesters(prev => {
            const newPaths = JSON.parse(JSON.stringify(prev)); // Deep copy
            if (!newPaths[pathId] || !newPaths[pathId][semesterId]) return prev;
            newPaths[pathId][semesterId].showReason = !newPaths[pathId][semesterId].showReason;
            return newPaths;
        });
    }

    const openHistoryDialog = (historyItems: CoursePathHistoryItem[]) => {
        setViewingHistory(historyItems.sort((a, b) => b.timestamp - a.timestamp));
        setIsHistoryDialogOpen(true);
    };

    const handleOpenDeadlineDialog = async (semesterName: string) => {
        setEditingDeadlinesFor({ semesterName });
        const [eventsSnapshot, plansSnap, semestersSnap] = await Promise.all([
            get(ref(db, 'calendarEvents')),
            get(ref(db, 'settings/paymentPlans')),
            get(ref(db, 'semesters')),
        ]);
        const allPlans = plansSnap.exists() ? Object.values(plansSnap.val() as Record<string, PaymentPlan>) : [];
        const semesterData = Object.values(semestersSnap.val() as Record<string, Semester>).find(s => s.name === semesterName);
        const linkedPlanIds = Object.keys(semesterData?.paymentPlanIds || {});
        const linkedPlans = allPlans.filter(p => linkedPlanIds.includes(p.id));

        const eventMap = new Map<string, {date: string, id: string}>();
        if (eventsSnapshot.exists()) { 
            Object.entries(eventsSnapshot.val()).forEach(([id, event]:[string, any]) => {
                eventMap.set(event.title.trim(), { date: event.date, id });
            });
        }
        const requiredDeadlines: string[] = [];
        linkedPlans.forEach(plan => {
             for (let i = 0; i < plan.installments; i++) {
                requiredDeadlines.push(`${plan.name} (${getOrdinalSuffix(i + 1)} Installment) Deadline - ${semesterName}`);
            }
        })
        setSemesterDeadlines(requiredDeadlines.map(title => {
            const existing = eventMap.get(title.trim());
            return { title: title.replace(` - ${semesterName}`, ''), date: existing?.date || null, eventId: existing?.id || null };
        }));
    }
    
    const handleSaveDeadline = async (title: string, eventId: string | null) => {
        if(!editingDeadlinesFor) return;
        const date = deadlineDates[title];
        if (!date) { toast({ variant: 'destructive', title: 'Date required' }); return; }
        setSaving(true);
        const fullTitle = `${title} - ${editingDeadlinesFor.semesterName}`;
        try {
            if(eventId) {
                await update(ref(db, `calendarEvents/${eventId}`), { date: format(date, 'yyyy-MM-dd') });
            } else {
                const newEventRef = push(ref(db, 'calendarEvents'));
                await set(newEventRef, { title: fullTitle, date: format(date, 'yyyy-MM-dd'), semester: editingDeadlinesFor.semesterName });
            }
            toast({ title: "Deadline Updated" });
            setDeadlineDates(prev => ({...prev, [title]: undefined}));
            setEditingDeadlineId(null);
            handleOpenDeadlineDialog(editingDeadlinesFor.semesterName); // Re-fetch
        } catch (error: any) { 
            toast({ variant: 'destructive', title: 'Failed to save deadline' }); 
        } finally { 
            setSaving(false); 
        }
    }
    

    return (
        <div className="space-y-6">
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="font-headline text-2xl">Registration Management</CardTitle>
                <CardDescription>Activate which semesters are open for registration for each intake and programme path.</CardDescription>
            </CardHeader>
        </Card>
        
        <Card className="shadow-lg">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="text-xl">Course Registration Paths</CardTitle>
                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                        <DialogTrigger asChild><Button variant="outline"><PlusCircle className="mr-2 h-4"/> New Semester</Button></DialogTrigger>
                        <DialogContent className="sm:max-w-xl"><CreateOrEditDialogContent editingSemester={null} onClose={() => setIsCreateDialogOpen(false)} onSaveSuccess={() => { refreshData(); setIsCreateDialogOpen(false); }} allPaymentPlans={allPaymentPlans} feeTemplates={feeTemplates} /></DialogContent>
                    </Dialog>
                </div>
                <CardDescription>Toggle the switch for each semester you want to make available for student registration.</CardDescription>
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
                                            
                                            const sortedSemesters = Object.keys(path.semesters)
                                                .map(semId => semesters.find(s => s.id === semId))
                                                .filter((s): s is Semester => !!s)
                                                .sort((a,b) => a.year - b.year || a.semesterInYear - b.semesterInYear);


                                            return (
                                                <Card key={programme.id} className="my-2 bg-muted/50">
                                                    <CardHeader>
                                                        <CardTitle className="text-base">{programme.name}</CardTitle>
                                                    </CardHeader>
                                                    <CardContent className="space-y-4">
                                                        {sortedSemesters.map((semester) => {
                                                            const semData = path.semesters[semester.id];
                                                            const historyItems = semData.history ? Object.values(semData.history) : [];
                                                            return (
                                                            <div key={semester.id} className="p-4 border rounded-lg bg-card">
                                                                <div className="flex justify-between items-center mb-2">
                                                                    <Label htmlFor={`${path.id}-${semester.id}`} className="font-bold text-lg">{semester.name}</Label>
                                                                    <div className="flex items-center gap-2">
                                                                         <Button variant="outline" size="sm" onClick={() => { setEditingSemester(semester); setIsEditDialogOpen(true);}}>
                                                                            <Pencil className="h-4 w-4"/>
                                                                         </Button>
                                                                         {historyItems.length > 0 && (
                                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openHistoryDialog(historyItems)}>
                                                                                <History className="h-4 w-4 text-blue-600"/>
                                                                            </Button>
                                                                        )}
                                                                        <Switch 
                                                                            id={`${path.id}-${semester.id}`} 
                                                                            checked={!!activePathSemesters[path.id]?.[semester.id]?.active}
                                                                            onCheckedChange={() => handleToggleSemester(path.id, semester.id)}
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-4 mt-4">
                                                                    <div>
                                                                        <h4 className="font-semibold mb-1 text-sm">Courses</h4>
                                                                        <div className="text-sm text-muted-foreground space-y-1">
                                                                            {(semData.courses || []).map(courseId => {
                                                                                const course = allCourses[courseId];
                                                                                return course ? <p key={courseId}>{course.code} - {course.name}</p> : null;
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="font-semibold mb-1 text-sm">Fees</h4>
                                                                        <ul className="list-disc pl-5 text-sm text-muted-foreground">
                                                                            {semester.mandatoryFees && Object.values(semester.mandatoryFees).map((fee, i) => <li key={`mand-${i}`}>{fee.name}: ZMW {fee.amount.toFixed(2)}</li>)}
                                                                            {semester.optionalFees && Object.values(semester.optionalFees).map((fee, i) => <li key={`opt-${i}`}>{fee.name}: ZMW {fee.amount.toFixed(2)} (Optional)</li>)}
                                                                        </ul>
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
            <CardFooter className="flex justify-end items-center gap-4 border-t pt-6">
                <Button onClick={handleSaveChanges} disabled={saving || loading}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{saving ? 'Saving...' : 'Save Changes'}</Button>
            </CardFooter>
        </Card>
        <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Semester Change History</DialogTitle>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto pr-4 space-y-4">
                    {viewingHistory.map((item, index) => (
                        <div key={index} className="p-3 border rounded-lg">
                            <p className="font-semibold">{item.reason}</p>
                            <p className="text-sm text-muted-foreground">{new Date(item.timestamp).toLocaleString()}</p>
                            <div className="grid grid-cols-2 gap-4 mt-2 text-xs">
                                <div><p className="font-bold">Removed:</p><ul>{(item.oldCourses || []).filter(c => !(item.newCourses || []).includes(c)).map(id => <li key={id}>- {allCourses[id]?.name || 'Unknown Course'}</li>)}</ul></div>
                                <div><p className="font-bold">Added:</p><ul>{(item.newCourses || []).filter(c => !(item.oldCourses || []).includes(c)).map(id => <li key={id}>+ {allCourses[id]?.name || 'Unknown Course'}</li>)}</ul></div>
                            </div>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
        <Dialog open={!!editingDeadlinesFor} onOpenChange={() => setEditingDeadlinesFor(null)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Set Payment Deadlines for {editingDeadlinesFor?.semesterName}</DialogTitle>
                    <DialogDescription>Set the due dates for all payment plan installments available for this semester.</DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto pr-4 space-y-4 py-4">
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
                <DialogFooter>
                    <Button variant="outline" onClick={() => setEditingDeadlinesFor(null)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-xl">
                <CreateOrEditDialogContent editingSemester={editingSemester} onClose={() => setIsEditDialogOpen(false)} onSaveSuccess={() => { refreshData(); setIsEditDialogOpen(false); }} allPaymentPlans={allPaymentPlans} feeTemplates={feeTemplates} />
            </DialogContent>
        </Dialog>
        </div>
    );
}
