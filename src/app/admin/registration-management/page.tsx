
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, Route, History, Info, Download, Power, PowerOff, ShieldAlert, Pencil, PlusCircle, Calendar as CalendarIcon, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from 'lucide-react';

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
        
        // Reset fee form
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
        return (
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <Label>{isMandatory ? 'Mandatory Fees' : 'Optional Fees'}</Label>
                    <Dialog open={isFeeDialogOpen && isFeeMandatory === isMandatory} onOpenChange={(open) => {if(!open) setIsFeeDialogOpen(false)}}>
                        <DialogTrigger asChild>
                            <Button size="sm" type="button" variant="outline" onClick={() => { setIsFeeMandatory(isMandatory); setIsFeeDialogOpen(true); }}>
                                <PlusCircle className="h-4 w-4 mr-1"/>Add Fee
                            </Button>
                        </DialogTrigger>
                        <DialogContent onInteractOutside={(e) => e.stopPropagation()}>
                            <DialogHeader>
                                <DialogTitle>Add {isMandatory ? 'Mandatory' : 'Optional'} Fee</DialogTitle>
                            </DialogHeader>
                            <Tabs defaultValue="import" onValueChange={(val) => setIsImportingFee(val === 'import')}>
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="import">Import from Template</TabsTrigger>
                                    <TabsTrigger value="custom">Create New</TabsTrigger>
                                </TabsList>
                                <TabsContent value="import" className="pt-4 space-y-4">
                                     <div className="space-y-1"><Label>Fee Name</Label>
                                        <Select value={selectedFeeTemplate} onValueChange={(val) => {setSelectedFeeTemplate(val); setFeeAmount(String(feeTemplates.find(t => t.id === val)?.amount || ''));}}>
                                            <SelectTrigger><SelectValue placeholder="Select a fee template..."/></SelectTrigger>
                                            <SelectContent>{feeTemplates.filter(t => t.type === (isMandatory ? 'Mandatory' : 'Optional')).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1"><Label>Amount (ZMW)</Label><Input type="number" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} placeholder="e.g., 250" /></div>
                                </TabsContent>
                                <TabsContent value="custom" className="pt-4 space-y-4">
                                    <div className="space-y-1"><Label>Fee Name</Label><Input value={feeName} onChange={(e) => setFeeName(e.target.value)} placeholder="e.g., Lab Gown Fee"/></div>
                                    <div className="space-y-1"><Label>Amount (ZMW)</Label><Input type="number" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} placeholder="e.g., 300" /></div>
                                </TabsContent>
                            </Tabs>
                            <DialogFooter>
                                <Button variant="ghost" onClick={() => {setIsFeeDialogOpen(false);}}>Cancel</Button>
                                <Button onClick={handleAddFee}>Add Fee to Semester</Button>
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
    const [programmesWithCourses, setProgrammesWithCourses] = React.useState<Programme[]>([]);
    const [availableForSemester, setAvailableForSemester] = React.useState<string[]>([]);
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
    const [allCalendarEvents, setAllCalendarEvents] = React.useState<CalendarEvent[]>([]);
    const [registrationPolicy, setRegistrationPolicy] = React.useState({ lateRegistrationFee: 0 });

    const [semesterOfferings, setSemesterOfferings] = React.useState<Record<string, any>>({});


    const { toast } = useToast();
    
     React.useEffect(() => {
        const refsToWatch = [
            ref(db, 'semesters'),
            ref(db, 'settings/paymentPlans'),
            ref(db, 'settings/feeTemplates'),
            ref(db, 'semesterOfferings'),
            ref(db, 'settings/registrationPolicy'),
            ref(db, 'calendarEvents')
        ];
        
        const unsubs = refsToWatch.map((refPath, index) => onValue(refPath, (snapshot) => {
            const data = snapshot.val() || {};
            switch(index) {
                case 0:
                    const semesterList: Semester[] = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                    setSemesters(semesterList.sort((a,b) => b.name.localeCompare(a.name)));
                    if (!selectedSemester && semesterList.length > 0) {
                        setSelectedSemester(semesterList[0].id);
                    }
                    break;
                case 1:
                    setAllPaymentPlans(Object.keys(data).map(id => ({ id, ...data[id] })));
                    break;
                case 2:
                    setFeeTemplates(Object.keys(data).map(id => ({ id, ...data[id] })));
                    break;
                case 3:
                    setSemesterOfferings(data);
                    break;
                case 4:
                    setRegistrationPolicy(data.lateRegistrationFee > 0 ? data : { lateRegistrationFee: 0 });
                    break;
                case 5:
                    setAllCalendarEvents(Object.keys(data).map(id => ({ id, ...data[id] })));
                    break;
            }
        }));

        return () => unsubs.forEach(unsub => unsub());
    }, [selectedSemester]);


    const fetchDataForSemester = React.useCallback(async () => {
        const semesterData = semesters.find(s => s.id === selectedSemester);
        if (!semesterData) { setLoading(false); return; }
        setLoading(true);
        setSemesterDeadlines([]);
        try {
            const [coursesSnap, usersSnapshot, programmesSnap] = await Promise.all([
                get(ref(db, 'courses')),
                get(ref(db, 'users')),
                get(ref(db, 'programmes')),
            ]);

            const allCoursesData = coursesSnap.exists() ? coursesSnap.val() : {};
            const semesterOfferingData = semesterOfferings[selectedSemester];

            if (programmesSnap.exists() && coursesSnap.exists()) {
                const userMap = new Map<string, string>();
                if (usersSnapshot.exists()) { Object.entries(usersSnapshot.val()).forEach(([uid, userData]: [string, any]) => userMap.set(uid, userData.name)); }

                const programmeData: Programme[] = Object.entries(programmesSnap.val()).map(([id, prog]: [string, any]) => {
                    const progCourses: Course[] = (prog.courseIds ? Object.keys(prog.courseIds) : [])
                        .map((courseId: string) => {
                            const courseData = allCoursesData[courseId];
                            return courseData && courseData.status === 'active' ? { id: courseId, ...courseData, lecturerName: userMap.get(courseData.lecturerId) || 'N/A' } : null;
                        }).filter(Boolean) as Course[];

                    const coursesByYear = progCourses.reduce((acc, course) => {
                        const yearKey = `Year ${course.year}`;
                        if (!acc[yearKey]) acc[yearKey] = [];
                        acc[yearKey].push(course);
                        return acc;
                    }, {} as GroupedCourses);

                    return { id, name: prog.name, tuitionFee: prog.tuitionFee, coursesByYear: Object.fromEntries(Object.entries(coursesByYear).sort(([a],[b]) => parseInt(a.replace('Year ', '')) - parseInt(b.replace('Year ', '')))) };
                });
                setProgrammesWithCourses(programmeData);
            }

            setAvailableForSemester(semesterOfferingData?.courseIds || []);

        } catch (error) { console.error('Error fetching data:', error); toast({ variant: 'destructive', title: 'Failed to load data' });
        } finally { setLoading(false); }
    }, [selectedSemester, semesters, toast, semesterOfferings]);

    const fetchDeadlines = React.useCallback(async () => {
        const semesterData = semesters.find(s => s.id === selectedSemester);
        if (!semesterData) return;
        const linkedPlanIds = Object.keys(semesterData.paymentPlanIds || {});
        const linkedPlans = allPaymentPlans.filter(p => linkedPlanIds.includes(p.id));

        const requiredDeadlines: string[] = [];
        linkedPlans.forEach(plan => {
             for (let i = 0; i < plan.installments; i++) {
                requiredDeadlines.push(`${plan.name} (${getOrdinalSuffix(i + 1)} Installment) Deadline - ${semesterData.name}`);
            }
        })
        const eventMap = new Map<string, {date: string, id: string}>();
         allCalendarEvents.forEach(event => {
            eventMap.set(event.title.trim(), { date: event.date, id: event.id });
        });

        setSemesterDeadlines(requiredDeadlines.map(title => {
            const existing = eventMap.get(title.trim());
            return { title: title.replace(` - ${semesterData.name}`, ''), date: existing?.date || null, eventId: existing?.id || null };
        }));

    }, [selectedSemester, semesters, allPaymentPlans, allCalendarEvents]);

    React.useEffect(() => {
        if(selectedSemester){ 
            fetchDataForSemester();
            fetchDeadlines();
        } else { 
            setProgrammesWithCourses([]); 
            setAvailableForSemester([]); 
            setLoading(false); 
        }
    }, [selectedSemester, fetchDataForSemester, fetchDeadlines]);

    const handleToggleSemesterStatus = async (semester: Semester) => {
        const newIsOpen = !semesterOfferings[semester.id]?.isOpen;
        try {
            await update(ref(db, `semesterOfferings/${semester.id}`), { isOpen: newIsOpen });
            if (newIsOpen) {
                const studentIds = await getAllStudentAndStaffIds();
                const notificationPromises = studentIds.map(id => createNotification(id, `Registration for ${semester.name} is now open!`, '/student/registration'));
                await Promise.all(notificationPromises);
            }
            toast({ variant: 'success', title: `Registration ${newIsOpen ? 'Opened' : 'Closed'}` });
        } catch (e: any) { toast({ variant: 'destructive', title: 'Update Failed', description: e.message }); }
    };
    
    const handleToggleLateRegistration = async (semester: Semester) => {
        const newStatus = !(semesterOfferings[semester.id]?.lateRegistrationActive ?? false);
        try { await update(ref(db, `semesterOfferings/${semester.id}`), { lateRegistrationActive: newStatus });
             toast({ variant: 'success', title: `Late Registration ${newStatus ? 'Enabled' : 'Disabled'}` });
        } catch (e: any) { toast({ variant: 'destructive', title: 'Update Failed', description: e.message }); }
    };

    const handleSelectCourse = (courseId: string) => {
        setAvailableForSemester(prev => prev.includes(courseId) ? prev.filter(id => id !== courseId) : [...prev, courseId]);
    };

    const handleSaveChanges = async () => {
        if (!selectedSemester) return;
        setSaving(true);
        try { 
            const currentOfferings = semesterOfferings[selectedSemester] || {};
            await update(ref(db, `semesterOfferings/${selectedSemester}`), { ...currentOfferings, courseIds: availableForSemester });
            toast({ variant: 'success', title: 'Settings Saved', description: `Available courses for ${currentSemester?.name} have been updated.` });
        } catch (error: any) { toast({ variant: 'destructive', title: 'Save Failed', description: error.message || 'An unexpected error occurred.' });
        } finally { setSaving(false); }
    };
    
    const handleSaveDeadline = async (title: string, eventId: string | null) => {
        if (!currentSemester) return;
        const date = deadlineDates[title];
        if (!date) { toast({ variant: 'destructive', title: 'Date required' }); return; }
        setSaving(true);
        const fullTitle = `${title} - ${currentSemester.name}`;
        try {
            if(eventId) {
                const eventRef = ref(db, `calendarEvents/${eventId}`);
                await update(eventRef, { date: format(date, 'yyyy-MM-dd') });
                toast({ title: "Deadline Updated" });
            } else {
                const newEventRef = push(ref(db, 'calendarEvents'));
                await set(newEventRef, { title: fullTitle, date: format(date, 'yyyy-MM-dd'), semester: currentSemester.name });
                toast({ title: `${title} Added` });
            }
            setDeadlineDates(prev => ({...prev, [title]: undefined}));
            setEditingDeadlineId(null);
            fetchDataForSemester();
        } catch (error: any) { 
            toast({ variant: 'destructive', title: 'Failed to save deadline' }); 
        } finally { 
            setSaving(false); 
        }
    }
    
    const totalSelected = availableForSemester.length;
    const currentSemester = semesters.find(s => s.id === selectedSemester);
    const isSemesterOpen = !!semesterOfferings[selectedSemester]?.isOpen;
    const isLateRegActive = !!semesterOfferings[selectedSemester]?.lateRegistrationActive;
    
    const canSave = semesterDeadlines.every(d => d.date !== null);

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Registration Management</CardTitle>
                    <CardDescription>Create semesters, manage fees, and select which courses are available for student registration.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-end gap-2">
                        <div className="flex-grow">
                            <Label htmlFor="semester-select">Select Semester</Label>
                            <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                                <SelectTrigger id="semester-select">
                                    <SelectValue placeholder="Select a semester..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {semesters.map(s => (
                                        <SelectItem key={s.id} value={s.id}>
                                            <div className="flex items-center gap-2">
                                                <span className={cn("h-2 w-2 rounded-full", semesterOfferings[s.id]?.isOpen ? 'bg-green-500' : 'bg-red-500')}></span>
                                                {s.name} ({s.status})
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                         <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                            <DialogTrigger asChild><Button variant="outline"><PlusCircle className="mr-2 h-4 w-4"/> New Semester</Button></DialogTrigger>
                            <DialogContent className="sm:max-w-xl"><CreateOrEditDialogContent editingSemester={null} onClose={() => setIsCreateDialogOpen(false)} onSaveSuccess={() => {fetchDataForSemester(); setIsCreateDialogOpen(false);}} allPaymentPlans={allPaymentPlans} feeTemplates={feeTemplates} /></DialogContent>
                        </Dialog>
                    </div>
                     {currentSemester && (
                        <div className="space-y-4">
                            <div className='flex flex-wrap gap-2'>
                                <Button variant={isSemesterOpen ? 'destructive' : 'default'} onClick={() => handleToggleSemesterStatus(currentSemester)} disabled={!canSave && !isSemesterOpen} title={!canSave && !isSemesterOpen ? 'Set payment deadlines first' : ''}>
                                    {isSemesterOpen ? <PowerOff className="mr-2 h-4 w-4" /> : <Power className="mr-2 h-4 w-4" />}
                                    {isSemesterOpen ? 'Close Registration' : 'Open Registration'}
                                </Button>
                                {isSemesterOpen && (<Button variant={isLateRegActive ? 'destructive' : 'secondary'} onClick={() => handleToggleLateRegistration(currentSemester)}>
                                    <ShieldAlert className="mr-2 h-4 w-4" />
                                    {isLateRegActive ? 'Disable Late Registration' : 'Enable Late Registration'}
                                </Button>)}
                                <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                                    <DialogTrigger asChild><Button variant="outline" onClick={() => setEditingSemester(currentSemester)}><Pencil className="mr-2 h-4 w-4" /> Edit</Button></DialogTrigger>
                                    <DialogContent className="sm:max-w-xl"><CreateOrEditDialogContent editingSemester={editingSemester} onClose={() => setIsEditDialogOpen(false)} onSaveSuccess={() => {fetchDataForSemester(); setIsEditDialogOpen(false);}} allPaymentPlans={allPaymentPlans} feeTemplates={feeTemplates} /></DialogContent>
                                </Dialog>
                            </div>
                            {!loading && !canSave && !isSemesterOpen && (
                                <Alert variant="destructive" className="mt-4"><AlertCircle className="h-4 w-4" /><AlertTitle>Action Required: Missing Payment Deadlines</AlertTitle><AlertDescription>
                                    <p>You cannot open registration for <strong>{currentSemester.name}</strong> until all payment deadlines for its linked payment plans are set in the Academic Calendar. The following are missing:</p>
                                    <ul className="list-disc pl-5 mt-2 mb-3 text-xs">{semesterDeadlines.filter(d => d.date === null).map(d => <li key={d.title}>{d.title}</li>)}</ul>
                                    <Button asChild variant="link" className="p-0 h-auto"><Link href="/admin/calendar">Go to Calendar to add deadlines</Link></Button>
                                </AlertDescription></Alert>
                            )}
                        </div>
                     )}
                </CardContent>
            </Card>
        
            <Tabs defaultValue="courses" className="w-full">
                <TabsList>
                    <TabsTrigger value="courses">Available Courses</TabsTrigger>
                    <TabsTrigger value="finance">Financial Setup</TabsTrigger>
                </TabsList>
                <TabsContent value="courses">
                    <Card>
                        <CardHeader>
                            <CardTitle>Available Courses for {currentSemester?.name}</CardTitle>
                            <CardDescription>Select which courses should be available for registration in this semester.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (<div className="space-y-4 pt-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}</div>
                            ) : selectedSemester ? (programmesWithCourses.length > 0 ? (
                                <Accordion type="multiple" defaultValue={programmesWithCourses.map(p => p.id)} className="w-full">
                                    {programmesWithCourses.map(prog => {
                                        const isFlatFee = !!prog.tuitionFee && prog.tuitionFee > 0;
                                        return (
                                            <AccordionItem value={prog.id} key={prog.id}>
                                                <AccordionTrigger className="font-bold text-lg">{prog.name} {isFlatFee && <span className="ml-2 text-xs font-semibold text-primary-foreground bg-primary px-2 py-0.5 rounded-full">Flat Fee</span>}</AccordionTrigger>
                                                <AccordionContent>
                                                    {prog.coursesByYear && Object.keys(prog.coursesByYear).length > 0 ? (
                                                        <Accordion type="multiple" defaultValue={Object.keys(prog.coursesByYear)} className="w-full">
                                                            {Object.entries(prog.coursesByYear).map(([year, courses]) => (
                                                                <AccordionItem value={year} key={year}>
                                                                    <AccordionTrigger className="font-semibold text-base pl-4">{year} Courses</AccordionTrigger>
                                                                    <AccordionContent className="pl-8">
                                                                        <Table>
                                                                            <TableHeader>
                                                                                <TableRow>
                                                                                    <TableHead className="w-[50px]">Enable</TableHead>
                                                                                    <TableHead>Course Code</TableHead>
                                                                                    <TableHead>Course Name</TableHead>
                                                                                    <TableHead>Assigned Lecturer</TableHead>
                                                                                </TableRow>
                                                                            </TableHeader>
                                                                            <TableBody>
                                                                                {courses.map((course) => (
                                                                                    <TableRow key={course.id} data-state={availableForSemester.includes(course.id) ? "selected" : undefined}>
                                                                                        <TableCell>
                                                                                            <Checkbox id={`course-${course.id}`} checked={availableForSemester.includes(course.id)} onCheckedChange={() => handleSelectCourse(course.id)} disabled={isFlatFee}/>
                                                                                        </TableCell>
                                                                                        <TableCell className="font-medium">{course.code}</TableCell>
                                                                                        <TableCell>{course.name}</TableCell>
                                                                                        <TableCell>{course.lecturerName}</TableCell>
                                                                                    </TableRow>
                                                                                ))}
                                                                            </TableBody>
                                                                        </Table>
                                                                    </AccordionContent>
                                                                </AccordionItem>
                                                            ))}
                                                        </Accordion>
                                                    ) : (<p className="text-muted-foreground p-4">No courses assigned to this programme path for this semester.</p>)}
                                                </AccordionContent>
                                            </AccordionItem>
                                        )
                                    })}
                                </Accordion>
                            ) : (<div className="py-16 text-center text-muted-foreground"><BookOpen className="mx-auto h-12 w-12" /><h3 className="mt-4 text-lg font-semibold">No Programmes Found</h3><p className="mt-2 text-sm">No programmes are linked to this semester via a course path.</p></div>
                            )) : (<div className="py-16 text-center text-muted-foreground"><p>Please select a semester to view and manage available courses.</p></div>)}
                        </CardContent>
                        <CardFooter className="flex justify-end items-center gap-4 border-t pt-6">
                            <div className="text-sm text-muted-foreground"><span className="font-bold text-foreground">{totalSelected}</span> course(s) selected for registration</div>
                            <Button onClick={handleSaveChanges} disabled={saving || loading || (!canSave && !isSemesterOpen)}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{saving ? 'Saving...' : 'Save Changes'}</Button>
                        </CardFooter>
                    </Card>
                </TabsContent>
                 <TabsContent value="finance">
                    <Card>
                        <CardHeader>
                            <CardTitle>Financial Setup for {currentSemester?.name}</CardTitle>
                            <CardDescription>An overview of fees, payment plans, and deadlines for this semester.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                           <div>
                                <h4 className="font-semibold mb-2">Mandatory Fees</h4>
                                <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Amount (ZMW)</TableHead></TableRow></TableHeader>
                                <TableBody>{currentSemester?.mandatoryFees ? Object.values(currentSemester.mandatoryFees).map((fee, i) => (
                                    <TableRow key={`mand-${i}`}><TableCell>{fee.name}</TableCell><TableCell className="text-right">{fee.amount.toFixed(2)}</TableCell></TableRow>
                                )) : <TableRow><TableCell colSpan={2} className="h-24 text-center">No mandatory fees.</TableCell></TableRow>}
                                </TableBody></Table>
                           </div>
                           <div>
                                <h4 className="font-semibold mb-2">Optional Fees</h4>
                                <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Amount (ZMW)</TableHead></TableRow></TableHeader>
                                <TableBody>{currentSemester?.optionalFees ? Object.values(currentSemester.optionalFees).map((fee, i) => (
                                    <TableRow key={`opt-${i}`}><TableCell>{fee.name}</TableCell><TableCell className="text-right">{fee.amount.toFixed(2)}</TableCell></TableRow>
                                )) : <TableRow><TableCell colSpan={2} className="h-24 text-center">No optional fees.</TableCell></TableRow>}
                                </TableBody></Table>
                           </div>
                            <div>
                                <h4 className="font-semibold mb-2">Late Registration Fee</h4>
                                <p>ZMW {registrationPolicy.lateRegistrationFee.toFixed(2)}</p>
                            </div>
                           <div>
                                <h4 className="font-semibold mb-2">Available Payment Plans & Deadlines</h4>
                                {allPaymentPlans.filter(p => currentSemester?.paymentPlanIds?.[p.id]).length > 0 ? (
                                    <div className="space-y-4">
                                        {allPaymentPlans.filter(p => currentSemester?.paymentPlanIds?.[p.id]).map(plan => {
                                            const deadlines: {name: string, date: string | null}[] = [];
                                            for(let i = 0; i < plan.installments; i++){
                                                const title = `${plan.name} (${getOrdinalSuffix(i + 1)} Installment) Deadline - ${currentSemester?.name}`;
                                                const event = allCalendarEvents.find(e => e.title.trim() === title.trim());
                                                deadlines.push({name: `${getOrdinalSuffix(i + 1)} Installment`, date: event?.date || null});
                                            }
                                            return (
                                                <div key={plan.id} className="p-3 border rounded-md">
                                                    <p className="font-medium">{plan.name}</p>
                                                     <ul className="list-disc pl-5 mt-1 text-sm text-muted-foreground">
                                                        {deadlines.map(d => <li key={d.name}>{d.name} Deadline: <span className="font-semibold">{d.date ? format(parseISO(d.date), 'PPP') : 'Not Set'}</span></li>)}
                                                    </ul>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : <p className="text-sm text-muted-foreground">No payment plans are assigned to this semester.</p>}
                           </div>
                        </CardContent>
                         <CardFooter className="flex justify-end">
                            <Button variant="outline" asChild><Link href="/admin/calendar"><CalendarIcon className="mr-2 h-4 w-4" /> Manage in Calendar</Link></Button>
                        </CardFooter>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
