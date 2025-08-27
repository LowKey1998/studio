
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
        const isDialogOpen = isMandatory ? isMandatoryFeeDialogOpen : isOptionalFeeDialogOpen;
        const setIsDialogOpen = isMandatory ? setIsMandatoryFeeDialogOpen : setIsOptionalFeeDialogOpen;

        return (
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <Label>{isMandatory ? 'Mandatory Fees' : 'Optional Fees'}</Label>
                    <Dialog open={isDialogOpen} onOpenChange={(open) => setIsDialogOpen(open)}>
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
                            <DialogFooter><Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button><Button onClick={handleAddFee}>Add Fee to Semester</Button></DialogFooter>
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
    
    const [activePathSemesters, setActivePathSemesters] = React.useState<Record<string, Record<string, { active: boolean; showReason: boolean; }>>>({});
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = React.useState(false);
    const [viewingHistory, setViewingHistory] = React.useState<CoursePathHistoryItem[]>([]);
    
    const [allPaymentPlans, setAllPaymentPlans] = React.useState<PaymentPlan[]>([]);
    const [feeTemplates, setFeeTemplates] = React.useState<FeeTemplate[]>([]);
    const [semesters, setSemesters] = React.useState<Semester[]>([]);

    
    const [editingDeadlinesFor, setEditingDeadlinesFor] = React.useState<{ semesterName: string; } | null>(null);
    const [semesterDeadlines, setSemesterDeadlines] = React.useState<DeadlineInfo[]>([]);
    const [deadlineDates, setDeadlineDates] = React.useState<Record<string, Date | undefined>>({});
    const [editingDeadlineId, setEditingDeadlineId] = React.useState<string | null>(null);

    // Create Semester Dialog
    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
    const [editingSemester, setEditingSemester] = React.useState<Semester | null>(null);

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
            setActivePathSemesters(offeringsSnap.exists() ? offeringsSnap.val() : {});
        } catch (e) { console.error(e) } 
        finally { setLoading(false); }
    }, []);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);
    

    const handleSaveChanges = async () => {
        setSaving(true);
        try { 
            await set(ref(db, `semesterOfferings`), activePathSemesters);
            toast({ variant: 'success', title: 'Settings Saved', description: `Registration settings have been updated.` });
        } catch (error: any) { toast({ variant: 'destructive', title: 'Save Failed', description: error.message || 'An unexpected error occurred.' });
        } finally { setSaving(false); }
    };
    
    const handleToggleSemester = (pathId: string, semesterNumber: string) => {
      setActivePathSemesters(prev => {
        const newPaths = JSON.parse(JSON.stringify(prev)); // Deep copy
    
        if (!newPaths[pathId]) {
          newPaths[pathId] = {};
        }
        if (!newPaths[pathId][semesterNumber]) {
          newPaths[pathId][semesterNumber] = { active: false, showReason: false };
        }
    
        newPaths[pathId][semesterNumber].active = !newPaths[pathId][semesterNumber].active;
        return newPaths;
      });
    };
    
    const handleToggleReasonVisibility = (pathId: string, semesterNumber: string) => {
        setActivePathSemesters(prev => {
            const newPaths = JSON.parse(JSON.stringify(prev)); // Deep copy
            if (!newPaths[pathId] || !newPaths[pathId][semesterNumber]) return prev;
            newPaths[pathId][semesterNumber].showReason = !newPaths[pathId][semesterNumber].showReason;
            return newPaths;
        });
    }

    const openHistoryDialog = (historyItems: CoursePathHistoryItem[]) => {
        setViewingHistory(historyItems.sort((a, b) => b.timestamp - a.timestamp));
        setIsHistoryDialogOpen(true);
    };

    const handleOpenDeadlineDialog = async (semesterName: string) => {
        setEditingDeadlinesFor({ semesterName });
        const [eventsSnapshot, plansSnap] = await Promise.all([
            get(ref(db, 'calendarEvents')),
            get(ref(db, 'settings/paymentPlans'))
        ]);
        const allPlans = plansSnap.exists() ? Object.values(plansSnap.val() as Record<string, PaymentPlan>) : [];

        const eventMap = new Map<string, {date: string, id: string}>();
        if (eventsSnapshot.exists()) { 
            Object.entries(eventsSnapshot.val()).forEach(([id, event]:[string, any]) => {
                eventMap.set(event.title.trim(), { date: event.date, id });
            });
        }
        const requiredDeadlines: string[] = [];
        allPlans.forEach(plan => {
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
    
    const openEditDialog = (semester: Semester) => {
        setEditingSemester(semester);
        setIsEditDialogOpen(true);
    };

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
                <CardTitle className="text-xl">Course Registration Paths</CardTitle>
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
                                            
                                            const sortedSemesters = Object.entries(path.semesters).sort(([a], [b]) => Number(a) - Number(b));

                                            return (
                                                <Card key={programme.id} className="my-2 bg-muted/50">
                                                    <CardHeader>
                                                        <CardTitle className="text-base">{programme.name}</CardTitle>
                                                    </CardHeader>
                                                    <CardContent className="space-y-4">
                                                        {sortedSemesters.map(([semNum, semData]) => {
                                                            const year = Math.floor((Number(semNum) - 1) / 2) + 1;
                                                            const semesterInYear = (Number(semNum) - 1) % 2 + 1;
                                                            const semesterName = `${intake.name} Year ${year} Semester ${semesterInYear}`;
                                                            const label = `Year ${year}, Semester ${semesterInYear}`;
                                                            const historyItems = semData.history ? Object.values(semData.history) : [];

                                                            return (
                                                            <div key={semNum} className="p-4 border rounded-lg bg-card">
                                                                <div className="flex justify-between items-center mb-2">
                                                                    <Label htmlFor={`${path.id}-${semNum}`} className="font-bold text-lg">{label}</Label>
                                                                    <div className="flex items-center gap-2">
                                                                         <Button variant="outline" size="sm" onClick={() => handleOpenDeadlineDialog(semesterName)}>Set Deadlines</Button>
                                                                         {historyItems.length > 0 && (
                                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openHistoryDialog(historyItems)}>
                                                                                <History className="h-4 w-4 text-blue-600"/>
                                                                            </Button>
                                                                        )}
                                                                        <Switch 
                                                                            id={`${path.id}-${semNum}`} 
                                                                            checked={!!activePathSemesters[path.id]?.[semNum]?.active}
                                                                            onCheckedChange={() => handleToggleSemester(path.id, semNum)}
                                                                        />
                                                                    </div>
                                                                </div>
                                                                {historyItems.length > 0 && (
                                                                     <div className="flex items-center space-x-2 my-2">
                                                                         <Switch id={`show-reason-${path.id}-${semNum}`} checked={!!activePathSemesters[path.id]?.[semNum]?.showReason} onCheckedChange={() => handleToggleReasonVisibility(path.id, semNum)}/>
                                                                         <Label htmlFor={`show-reason-${path.id}-${semNum}`} className="text-xs">Show change reason to students</Label>
                                                                     </div>
                                                                )}
                                                                 <div className="text-sm text-muted-foreground space-y-1">
                                                                    {(semData.courses || []).map(courseId => {
                                                                        const course = allCourses[courseId];
                                                                        return course ? <p key={courseId}>{course.code} - {course.name}</p> : null;
                                                                    })}
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
                 <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild><Button variant="outline"><PlusCircle className="mr-2 h-4 w-4"/> New Semester</Button></DialogTrigger>
                    <DialogContent className="sm:max-w-xl"><CreateOrEditDialogContent editingSemester={null} onClose={() => setIsCreateDialogOpen(false)} onSaveSuccess={() => {refreshData(); setIsCreateDialogOpen(false);}} allPaymentPlans={allPaymentPlans} feeTemplates={feeTemplates} intakes={allIntakes} /></DialogContent>
                </Dialog>
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
        </div>
    );
}
