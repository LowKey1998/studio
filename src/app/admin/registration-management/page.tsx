"use client";
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { db, createNotification, getRegistrarIds } from '@/lib/firebase';
import { ref, get, set, push, onValue, remove, update, serverTimestamp } from 'firebase/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
    Info, 
    MapPin, 
    UserCheck, 
    Users, 
    CalendarDays, 
    Layers, 
    ChevronLeft, 
    ChevronRight, 
    Video, 
    Loader2, 
    Clock, 
    RotateCcw, 
    X, 
    Pencil, 
    PlusCircle, 
    Bot, 
    ChevronsUpDown, 
    Monitor, 
    Search, 
    AlertCircle, 
    GraduationCap,
    Calendar as CalendarIcon,
    AlertTriangle,
    DollarSign,
    Percent,
    CheckCircle2,
    History,
    Trash2,
    BookCopy
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { format, parseISO, startOfDay, isAfter, addDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose,
} from '@/components/ui/dialog';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { generateFullTimetable } from '@/ai/flows/generate-timetable';

// --- CONSTANTS ---
const calendarDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// --- TYPE DEFINITIONS ---
type TimeSlot = {
    id: string;
    startTime: string;
    endTime: string;
};

type Course = { id: string; name: string; code: string; lecturerIds?: string[]; lecturerId?: string; };
type Intake = { id: string; name: string; };
type Programme = { id: string; name: string; };
type CoursePathHistoryItem = { reason: string; oldCourses: string[]; newCourses: string[]; timestamp: any; };
type CoursePathSemester = { courses: string[]; history?: Record<string, CoursePathHistoryItem>; };
type CoursePath = { id: string; intakeId: string; programmeId: string; semesters: Record<string, CoursePathSemester> }; 
type Fee = { id: string; name: string; amount: number; };
type FeeTemplate = { id: string; name: string; amount: number; type: 'Mandatory' | 'Optional'; };
type PaymentPlan = { id: string; name: string; installments: number; installmentPercentages: number[]; archived?: boolean; };
type Semester = { id: string; name: string; intakeId: string; year: number; semesterInYear: number; status: 'Open' | 'Closed' | 'Archived'; lateRegistrationActive?: boolean; lateRegistrationFee?: number; startDate?: string; endDate?: string; paymentPlanIds?: Record<string, boolean>; mandatoryFees?: Record<string, Fee>; optionalFees?: Record<string, Fee>; paymentThreshold?: number; gracePeriodDays?: number; };

const getOrdinalSuffix = (i: number) => {
    if (i === 1) return '1st';
    if (i === 2) return '2nd';
    if (i === 3) return '3rd';
    return `${i}th`;
};

const timeToMinutes = (time: string) => {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
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
    const [intakeId, setIntakeId] = React.useState('');
    const [year, setYear] = React.useState('');
    const [semesterInYear, setSemesterInYear] = React.useState('');
    const [customName, setCustomName] = React.useState('');
    const [useCustomName, setUseCustomName] = React.useState(false);
    
    const [semesterDates, setSemesterDates] = React.useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
    const [selectedPaymentPlans, setSelectedPaymentPlans] = React.useState<Record<string, boolean>>({});
    const [mandatoryFees, setMandatoryFees] = React.useState<Record<string, Omit<Fee, 'id'>>>({});
    const [optionalFees, setOptionalFees] = React.useState<Record<string, Omit<Fee, 'id'>>>({});
    
    const [paymentThreshold, setPaymentThreshold] = React.useState(75);
    const [gracePeriodDays, setGracePeriodDays] = React.useState(7);
    const [lateRegistrationActive, setLateRegistrationActive] = React.useState(false);
    const [lateRegistrationFee, setLateRegistrationFee] = React.useState(0);
    
    const [isMandatoryFeeDialogOpen, setIsMandatoryFeeDialogOpen] = React.useState(false);
    const [isOptionalFeeDialogOpen, setIsOptionalFeeDialogOpen] = React.useState(false);

    const [selectedFeeTemplate, setSelectedFeeTemplate] = React.useState('');
    const [feeAmount, setFeeAmount] = React.useState('');

    const { toast } = useToast();
    
    React.useEffect(() => {
        if (editingSemester) {
            setIntakeId(editingSemester.intakeId || '');
            setYear(String(editingSemester.year || ''));
            setSemesterInYear(String(editingSemester.semesterInYear || ''));
            setCustomName(editingSemester.name || '');
            setUseCustomName(true); 
            
            setSemesterDates({
                from: editingSemester.startDate ? parseISO(editingSemester.startDate) : undefined,
                to: editingSemester.endDate ? parseISO(editingSemester.endDate) : undefined
            });
            setSelectedPaymentPlans(editingSemester.paymentPlanIds || {});
            setMandatoryFees(editingSemester.mandatoryFees || {});
            setOptionalFees(editingSemester.optionalFees || {});
            setPaymentThreshold(editingSemester.paymentThreshold ?? 75);
            setGracePeriodDays(editingSemester.gracePeriodDays ?? 7);
            setLateRegistrationActive(editingSemester.lateRegistrationActive ?? false);
            setLateRegistrationFee(editingSemester.lateRegistrationFee ?? 0);
        } else {
            resetForm();
        }
    }, [editingSemester]);

    const resetForm = () => {
        setIntakeId(''); setYear('1'); setSemesterInYear('1'); setCustomName(''); setUseCustomName(false);
        setSemesterDates({ from: undefined, to: undefined }); setSelectedPaymentPlans({}); setMandatoryFees({}); setOptionalFees({});
        setPaymentThreshold(75); setGracePeriodDays(7); setLateRegistrationActive(false); setLateRegistrationFee(0);
    };

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
        const feeId = push(ref(db, 'temp')).key!;
        
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

    const generatedName = React.useMemo(() => {
        const intake = allIntakes.find(i => i.id === intakeId);
        if (!intake || !year || !semesterInYear) return '';
        return `${intake.name} Year ${year} Semester ${semesterInYear}`;
    }, [intakeId, year, semesterInYear, allIntakes]);

    const handleSaveSemester = async () => {
        const finalName = useCustomName ? customName : generatedName;
        if (!finalName.trim() || !semesterDates?.from || !intakeId) { 
            toast({ variant: 'destructive', title: 'Missing Semester Details', description: 'Intake, Name, and Dates are required.' }); 
            return; 
        }
        setSaving(true);
        try {
            const semesterData: Omit<Semester, 'id'> = {
                name: finalName.trim(),
                status: editingSemester?.status || 'Closed',
                lateRegistrationActive,
                lateRegistrationFee: Number(lateRegistrationFee),
                startDate: format(semesterDates.from, 'yyyy-MM-dd'),
                endDate: semesterDates.to ? format(semesterDates.to, 'yyyy-MM-dd') : format(semesterDates.from, 'yyyy-MM-dd'),
                paymentPlanIds: selectedPaymentPlans,
                mandatoryFees,
                optionalFees,
                paymentThreshold,
                gracePeriodDays,
                intakeId,
                year: Number(year),
                semesterInYear: Number(semesterInYear)
            };

            if (editingSemester) {
                await update(ref(db, `semesters/${editingSemester.id}`), semesterData);
                toast({ title: 'Semester Updated' });
            } else {
                await set(push(ref(db, 'semesters')), semesterData);
                toast({ title: 'Semester Created' });
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
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <Label className="text-base font-bold">{isMandatory ? 'Mandatory' : 'Optional'} Charges</Label>
                    <Dialog open={dialogOpenState} onOpenChange={setDialogOpenState}>
                        <DialogTrigger asChild>
                            <Button size="sm" variant="outline"><PlusCircle className="h-4 w-4 mr-1"/>Import from Template</Button>
                        </DialogTrigger>
                        <DialogContent onInteractOutside={(e) => e.stopPropagation()}>
                            <DialogHeader>
                                <DialogTitle>Import Fee Template</DialogTitle>
                                <DialogDescription>Choose a pre-defined fee to add to this semester.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-1"><Label>Fee Name</Label>
                                    <Select value={selectedFeeTemplate} onValueChange={(val) => {setSelectedFeeTemplate(val); setFeeAmount(String(feeTemplates.find(t => t.id === val)?.amount || ''));}}>
                                        <SelectTrigger><SelectValue placeholder="Select a template..."/></SelectTrigger>
                                        <SelectContent>{feeTemplates.filter(t => t.type.toLowerCase() === (isMandatory ? 'mandatory' : 'optional')).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1"><Label>Amount (ZMW)</Label><Input type="number" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} /></div>
                            </div>
                            <DialogFooter>
                                <Button variant="ghost" onClick={() => {setDialogOpenState(false);}}>Cancel</Button>
                                <Button onClick={() => handleImportFee(isMandatory)}>Add Fee</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fee Name</TableHead>
                                <TableHead className="text-right">Amount (ZMW)</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Object.keys(fees).length > 0 ? Object.entries(fees).map(([id, fee]) =>
                                <TableRow key={id}>
                                    <TableCell className="font-medium">{fee.name}</TableCell>
                                    <TableCell className="text-right font-mono">{fee.amount.toFixed(2)}</TableCell>
                                    <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleDeleteFee(id, isMandatory)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell>
                                </TableRow>
                            ) : <TableRow><TableCell colSpan={3} className="text-center h-24 text-muted-foreground">No fees added yet.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </div>
            </div>
        );
    };


    return (
        <div className="space-y-4">
            <DialogHeader>
                <DialogTitle>{editingSemester ? 'Edit' : 'Create'} Academic Semester</DialogTitle>
                <DialogDescription>Configure the base settings, fees, and requirements for this academic period.</DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="details">Academic Detail</TabsTrigger>
                    <TabsTrigger value="fees">Fee Schedule</TabsTrigger>
                    <TabsTrigger value="controls">Financial Logic</TabsTrigger>
                </TabsList>
                <TabsContent value="details" className="space-y-6 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label>Intake Path</Label>
                            <Select value={intakeId} onValueChange={setIntakeId} disabled={!!editingSemester}>
                                <SelectTrigger><SelectValue placeholder="Select intake..."/></SelectTrigger>
                                <SelectContent>{allIntakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1"><Label>Year</Label><Input type="number" min="1" value={year} onChange={e => setYear(e.target.value)} disabled={!!editingSemester} /></div>
                            <div className="space-y-1"><Label>Semester #</Label><Input type="number" min="1" max="3" value={semesterInYear} onChange={e => setSemesterInYear(e.target.value)} disabled={!!editingSemester} /></div>
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="semester-name">Semester Display Name</Label>
                            <div className="flex items-center gap-2"><Switch id="custom-name" checked={useCustomName} onCheckedChange={setUseCustomName} /><Label htmlFor="custom-name" className="text-[10px] uppercase font-bold text-muted-foreground">Override Auto-Name</Label></div>
                        </div>
                        {useCustomName ? (
                            <Input id="semester-name" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="e.g., 2024 Special Retake Semester" />
                        ) : (
                            <div className="p-2 bg-muted rounded border text-sm font-medium italic">
                                {generatedName || "Fill in details above to see name..."}
                            </div>
                        )}
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="semester-dates">Active Dates (Teaching Period)</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button id="semester-dates" variant="outline" className={cn("w-full justify-start text-left font-normal", !semesterDates?.from && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {semesterDates?.from ? (semesterDates.to ? `${format(semesterDates.from, "PPP")} - ${format(semesterDates.to, "PPP")}` : format(semesterDates.from, "PPP")) : <span>Pick a date range</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" selected={semesterDates} onSelect={(range: any) => setSemesterDates(range)} numberOfMonths={2} /></PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-2">
                        <Label>Available Payment Plans</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-md border p-4 max-h-40 overflow-y-auto bg-muted/20">
                            {allPaymentPlans.filter(p => !p.archived).map(plan => (
                                <div key={plan.id} className="flex items-center gap-2">
                                    <Checkbox id={`plan-${plan.id}`} checked={!!selectedPaymentPlans[plan.id]} onCheckedChange={() => handlePlanSelection(plan.id)}/>
                                    <Label htmlFor={`plan-${plan.id}`} className="font-normal text-sm cursor-pointer">{plan.name}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="fees" className="space-y-8 pt-4">
                    {renderFeeContent(true)}
                    <Separator />
                    {renderFeeContent(false)}
                </TabsContent>
                <TabsContent value="controls" className="space-y-6 pt-4">
                    <div className="space-y-4">
                        <h3 className="font-bold flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary"/> Financial Thresholds</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label>Payment Threshold (%)</Label>
                                <div className="relative">
                                    <Input type="number" min="0" max="100" value={paymentThreshold} onChange={(e) => setPaymentThreshold(Number(e.target.value))} className="pr-10" />
                                    <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                </div>
                                <p className="text-[10px] text-muted-foreground leading-tight italic">Percent of installment due students MUST pay to avoid portal restrictions.</p>
                            </div>
                            <div className="space-y-2">
                                <Label>Grace Period (Days)</Label>
                                <div className="relative">
                                    <Input type="number" min="0" value={gracePeriodDays} onChange={(e) => setGracePeriodDays(Number(e.target.value))} className="pr-10" />
                                    <Clock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                </div>
                                <p className="text-[10px] text-muted-foreground leading-tight italic">Days allowed after deadline before penalties apply.</p>
                            </div>
                        </div>
                    </div>
                    
                    <Separator />

                    <div className="space-y-4">
                        <h3 className="font-bold flex items-center gap-2"><Clock className="h-4 w-4 text-primary"/> Registration Window</h3>
                        <div className="p-4 border rounded-lg bg-muted/10 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Late Registration Window</Label>
                                    <p className="text-[10px] text-muted-foreground">Charge an extra fee for students who register after the standard period.</p>
                                </div>
                                <Switch checked={lateRegistrationActive} onCheckedChange={setLateRegistrationActive} />
                            </div>
                            {lateRegistrationActive && (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                    <Label>Late Fee (ZMW)</Label>
                                    <Input type="number" value={lateRegistrationFee} onChange={e => setLateRegistrationFee(Number(e.target.value))} placeholder="e.g., 250" />
                                </div>
                            )}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
            <DialogFooter className="border-t pt-4">
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button onClick={handleSaveSemester} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{editingSemester ? 'Save Changes' : 'Create Semester'}</Button>
            </DialogFooter>
        </div>
    );
}

// --- MAIN PAGE COMPONENT ---
export default function RegistrationManagementPage() {
    const [allIntakes, setAllIntakes] = React.useState<Intake[]>([]);
    const [allProgrammes, setAllProgrammes] = React.useState<Programme[]>([]);
    const [allCourses, setAllCourses] = React.useState<Record<string, Course>>({});
    const [allCoursePaths, setAllCoursePaths] = React.useState<CoursePath[]>([]);
    const [activePathSemesters, setActivePathSemesters] = React.useState<Record<string, Record<string, { active: boolean; showReason: boolean; }>>>({});
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [allPaymentPlans, setAllPaymentPlans] = React.useState<PaymentPlan[]>([]);
    const [feeTemplates, setFeeTemplates] = React.useState<FeeTemplate[]>([]);
    const [calendarEvents, setCalendarEvents] = React.useState<Record<string, any>>({});
    const [timetables, setTimetables] = React.useState<Record<string, any>>({});
    const [users, setUsers] = React.useState<Record<string, any>>({});
    const [studentCounts, setStudentCounts] = React.useState<Record<string, Record<string, number>>>({}); 
    const [teachingTimes, setTeachingTimes] = React.useState<{ days: string[], slots: TimeSlot[] }>({ days: calendarDays.slice(1, 6), slots: [] });
    const [calendarSettings, setCalendarSettings] = React.useState<any>(null);
    
    // States for fixing runtime errors
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [generating, setGenerating] = React.useState(false);

    // Per-semester deadline state
    const [editingDeadlinesFor, setEditingDeadlinesFor] = React.useState<Semester | null>(null);
    const [selectedPlansInDialog, setSelectedPlansInDialog] = React.useState<Record<string, boolean>>({});
    const [eventMap, setEventMap] = React.useState<Map<string, { date: string, id: string }>>(new Map());
    const [deadlineDates, setDeadlineDates] = React.useState<Record<string, Date | undefined>>({});

    // Bulk deadline state
    const [isBulkDeadlineOpen, setIsBulkDeadlineOpen] = React.useState(false);
    const [bulkSelectedProgrammeId, setBulkSelectedProgrammeId] = React.useState('');
    const [bulkSelectedPlanId, setBulkSelectedPlanId] = React.useState('');
    const [bulkDeadlineDates, setBulkDeadlineDates] = React.useState<Record<number, Date | undefined>>({});

    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
    const [editingSemester, setEditingSemester] = React.useState<Semester | null>(null);
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = React.useState(false);
    const [viewingHistory, setViewingHistory] = React.useState<CoursePathHistoryItem[]>([]);

    const { toast } = useToast();
    
    React.useEffect(() => {
        setLoading(true);
        const refs = [
            ref(db, 'intakes'), ref(db, 'programmes'), ref(db, 'courses'), ref(db, 'coursePaths'),
            ref(db, 'semesterOfferings'), ref(db, 'settings/paymentPlans'), ref(db, 'semesters'), 
            ref(db, 'settings/feeTemplates'), ref(db, 'calendarEvents'), ref(db, 'timetables'), ref(db, 'users'),
            ref(db, 'settings/academicCalendar'), ref(db, 'registrations')
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
                case 8: setCalendarEvents(data); break;
                case 9: setTimetables(data); break;
                case 10: setUsers(data); break;
                case 11: setCalendarSettings(data); break;
                case 12: {
                    const counts: Record<string, Record<string, number>> = {};
                    for (const userId in data) {
                        for (const semId in data[userId]) {
                            const reg = data[userId][semId];
                            if (reg.status === 'Completed' || reg.status === 'Pending Payment') {
                                if (!counts[semId]) counts[semId] = {};
                                const coursesArr = Array.isArray(reg.courses) ? reg.courses : (reg.courses ? Object.keys(reg.courses) : []);
                                coursesArr.forEach((cid: string) => {
                                    counts[semId][cid] = (counts[semId][cid] || 0) + 1;
                                });
                            }
                        }
                    }
                    setStudentCounts(counts);
                } break;
            }
            if(i === 12) setLoading(false);
        }));
        return () => unsubs.forEach(unsub => unsub());
    }, []);

    const semestersByProgramme = React.useMemo(() => {
        const result: Record<string, Semester[]> = {};
        allProgrammes.forEach(p => result[p.id] = []);
        
        semesters.forEach(s => {
            const pathsUsingSem = allCoursePaths.filter(path => path.semesters && path.semesters[s.id]);
            pathsUsingSem.forEach(path => {
                if (!result[path.programmeId].find(existing => existing.id === s.id)) {
                    result[path.programmeId].push(s);
                }
            });
        });
        return result;
    }, [allProgrammes, semesters, allCoursePaths]);

    // Preload bulk deadlines logic
    React.useEffect(() => {
        if (!bulkSelectedProgrammeId || !bulkSelectedPlanId || !isBulkDeadlineOpen) return;

        const plan = allPaymentPlans.find(p => p.id === bulkSelectedPlanId);
        const targetSems = semestersByProgramme[bulkSelectedProgrammeId];
        if (!plan || !targetSems || targetSems.length === 0) return;

        let foundAny = false;
        const newBulkDates: Record<number, Date | undefined> = {};
        const eventsArray = Object.values(calendarEvents) as any[];

        for (const sem of targetSems) {
            let semMatchCount = 0;
            const tempDates: Record<number, Date | undefined> = {};

            for (let i = 0; i < plan.installments; i++) {
                const fullTitle = `${plan.name} (${getOrdinalSuffix(i + 1)} Installment) Deadline - ${sem.name}`;
                const existingEvent = eventsArray.find(e => e.title?.trim() === fullTitle.trim());
                if (existingEvent) {
                    tempDates[i] = parseISO(existingEvent.date);
                    semMatchCount++;
                }
            }

            if (semMatchCount > 0) {
                Object.assign(newBulkDates, tempDates);
                foundAny = true;
                break; 
            }
        }

        if (foundAny) {
            setBulkDeadlineDates(newBulkDates);
        } else {
            setBulkDeadlineDates({});
        }
    }, [bulkSelectedProgrammeId, bulkSelectedPlanId, isBulkDeadlineOpen, allPaymentPlans, semestersByProgramme, calendarEvents]);

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
            
            await update(ref(db, `semesters/${semesterId}`), {
                paymentPlanIds: selectedPlansInDialog
            });

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

    const getDeadlineSummary = (semester: Semester) => {
        const linkedPlanIds = Object.keys(semester.paymentPlanIds || {});
        const plans = allPaymentPlans.filter(p => linkedPlanIds.includes(p.id));
        const summary: { title: string; date: string | null }[] = [];
        let isMissing = false;

        plans.forEach(plan => {
            for (let i = 0; i < plan.installments; i++) {
                const title = `${plan.name} (${getOrdinalSuffix(i + 1)} Installment) Deadline - ${semester.name}`;
                const event = Object.values(calendarEvents).find(e => e.title?.trim() === title.trim());
                if (!event) isMissing = true;
                summary.push({ title: `${plan.name} ${getOrdinalSuffix(i + 1)}`, date: event?.date || null });
            }
        });

        return { summary, isMissing, hasPlans: plans.length > 0 };
    };

    const isDateInSemesterRange = (date: Date | undefined, sem: Semester | null) => {
        if (!date || !sem || !sem.startDate || !sem.endDate) return true;
        const d = startOfDay(date);
        const start = startOfDay(parseISO(sem.startDate));
        const end = startOfDay(parseISO(sem.endDate));
        return (d >= start && d <= end);
    };

    const handleSaveBulkDeadlines = async () => {
        const plan = allPaymentPlans.find(p => p.id === bulkSelectedPlanId);
        if (!bulkSelectedProgrammeId || !plan) {
            toast({ variant: 'destructive', title: 'Missing Selections', description: 'Please select a programme and a payment plan.' });
            return;
        }

        const validDeadlinesCount = Object.keys(bulkDeadlineDates).filter(idx => bulkDeadlineDates[Number(idx)]).length;
        if (validDeadlinesCount < plan.installments) {
            toast({ variant: 'destructive', title: 'Incomplete Deadlines', description: 'Please set a date for all installments.' });
            return;
        }

        const targetSems = semestersByProgramme[bulkSelectedProgrammeId] || [];
        if (targetSems.length === 0) {
            toast({ variant: 'destructive', title: 'No Semesters Found', description: 'No active semesters found for the selected programme.' });
            return;
        }

        setSaving(true);
        try {
            const updates: Record<string, any> = {};
            const existingEvents = Object.entries(calendarEvents).map(([id, data]) => ({ id, ...(data as any) }));

            for (const sem of targetSems) {
                const semId = sem.id;
                updates[`semesters/${semId}/paymentPlanIds/${plan.id}`] = true;

                for (let i = 0; i < plan.installments; i++) {
                    const fullTitle = `${plan.name} (${getOrdinalSuffix(i + 1)} Installment) Deadline - ${sem.name}`;
                    const date = bulkDeadlineDates[i];
                    
                    const existing = existingEvents.find(e => e.title?.trim() === fullTitle.trim());
                    if (existing) {
                        updates[`calendarEvents/${existing.id}/date`] = format(date!, 'yyyy-MM-dd');
                    } else {
                        const newRef = push(ref(db, 'calendarEvents'));
                        updates[`calendarEvents/${newRef.key}`] = {
                            title: fullTitle,
                            date: format(date!, 'yyyy-MM-dd'),
                            semester: sem.name
                        };
                    }
                }
            }

            await update(ref(db), updates);
            toast({ title: 'Bulk Deadlines Applied', description: `Updated ${targetSems.length} semester(s) for the selected programme.` });
            setIsBulkDeadlineOpen(false);
            setBulkSelectedProgrammeId('');
            setBulkSelectedPlanId('');
            setBulkDeadlineDates({});
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Bulk Update Failed', description: e.message });
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
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="font-headline text-2xl">Registration Management</CardTitle>
                        <CardDescription>Configure semesters, fees, and enrollment paths.</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => setIsBulkDeadlineOpen(true)}>
                            <Clock className="mr-2 h-4 w-4" />
                            Bulk Update Deadlines
                        </Button>
                        <Button onClick={() => setIsCreateDialogOpen(true)}>
                            <PlusCircle className="mr-2 h-4 w-4"/> New Semester
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? <Skeleton className="h-48 w-full" /> : 
                    <Accordion type="multiple" defaultValue={allIntakes.map(i => i.id)} className="w-full">
                        {allIntakes.map(intake => {
                            const intakeStartStr = parseIntakeDate(intake.name);
                            const currentState = intakeStartStr && calendarSettings ? calculateAcademicState(
                                intakeStartStr,
                                new Date(),
                                calendarSettings.standardCycles,
                                Object.values(calendarSettings.anomalies || {})
                            ) : null;

                            return (
                            <AccordionItem value={intake.id} key={intake.id}>
                                <AccordionTrigger className="hover:no-underline">
                                    <div className="flex items-center justify-between w-full pr-4">
                                        <span className="font-bold text-xl">{intake.name}</span>
                                        {currentState && (
                                            <Badge variant="secondary" className="gap-1.5 font-bold h-6">
                                                <CalendarDays className="h-3 w-3" />
                                                Current: Year {currentState.year}, Sem {currentState.semester}
                                            </Badge>
                                        )}
                                    </div>
                                </AccordionTrigger>
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
                                                <CardHeader className="flex flex-row items-center justify-between">
                                                    <CardTitle className="text-base">{programme.name}</CardTitle>
                                                    <Button variant="ghost" size="sm" asChild className="text-primary font-bold">
                                                        <Link href={`/admin/course-paths?intakeId=${intake.id}&programmeId=${programme.id}`}>
                                                            Edit Curriculum Path <ChevronRight className="ml-1 h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                </CardHeader>
                                                <CardContent className="space-y-4">
                                                    {sortedSemesters.map(({ semId, semData, semesterDetails }) => {
                                                        const semDetails = semesterDetails!;
                                                        const isActive = !!activePathSemesters[path.id]?.[semId]?.active;
                                                        const historyItems = semData.history ? Object.values(semData.history) : [];
                                                        const { summary, isMissing, hasPlans } = getDeadlineSummary(semDetails);
                                                        
                                                        const isCurrentStanding = currentState && 
                                                            semDetails.year === currentState.year && 
                                                            semDetails.semesterInYear === currentState.semester;

                                                        return (
                                                            <div key={semId} className={cn(
                                                                "p-4 border rounded-lg flex flex-col gap-4 transition-all shadow-sm",
                                                                isCurrentStanding ? "bg-blue-50/30 border-blue-200" : "bg-card"
                                                            )}>
                                                                <div className="flex justify-between items-start">
                                                                    <div className="space-y-1">
                                                                        <div className="flex items-center gap-2">
                                                                            <Label className="font-bold text-base">{semDetails.name}</Label>
                                                                            {isCurrentStanding && (
                                                                                <Badge className="bg-blue-600 text-white border-blue-700 hover:bg-blue-700 h-5 text-[9px] uppercase font-black">Current Standing</Badge>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex flex-wrap gap-2 pt-1">
                                                                            {hasPlans ? (
                                                                                isMissing ? (
                                                                                    <Badge variant="destructive" className="flex items-center gap-1 bg-orange-100 text-orange-700 border-orange-200"><AlertCircle className="h-3 w-3"/>Deadlines Missing</Badge>
                                                                                ) : (
                                                                                    <Badge variant="outline" className="flex items-center gap-1 text-green-600 border-green-600"><CheckCircle2 className="h-3 w-3"/>Deadlines Set</Badge>
                                                                                )
                                                                            ) : (
                                                                                <Badge variant="secondary">No Payment Plans</Badge>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-4">
                                                                        <div className="flex flex-col items-end">
                                                                            <span className={cn("text-[10px] font-bold uppercase", isActive ? "text-green-600" : "text-muted-foreground")}>{isActive ? "Active" : "Inactive"}</span>
                                                                            <Switch checked={isActive} onCheckedChange={() => handleToggleSemester(path.id, semId)} />
                                                                        </div>
                                                                        {historyItems.length > 0 && (
                                                                            <Button variant="ghost" size="icon" onClick={() => openHistoryDialog(historyItems)} title="View History"><History className="h-4 w-4 text-blue-600"/></Button>
                                                                        )}
                                                                        <div className="flex gap-1">
                                                                            <Button variant="ghost" size="icon" onClick={() => { setEditingSemester(semDetails); setIsEditDialogOpen(true); }} title="Edit Semester Settings"><Pencil className="h-4 w-4"/></Button>
                                                                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteSemester(semId)} title="Delete Semester"><Trash2 className="h-4 w-4"/></Button>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="space-y-2">
                                                                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">Schedules & Timetable</Label>
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                                        {(semData.courses || []).map(cid => {
                                                                            const course = allCourses[cid];
                                                                            if(!course) return null;
                                                                            const lecturerNames = (course.lecturerIds || []).map(lid => users[lid]?.name).filter(Boolean).join(', ') || users[course.lecturerId || '']?.name || 'Unassigned';
                                                                            const timetableEntries = timetables[semId]?.[cid] ? Object.values(timetables[semId][cid]) : [];
                                                                            return (
                                                                                <div key={cid} className={cn("p-2 border rounded text-xs", (course.lecturerId || (course.lecturerIds && course.lecturerIds.length > 0)) ? "bg-muted/20" : "bg-orange-50 border-orange-200")}>
                                                                                    <div className="flex justify-between font-bold">
                                                                                        <span>{course.code} - {course.name}</span>
                                                                                    </div>
                                                                                    <div className={cn("flex items-center gap-1 mt-1 font-medium", (course.lecturerId || (course.lecturerIds && course.lecturerIds.length > 0)) ? "text-muted-foreground" : "text-orange-700")}>
                                                                                        <UserCheck className="h-3 w-3" /> {lecturerNames === 'Unassigned' ? 'NO LECTURER ASSIGNED' : lecturerNames}
                                                                                    </div>
                                                                                    {timetableEntries.length > 0 && (
                                                                                        <div className="flex items-center gap-1 text-primary mt-1">
                                                                                            <Clock className="h-3 w-3" /> 
                                                                                            {timetableEntries.map((t: any) => `${t.day.substring(0,3)} ${t.startTime}`).join(', ')}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>

                                                                <div className="flex gap-2 pt-2 border-t">
                                                                    <Button variant="outline" size="sm" onClick={() => handleOpenDeadlineDialog(semDetails)}><CalendarIcon className="mr-2 h-4 w-4"/>Set Deadlines</Button>
                                                                    <Button variant="outline" size="sm" asChild><Link href={`/admin/course-paths?intakeId=${intake.id}&programmeId=${programme.id}`}><BookCopy className="mr-2 h-4"/>Edit Path</Link></Button>
                                                                    <Button variant="outline" size="sm" asChild><Link href={`/admin/timetable?semesterId=${semId}`}><Clock className="mr-2 h-4"/>Manage Timetable</Link></Button>
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
                            );
                        })}
                    </Accordion>}
                </CardContent>
                <CardFooter className="justify-end"><Button onClick={handleSaveChanges} disabled={saving}>Save All Changes</Button></CardFooter>
            </Card>

            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent className="sm:max-w-xl">
                    <CreateOrEditDialogContent editingSemester={null} onClose={() => setIsCreateDialogOpen(false)} onSaveSuccess={() => setIsCreateDialogOpen(false)} allPaymentPlans={allPaymentPlans} feeTemplates={feeTemplates} allIntakes={allIntakes} />
                </DialogContent>
            </Dialog>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-xl">
                    <CreateOrEditDialogContent editingSemester={editingSemester} onClose={() => setIsEditDialogOpen(false)} onSaveSuccess={() => setIsEditDialogOpen(false)} allPaymentPlans={allPaymentPlans} feeTemplates={feeTemplates} allIntakes={allIntakes} />
                </DialogContent>
            </Dialog>
            
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
                                                const isValid = isDateInSemesterRange(currentVal, editingDeadlinesFor);

                                                return (
                                                    <div key={i} className="flex flex-col gap-2">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-sm font-medium">{getOrdinalSuffix(i+1)} Installment</span>
                                                            {!isValid && currentVal && (
                                                                <Badge variant="destructive" className="h-5 gap-1 text-[10px] uppercase font-black animate-pulse">
                                                                    <AlertTriangle className="h-3 w-3" /> Out of Semester Range
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button variant="outline" className={cn(
                                                                    "w-full justify-start text-left font-normal", 
                                                                    !currentVal && "text-muted-foreground",
                                                                    !isValid && "border-destructive text-destructive bg-destructive/5"
                                                                )}>
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

            <Dialog open={isBulkDeadlineOpen} onOpenChange={setIsBulkDeadlineOpen}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Bulk Update Deadlines by Programme</DialogTitle>
                        <DialogDescription>Select a programme to apply a common payment plan and deadlines to all its active semesters across all intakes.</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto pr-4 py-4 space-y-6">
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-base font-bold">1. Select Target Programme</Label>
                                    <Select value={bulkSelectedProgrammeId} onValueChange={setBulkSelectedProgrammeId}>
                                        <SelectTrigger className="bg-background shadow-sm">
                                            <SelectValue placeholder="Select programme..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {allProgrammes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {bulkSelectedProgrammeId && (
                                    <div className="space-y-3 animate-in fade-in slide-in-from-left-2">
                                        <div className="flex items-center gap-2 text-primary">
                                            <GraduationCap className="h-4 w-4" />
                                            <Label className="text-xs font-black uppercase tracking-wider">Affected Semesters & Status</Label>
                                        </div>
                                        <ScrollArea className="h-64 border rounded-xl p-2 bg-muted/10">
                                            <div className="space-y-2">
                                                {semestersByProgramme[bulkSelectedProgrammeId]?.map(sem => {
                                                    const { isMissing, hasPlans } = getDeadlineSummary(sem);
                                                    return (
                                                        <div key={sem.id} className="flex items-center justify-between p-3 rounded-lg border bg-background shadow-sm">
                                                            <div className="space-y-0.5">
                                                                <p className="text-xs font-bold leading-none">{sem.name}</p>
                                                                <p className="text-[10px] text-muted-foreground font-medium">Year {sem.year}, Sem {sem.semesterInYear}</p>
                                                            </div>
                                                            {hasPlans ? (
                                                                isMissing ? (
                                                                    <Badge variant="destructive" className="h-5 px-2 text-[8px] uppercase font-black bg-orange-100 text-orange-700 border-orange-200">Missing Deadlines</Badge>
                                                                ) : (
                                                                    <Badge variant="outline" className="h-5 px-2 text-[8px] uppercase font-black text-green-600 border-green-600">Deadlines Set</Badge>
                                                                )
                                                            ) : (
                                                                <Badge variant="secondary" className="h-5 px-2 text-[8px] uppercase font-black">No Plans</Badge>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                                {(!semestersByProgramme[bulkSelectedProgrammeId] || semestersByProgramme[bulkSelectedProgrammeId].length === 0) && (
                                                    <p className="text-xs text-muted-foreground text-center py-10 italic">No active semesters found for this programme.</p>
                                                )}
                                            </div>
                                        </ScrollArea>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <Label className="text-base font-bold">2. Select Common Payment Plan</Label>
                                    <Select value={bulkSelectedPlanId} onValueChange={setBulkSelectedPlanId}>
                                        <SelectTrigger className="bg-background shadow-sm"><SelectValue placeholder="Select plan..." /></SelectTrigger>
                                        <SelectContent>
                                            {allPaymentPlans.filter(p => !p.archived).map(p => (
                                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {bulkSelectedPlanId && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
                                        <div className="flex items-center gap-2 text-primary">
                                            <CalendarDays className="h-4 w-4" />
                                            <Label className="text-xs font-black uppercase tracking-wider">3. Define Installment Dates</Label>
                                        </div>
                                        <div className="grid gap-4 border-2 border-primary/10 rounded-xl p-4 bg-background shadow-inner">
                                            {Array.from({ length: allPaymentPlans.find(p => p.id === bulkSelectedPlanId)?.installments || 0 }).map((_, i) => {
                                                const currentVal = bulkDeadlineDates[i];
                                                const affectedSems = semestersByProgramme[bulkSelectedProgrammeId] || [];
                                                const invalidSems = currentVal ? affectedSems.filter(s => !isDateInSemesterRange(currentVal, s)) : [];

                                                return (
                                                    <div key={i} className="flex flex-col gap-2">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{getOrdinalSuffix(i + 1)} Installment Due Date</span>
                                                            {invalidSems.length > 0 && (
                                                                <Popover>
                                                                    <PopoverTrigger asChild>
                                                                        <Badge variant="destructive" className="h-4 cursor-pointer px-1 animate-pulse">
                                                                            <AlertTriangle className="h-2.5 w-2.5 mr-1"/> {invalidSems.length} Conflict(s)
                                                                        </Badge>
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-64 p-2 text-xs">
                                                                        <p className="font-bold text-destructive mb-1">Date Out of Range for:</p>
                                                                        <ul className="list-disc pl-4">
                                                                            {invalidSems.map(s => <li key={s.id}>{s.name}</li>)}
                                                                        </ul>
                                                                    </PopoverContent>
                                                                </Popover>
                                                            )}
                                                        </div>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button variant="outline" className={cn(
                                                                    "w-full justify-start text-left font-normal border-primary/20", 
                                                                    !currentVal && "text-muted-foreground",
                                                                    invalidSems.length > 0 && "border-destructive text-destructive"
                                                                )}>
                                                                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                                                                    {currentVal ? format(currentVal!, 'PPP') : <span>Pick a date</span>}
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-0" align="end">
                                                                <Calendar mode="single" selected={currentVal} onSelect={(d) => setBulkDeadlineDates(prev => ({...prev, [i]: d}))} initialFocus />
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="border-t pt-4">
                        <Button variant="outline" onClick={() => setIsBulkDeadlineOpen(false)}>Cancel</Button>
                        <Button 
                            onClick={handleSaveBulkDeadlines} 
                            disabled={saving || !bulkSelectedPlanId || !bulkSelectedProgrammeId || Object.keys(bulkDeadlineDates).length < (allPaymentPlans.find(p => p.id === bulkSelectedPlanId)?.installments || 0)}
                        >
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Apply Programme Deadlines
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
