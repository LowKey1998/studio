
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, Route, History, Info, Download, Power, PowerOff, ShieldAlert, Pencil, PlusCircle, Calendar as CalendarIcon, Trash2, BookCopy, UserPlus, History as HistoryIcon, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth, createNotification, getAllStudentAndStaffIds } from '@/lib/firebase';
import { ref, get, set, onValue, update, push } from 'firebase/database';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

// --- TYPE DEFINITIONS ---
type Course = { id: string; name: string; code: string; };
type Intake = { id: string; name: string; };
type Programme = { id: string; name: string; };
type CoursePathHistoryItem = { reason: string; oldCourses: string[]; newCourses: string[]; timestamp: any; };
type CoursePathSemester = { courses: string[]; history?: Record<string, CoursePathHistoryItem>; };
type CoursePath = { id: string; intakeId: string; programmeId: string; semesters: Record<string, CoursePathSemester> };
type Fee = { id: string; name: string; amount: number; };
type FeeTemplate = { id: string; name: string; amount: number; type: 'Mandatory' | 'Optional'; };
type PaymentPlan = { id: string; name: string; installments: number; installmentPercentages: number[]; archived?: boolean; };
type Semester = { id: string; name: string; status: 'Open' | 'Closed' | 'Archived'; lateRegistrationActive?: boolean; startDate?: string; endDate?: string; paymentPlanIds?: Record<string, boolean>; mandatoryFees?: Record<string, Fee>; optionalFees?: Record<string, Fee>; };
type NewSemesterEntry = { year: number | ''; semesterInYear: number | '' };
type DeadlineInfo = { title: string; date: string | null; eventId: string | null; };

const getOrdinalSuffix = (i: number) => {
    if (i === 1) return '1st';
    if (i === 2) return '2nd';
    if (i === 3) return '3rd';
    return `${i}th`;
};

// --- DIALOG CONTENT COMPONENT ---
function CreateOrEditDialogContent({ editingSemester, onClose, onSaveSuccess, allPaymentPlans, feeTemplates }: { editingSemester: Semester | null; onClose: () => void; onSaveSuccess: () => void; allPaymentPlans: PaymentPlan[]; feeTemplates: FeeTemplate[]; }) {
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
            setSemesterDates({
                from: editingSemester.startDate ? parseISO(editingSemester.startDate) : undefined,
                to: editingSemester.endDate ? parseISO(editingSemester.endDate) : undefined
            });
            setSelectedPaymentPlans(editingSemester.paymentPlanIds || {});
            setMandatoryFees(editingSemester.mandatoryFees || {});
            setOptionalFees(editingSemester.optionalFees || {});
        }
    }, [editingSemester]);

    const handleImportFee = (isMandatory: boolean) => {
        if (!selectedFeeTemplate || !feeAmount) return;
        const template = feeTemplates.find(t => t.id === selectedFeeTemplate);
        if (!template) return;
        const feeId = push(ref(db)).key!;
        const target = isMandatory ? setMandatoryFees : setOptionalFees;
        target(prev => ({ ...prev, [feeId]: { name: template.name, amount: parseFloat(feeAmount) } }));
        if (isMandatory) setIsMandatoryFeeDialogOpen(false); else setIsOptionalFeeDialogOpen(false);
        setSelectedFeeTemplate(''); setFeeAmount('');
    };

    const handleSaveSemester = async () => {
        if (!semesterNameInput.trim() || !semesterDates?.from) { toast({ variant: 'destructive', title: 'Missing details' }); return; }
        setSaving(true);
        try {
            const data = {
                name: semesterNameInput.trim(),
                status: editingSemester?.status || 'Closed',
                lateRegistrationActive: editingSemester?.lateRegistrationActive || false,
                startDate: format(semesterDates.from, 'yyyy-MM-dd'),
                endDate: semesterDates.to ? format(semesterDates.to, 'yyyy-MM-dd') : format(semesterDates.from, 'yyyy-MM-dd'),
                paymentPlanIds: selectedPaymentPlans,
                mandatoryFees,
                optionalFees,
            };
            if (editingSemester) await update(ref(db, `semesters/${editingSemester.id}`), data);
            else await push(ref(db, 'semesters'), data);
            onSaveSuccess();
        } catch (error: any) { toast({ variant: 'destructive', title: 'Save Failed', description: error.message }); }
        finally { setSaving(false); }
    };

    return (
        <><DialogHeader><DialogTitle>{editingSemester ? 'Edit' : 'Create'} Semester</DialogTitle></DialogHeader>
        <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="details">Details & Plans</TabsTrigger><TabsTrigger value="fees">Fees</TabsTrigger></TabsList>
            <TabsContent value="details" className="space-y-4 py-4">
                <div className="space-y-1"><Label>Semester Name</Label><Input value={semesterNameInput} onChange={(e) => setSemesterNameInput(e.target.value)} /></div>
                <div className="space-y-1"><Label>Dates</Label>
                    <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{semesterDates?.from ? (semesterDates.to ? `${format(semesterDates.from, "PPP")} - ${format(semesterDates.to, "PPP")}` : format(semesterDates.from, "PPP")) : <span>Pick dates</span>}</Button></PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start"><Calendar mode="range" selected={semesterDates} onSelect={setSemesterDates} numberOfMonths={2} /></PopoverContent></Popover>
                </div>
                <div className="space-y-2"><Label>Payment Plans</Label>
                    <div className="space-y-2 rounded-md border p-4 max-h-40 overflow-y-auto">
                        {allPaymentPlans.filter(p => !p.archived).map(plan => (<div key={plan.id} className="flex items-center gap-2"><Checkbox id={`p-${plan.id}`} checked={!!selectedPaymentPlans[plan.id]} onCheckedChange={() => setSelectedPaymentPlans(prev => ({...prev, [plan.id]: !prev[plan.id]}))}/><Label htmlFor={`p-${plan.id}`}>{plan.name}</Label></div>))}
                    </div>
                </div>
            </TabsContent>
            <TabsContent value="fees" className="space-y-4 py-4">
                <div className="space-y-4">
                    <div className="flex justify-between items-center"><Label>Mandatory Fees</Label><Button size="sm" variant="outline" onClick={() => setIsMandatoryFeeDialogOpen(true)}>Add Mandatory</Button></div>
                    <div className="flex justify-between items-center"><Label>Optional Fees</Label><Button size="sm" variant="outline" onClick={() => setIsOptionalFeeDialogOpen(true)}>Add Optional</Button></div>
                </div>
            </TabsContent>
        </Tabs>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSaveSemester} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Save</Button></DialogFooter>
        <Dialog open={isMandatoryFeeDialogOpen} onOpenChange={setIsMandatoryFeeDialogOpen}><DialogContent><DialogHeader><DialogTitle>Add Fee</DialogTitle></DialogHeader><div className="space-y-4"><Select value={selectedFeeTemplate} onValueChange={v => {setSelectedFeeTemplate(v); setFeeAmount(String(feeTemplates.find(t=>t.id===v)?.amount || ''))}}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{feeTemplates.map(t=><SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select><Input type="number" value={feeAmount} onChange={e=>setFeeAmount(e.target.value)} /></div><DialogFooter><Button onClick={() => handleImportFee(true)}>Add</Button></DialogFooter></DialogContent></Dialog>
        </>
    );
}

export default function RegistrationManagementPage() {
    const [allIntakes, setAllIntakes] = React.useState<Intake[]>([]);
    const [allProgrammes, setAllProgrammes] = React.useState<Programme[]>([]);
    const [allCourses, setAllCourses] = React.useState<Record<string, Course>>({});
    const [allCoursePaths, setAllCoursePaths] = React.useState<CoursePath[]>([]);
    const [activePathSemesters, setActivePathSemesters] = React.useState<Record<string, Record<string, { active: boolean; showReason: boolean; }>>>({});
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [allPaymentPlans, setAllPaymentPlans] = React.useState<PaymentPlan[]>([]);
    const [feeTemplates, setFeeTemplates] = React.useState<FeeTemplate[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    // Deadline Dialog State
    const [editingDeadlinesFor, setEditingDeadlinesFor] = React.useState<Semester | null>(null);
    const [selectedPlansInDialog, setSelectedPlansInDialog] = React.useState<Record<string, boolean>>({});
    const [eventMap, setEventMap] = React.useState<Map<string, { date: string, id: string }>>(new Map());
    const [deadlineDates, setDeadlineDates] = React.useState<Record<string, Date | undefined>>({});

    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
    const [editingSemester, setEditingSemester] = React.useState<Semester | null>(null);
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = React.useState(false);
    const [viewingHistory, setViewingHistory] = React.useState<CoursePathHistoryItem[]>([]);

    const { toast } = useToast();
    
    React.useEffect(() => {
        const refs = [
            ref(db, 'intakes'), ref(db, 'programmes'), ref(db, 'courses'), ref(db, 'coursePaths'),
            ref(db, 'semesterOfferings'), ref(db, 'settings/paymentPlans'), ref(db, 'semesters'), ref(db, 'settings/feeTemplates'),
        ];
        const unsubs = refs.map((r, i) => onValue(r, (snapshot) => {
            const data = snapshot.val() || {};
            switch(i) {
                case 0: setAllIntakes(Object.keys(data).map(id => ({ id, ...data[id] })).sort((a,b) => b.name.localeCompare(a.name))); break;
                case 1: setAllProgrammes(Object.keys(data).map(id => ({ id, ...data[id] }))); break;
                case 2: setAllCourses(data); break;
                case 3: setAllCoursePaths(Object.values(data)); break;
                case 4: setActivePathSemesters(data); break;
                case 5: setAllPaymentPlans(Object.keys(data).map(id => ({ id, ...data[id] }))); break;
                case 6: setSemesters(Object.keys(data).map(id => ({ id, ...data[id] })).sort((a,b) => b.name.localeCompare(a.name))); break;
                case 7: setFeeTemplates(Object.keys(data).map(id => ({ id, ...data[id] }))); break;
            }
            if(i === 7) setLoading(false);
        }));
        return () => unsubs.forEach(unsub => unsub());
    }, []);

    const handleSaveChanges = async () => {
        setSaving(true);
        try { 
            await set(ref(db, `semesterOfferings`), activePathSemesters);
            toast({ title: 'Registration paths updated.' });
        } catch (error: any) { toast({ variant: 'destructive', title: 'Save Failed' }); }
        finally { setSaving(false); }
    };
    
    const handleToggleSemester = (pathId: string, semesterId: string) => {
      setActivePathSemesters(prev => {
        const next = JSON.parse(JSON.stringify(prev));
        if (!next[pathId]) next[pathId] = {};
        if (!next[pathId][semesterId]) next[pathId][semesterId] = { active: false, showReason: false };
        next[pathId][semesterId].active = !next[pathId][semesterId].active;
        return next;
      });
    };

    const handleDeleteSemester = async (semesterId: string) => {
        if (!window.confirm("Are you sure? This will remove the semester and its course mappings.")) return;
        try {
            const updates: Record<string, any> = {};
            updates[`/semesters/${semesterId}`] = null;
            allCoursePaths.forEach(path => { if (path.semesters && path.semesters[semesterId]) updates[`/coursePaths/${path.id}/semesters/${semesterId}`] = null; });
            const nextOfferings = { ...activePathSemesters };
            Object.keys(nextOfferings).forEach(pId => { if (nextOfferings[pId]?.[semesterId]) delete nextOfferings[pId][semesterId]; });
            updates[`/semesterOfferings`] = nextOfferings;
            await update(ref(db), updates);
            toast({ title: "Semester Deleted" });
        } catch (e: any) { toast({ variant: 'destructive', title: "Delete Failed" }); }
    };

    const handleOpenDeadlineDialog = async (semester: Semester) => {
        setEditingDeadlinesFor(semester);
        setSelectedPlansInDialog(semester.paymentPlanIds || {});
        setDeadlineDates({});
        
        const eventsSnapshot = await get(ref(db, 'calendarEvents'));
        const newEventMap = new Map<string, { date: string, id: string }>();
        if (eventsSnapshot.exists()) {
            Object.entries(eventsSnapshot.val()).forEach(([id, event]: [string, any]) => {
                newEventMap.set(event.title.trim(), { date: event.date, id });
            });
        }
        setEventMap(newEventMap);
    };

    const handleSaveAllDeadlines = async () => {
        if (!editingDeadlinesFor) return;
        setSaving(true);
        try {
            const semesterId = editingDeadlinesFor.id;
            const semesterName = editingDeadlinesFor.name;
            
            // 1. Update Payment Plan IDs for the semester
            await update(ref(db, `semesters/${semesterId}`), {
                paymentPlanIds: selectedPlansInDialog
            });

            // 2. Update Calendar Events
            const updates: Record<string, any> = {};
            for (const plan of allPaymentPlans) {
                if (selectedPlansInDialog[plan.id]) {
                    for (let i = 0; i < plan.installments; i++) {
                        const fullTitle = `${plan.name} (${getOrdinalSuffix(i + 1)} Installment) Deadline - ${semesterName}`;
                        const date = deadlineDates[fullTitle];
                        const existingEvent = eventMap.get(fullTitle);
                        
                        if (date) {
                            if (existingEvent) {
                                updates[`calendarEvents/${existingEvent.id}/date`] = format(date, 'yyyy-MM-dd');
                            } else {
                                const newEventRef = push(ref(db, 'calendarEvents'));
                                updates[`calendarEvents/${newEventRef.key}`] = {
                                    title: fullTitle,
                                    date: format(date, 'yyyy-MM-dd'),
                                    semester: semesterName
                                };
                            }
                        }
                    }
                } else {
                    // Plan removed, cleanup events
                    for (let i = 0; i < plan.installments; i++) {
                        const fullTitle = `${plan.name} (${getOrdinalSuffix(i + 1)} Installment) Deadline - ${semesterName}`;
                        const existingEvent = eventMap.get(fullTitle);
                        if (existingEvent) {
                            updates[`calendarEvents/${existingEvent.id}`] = null;
                        }
                    }
                }
            }

            await update(ref(db), updates);
            toast({ title: 'Plans & Deadlines Updated' });
            setEditingDeadlinesFor(null);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: e.message });
        } finally {
            setSaving(false);
        }
    };

    const openHistoryDialog = (historyItems: CoursePathHistoryItem[]) => {
        setViewingHistory(historyItems.sort((a, b) => b.timestamp - a.timestamp));
        setIsHistoryDialogOpen(true);
    };

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div><CardTitle className="font-headline text-2xl">Registration Management</CardTitle><CardDescription>Configure semesters and active registration paths.</CardDescription></div>
                    <Button onClick={() => setIsCreateDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4"/> New Semester</Button>
                </CardHeader>
                <CardContent>
                    {loading ? <Skeleton className="h-48 w-full" /> : 
                    <Accordion type="multiple" defaultValue={allIntakes.map(i => i.id)} className="w-full">
                        {allIntakes.map(intake => (
                            <AccordionItem value={intake.id} key={intake.id}>
                                <AccordionTrigger className="font-bold text-xl">{intake.name}</AccordionTrigger>
                                <AccordionContent className="space-y-4">
                                    {allProgrammes.map(programme => {
                                        const path = allCoursePaths.find(p => p.intakeId === intake.id && p.programmeId === programme.id);
                                        if (!path || !path.semesters) return null;
                                        
                                        const sortedSemesters = Object.entries(path.semesters)
                                            .map(([semId, semData]) => {
                                                const semesterDetails = semesters.find(s => s.id === semId);
                                                return { semId, semData, semesterDetails };
                                            })
                                            .filter(item => item.semesterDetails)
                                            .sort((a, b) => {
                                                if (a.semesterDetails!.year !== b.semesterDetails!.year) return a.semesterDetails!.year - b.semesterDetails!.year;
                                                return a.semesterDetails!.semesterInYear - b.semesterDetails!.semesterInYear;
                                            });

                                        return (
                                            <Card key={programme.id} className="bg-muted/50 mb-4">
                                                <CardHeader><CardTitle className="text-base">{programme.name}</CardTitle></CardHeader>
                                                <CardContent className="space-y-4">
                                                    {sortedSemesters.map(({ semId, semData, semesterDetails }) => {
                                                        const semDetails = semesterDetails!;
                                                        const isActive = !!activePathSemesters[path.id]?.[semId]?.active;
                                                        const historyItems = semData.history ? Object.values(semData.history) : [];
                                                        
                                                        return (
                                                            <div key={semId} className="p-4 border rounded-lg bg-card flex flex-col gap-4">
                                                                <div className="flex justify-between items-center">
                                                                    <Label className="font-bold">{semDetails.name}</Label>
                                                                    <div className="flex items-center gap-4">
                                                                        <span className={cn("text-[10px] font-bold uppercase", isActive ? "text-green-600" : "text-muted-foreground")}>{isActive ? "Active" : "Inactive"}</span>
                                                                        <Switch checked={isActive} onCheckedChange={() => handleToggleSemester(path.id, semId)} />
                                                                        {historyItems.length > 0 && (
                                                                            <Button variant="ghost" size="icon" onClick={() => openHistoryDialog(historyItems)}><HistoryIcon className="h-4 w-4 text-blue-600"/></Button>
                                                                        )}
                                                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteSemester(semId)}><Trash2 className="h-4 w-4"/></Button>
                                                                    </div>
                                                                </div>
                                                                <div className="text-sm text-muted-foreground">{(semData.courses || []).map(cid => allCourses[cid]?.code).join(', ')}</div>
                                                                <div className="flex gap-2 pt-2 border-t">
                                                                    <Button variant="outline" size="sm" onClick={() => handleOpenDeadlineDialog(semDetails)}><CalendarIcon className="mr-2 h-4 w-4"/>Set Deadlines</Button>
                                                                    <Button variant="outline" size="sm" asChild><Link href={`/admin/course-paths?intakeId=${intake.id}&programmeId=${programme.id}`}><BookCopy className="mr-2 h-4"/>Edit Path</Link></Button>
                                                                    <Button variant="outline" size="sm" asChild><Link href={`/admin/academics/lecturer-allocation?semesterId=${semId}`}><UserPlus className="mr-2 h-4"/>Lecturers</Link></Button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>}
                </CardContent>
                <CardFooter className="justify-end"><Button onClick={handleSaveChanges} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Save All Changes</Button></CardFooter>
            </Card>

            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}><DialogContent className="sm:max-w-xl"><CreateOrEditDialogContent editingSemester={null} onClose={() => setIsCreateDialogOpen(false)} onSaveSuccess={() => setIsCreateDialogOpen(false)} allPaymentPlans={allPaymentPlans} feeTemplates={feeTemplates} /></DialogContent></Dialog>
            
            <Dialog open={!!editingDeadlinesFor} onOpenChange={() => setEditingDeadlinesFor(null)}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Set Payment Deadlines for {editingDeadlinesFor?.name}</DialogTitle>
                        <DialogDescription>Select the payment plans available for this semester and set their installment due dates.</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto pr-4 py-4 space-y-6">
                        <div className="space-y-3">
                            <Label className="text-base font-bold">1. Select Available Payment Plans</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 border rounded-lg bg-muted/20">
                                {allPaymentPlans.filter(p => !p.archived).map(plan => (
                                    <div key={plan.id} className="flex items-center space-x-2">
                                        <Checkbox 
                                            id={`dlg-p-${plan.id}`} 
                                            checked={!!selectedPlansInDialog[plan.id]} 
                                            onCheckedChange={() => setSelectedPlansInDialog(prev => ({...prev, [plan.id]: !prev[plan.id]}))}
                                        />
                                        <Label htmlFor={`dlg-p-${plan.id}`} className="font-normal cursor-pointer">{plan.name}</Label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Label className="text-base font-bold">2. Set Due Dates</Label>
                            {allPaymentPlans.filter(p => selectedPlansInDialog[p.id]).length > 0 ? (
                                allPaymentPlans.filter(p => selectedPlansInDialog[p.id]).map(plan => (
                                    <div key={plan.id} className="space-y-3 p-4 border rounded-lg">
                                        <h4 className="font-bold text-primary">{plan.name}</h4>
                                        <div className="grid gap-4">
                                            {Array.from({ length: plan.installments }).map((_, i) => {
                                                const fullTitle = `${plan.name} (${getOrdinalSuffix(i + 1)} Installment) Deadline - ${editingDeadlinesFor?.name}`;
                                                const currentVal = deadlineDates[fullTitle] || (eventMap.get(fullTitle)?.date ? parseISO(eventMap.get(fullTitle)!.date) : undefined);
                                                
                                                return (
                                                    <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                        <span className="text-sm font-medium">{getOrdinalSuffix(i+1)} Installment</span>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button variant="outline" className={cn("w-full sm:w-[240px] justify-start text-left font-normal", !currentVal && "text-muted-foreground")}>
                                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                                    {currentVal ? format(currentVal, 'PPP') : <span>Pick a date</span>}
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-0" align="end">
                                                                <Calendar mode="single" selected={currentVal} onSelect={(d) => setDeadlineDates(prev => ({...prev, [fullTitle]: d}))} initialFocus />
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground italic">Select at least one payment plan above to set deadlines.</p>
                            )}
                        </div>
                    </div>
                    <DialogFooter className="border-t pt-4">
                        <Button variant="outline" onClick={() => setEditingDeadlinesFor(null)}>Cancel</Button>
                        <Button onClick={handleSaveAllDeadlines} disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Save All Settings
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>Semester Change History</DialogTitle></DialogHeader>
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
        </div>
    );
}

    