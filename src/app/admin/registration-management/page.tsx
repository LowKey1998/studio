
"use client";
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth, createNotification, getRegistrarIds } from '@/lib/firebase';
import { ref, get, set, push, onValue, remove, update, serverTimestamp } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
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
    BookCopy,
    Save
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { format, parseISO, startOfDay, isAfter, addDays, isWithinInterval, isBefore, addMonths } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { calculateAcademicState, parseIntakeDate, calculateSemesterDateRange } from '@/lib/semester-utils';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { generateFullTimetable } from '@/ai/flows/generate-timetable';

const getOrdinalSuffix = (i: number) => {
    if (i === 1) return '1st';
    if (i === 2) return '2nd';
    if (i === 3) return '3rd';
    return `${i}th`;
};

type Semester = { id: string; name: string; intakeId: string; year: number; semesterInYear: number; status: 'Open' | 'Closed' | 'Archived'; lateRegistrationActive?: boolean; lateRegistrationFee?: number; startDate?: string; endDate?: string; paymentPlanIds?: Record<string, boolean>; mandatoryFees?: Record<string, any>; optionalFees?: Record<string, any>; paymentThreshold?: number; gracePeriodDays?: number; billingPolicy?: 'course' | 'semester'; tuitionFee?: number; };
type Intake = { id: string; name: string; };
type PaymentPlan = { id: string; name: string; installments: number; installmentPercentages: number[]; archived?: boolean; };
type FeeTemplate = { id: string; name: string; amount: number; type: 'Mandatory' | 'Optional'; };

type CreateOrEditDialogContentProps = {
    editingSemester: Semester | null;
    onClose: () => void;
    onSaveSuccess: () => void;
    allPaymentPlans: PaymentPlan[];
    feeTemplates: FeeTemplate[];
    allIntakes: Intake[];
    calendarSettings: any;
    initialTab?: string;
};

function CreateOrEditDialogContent({ editingSemester, onClose, onSaveSuccess, allPaymentPlans, feeTemplates, allIntakes, calendarSettings, initialTab = 'details' }: CreateOrEditDialogContentProps) {
    const [saving, setSaving] = React.useState(false);
    const [intakeId, setIntakeId] = React.useState('');
    const [year, setYear] = React.useState('');
    const [semesterInYear, setSemesterInYear] = React.useState('');
    const [customName, setCustomName] = React.useState('');
    const [useCustomName, setUseCustomName] = React.useState(false);
    
    const [semesterDates, setSemesterDates] = React.useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
    const [selectedPaymentPlans, setSelectedPaymentPlans] = React.useState<Record<string, boolean>>({});
    const [mandatoryFees, setMandatoryFees] = React.useState<Record<string, any>>({});
    const [optionalFees, setOptionalFees] = React.useState<Record<string, any>>({});
    
    const [paymentThreshold, setPaymentThreshold] = React.useState(75);
    const [gracePeriodDays, setGracePeriodDays] = React.useState(7);
    const [lateRegistrationActive, setLateRegistrationActive] = React.useState(false);
    const [lateRegistrationFee, setLateRegistrationFee] = React.useState(0);
    const [billingPolicy, setBillingPolicy] = React.useState<'course' | 'semester'>('course');
    const [tuitionFee, setTuitionFee] = React.useState('');
    
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
            setBillingPolicy(editingSemester.billingPolicy || 'course');
            setTuitionFee(String(editingSemester.tuitionFee || ''));
        }
    }, [editingSemester]);

    React.useEffect(() => {
        if (intakeId && year && semesterInYear && calendarSettings) {
            const intake = allIntakes.find(i => i.id === intakeId);
            if (!intake) return;
            const intakeDateStr = parseIntakeDate(intake.name);
            if (!intakeDateStr) return;

            if (!editingSemester || (!editingSemester.startDate && !editingSemester.endDate)) {
                const predictedRange = calculateSemesterDateRange(
                    intakeDateStr,
                    Number(year),
                    Number(semesterInYear),
                    calendarSettings.standardCycles
                );
                
                if (predictedRange) {
                    setSemesterDates(predictedRange);
                }
            }
        }
    }, [intakeId, year, semesterInYear, editingSemester, allIntakes, calendarSettings]);

    const handleSaveSemester = async () => {
        const finalName = useCustomName ? customName : `${allIntakes.find(i=>i.id===intakeId)?.name} Year ${year} Semester ${semesterInYear}`;
        if (!finalName.trim() || !semesterDates?.from || !intakeId) { 
            toast({ variant: 'destructive', title: 'Missing Semester Details' }); 
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
                semesterInYear: Number(semesterInYear),
                billingPolicy,
                tuitionFee: Number(tuitionFee) || 0
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

    const handleImportFee = (isMandatory: boolean) => {
        if (!selectedFeeTemplate || !feeAmount) return;
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
        setSelectedFeeTemplate(''); setFeeAmount('');
    };

    const handleRemoveFee = (feeId: string, isMandatory: boolean) => {
        if (isMandatory) {
            const next = { ...mandatoryFees };
            delete next[feeId];
            setMandatoryFees(next);
        } else {
            const next = { ...optionalFees };
            delete next[feeId];
            setOptionalFees(next);
        }
    };

    return (
        <div className="space-y-4">
            <DialogHeader>
                <DialogTitle>{editingSemester ? 'Edit' : 'Create'} Academic Semester</DialogTitle>
                <DialogDescription>Configure base settings and rules for this academic period.</DialogDescription>
            </DialogHeader>
            <Tabs defaultValue={initialTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="details">Academic</TabsTrigger>
                    <TabsTrigger value="fees">Fees</TabsTrigger>
                    <TabsTrigger value="controls">Logic</TabsTrigger>
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
                            <Label htmlFor="semester-name">Display Name</Label>
                            <div className="flex items-center gap-2"><Switch id="custom-name" checked={useCustomName} onCheckedChange={setUseCustomName} /><Label htmlFor="custom-name" className="text-[10px] font-bold uppercase opacity-60">Override</Label></div>
                        </div>
                        {useCustomName ? (
                            <Input id="semester-name" value={customName} onChange={(e) => setCustomName(e.target.value)} />
                        ) : (
                            <div className="p-2 bg-muted rounded border text-sm italic font-medium">
                                {intakeId && year && semesterInYear ? `${allIntakes.find(i=>i.id===intakeId)?.name} Year ${year} Semester ${semesterInYear}` : "Pending selections..."}
                            </div>
                        )}
                    </div>

                    <div className="space-y-1">
                        <Label>Teaching window</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !semesterDates?.from && "text-muted-foreground border-dashed")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {semesterDates?.from ? (semesterDates.to ? `${format(semesterDates.from, "PPP")} - ${format(semesterDates.to, "PPP")}` : format(semesterDates.from, "PPP")) : <span>Pick dates</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" selected={semesterDates} onSelect={(range: any) => setSemesterDates(range)} numberOfMonths={2} /></PopoverContent>
                        </Popover>
                        {!editingSemester && semesterDates?.from && (
                            <p className="text-[10px] text-primary font-bold uppercase pt-1">Provisional dates calculated based on intake cycle.</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>Available Payment Plans</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-md border p-4 max-h-40 overflow-y-auto bg-muted/20">
                            {allPaymentPlans.filter(p => !p.archived).map(plan => (
                                <div key={plan.id} className="flex items-center gap-2">
                                    <Checkbox id={`plan-${plan.id}`} checked={!!selectedPaymentPlans[plan.id]} onCheckedChange={(checked) => setSelectedPaymentPlans(prev => { const n = {...prev}; if(checked) n[plan.id]=true; else delete n[plan.id]; return n; })}/>
                                    <Label htmlFor={`plan-${plan.id}`} className="font-normal text-xs">{plan.name}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="fees" className="space-y-4 pt-4">
                    <div className="p-4 border rounded-xl bg-primary/5 mb-4">
                        <Label className="text-base font-bold flex items-center gap-2 text-primary"><DollarSign className="h-4 w-4"/> Tuition Billing Strategy</Label>
                        <RadioGroup value={billingPolicy} onValueChange={(val) => setBillingPolicy(val as any)} className="grid grid-cols-2 gap-4 mt-3">
                            <div className={cn("flex flex-col items-center justify-between gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all", billingPolicy === 'course' ? "border-primary bg-primary/10" : "bg-card border-transparent")}>
                                <RadioGroupItem value="course" id="bp-course" className="sr-only" />
                                <Label htmlFor="bp-course" className="cursor-pointer text-center font-bold">Pay Per Course</Label>
                            </div>
                            <div className={cn("flex flex-col items-center justify-between gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all", billingPolicy === 'semester' ? "border-primary bg-primary/10" : "bg-card border-transparent")}>
                                <RadioGroupItem value="semester" id="bp-semester" className="sr-only" />
                                <Label htmlFor="bp-semester" className="cursor-pointer text-center font-bold">Flat Semester Fee</Label>
                            </div>
                        </RadioGroup>
                        {billingPolicy === 'semester' && (
                            <div className="space-y-1 mt-4 animate-in fade-in slide-in-from-top-2">
                                <Label className="text-xs font-bold uppercase">Flat Tuition Amount (ZMW)</Label>
                                <Input type="number" value={tuitionFee} onChange={e => setTuitionFee(e.target.value)} placeholder="5000.00" className="bg-background" />
                            </div>
                        )}
                    </div>

                    <Separator />

                    <Label className="font-bold">Mandatory Fees</Label>
                    <div className="border rounded p-2 min-h-[100px] bg-muted/10 space-y-1">
                        {Object.entries(mandatoryFees).map(([id, fee]) => (
                            <div key={id} className="flex justify-between items-center text-xs p-1.5 bg-background rounded border group">
                                <span>{fee.name}</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold">ZMW {fee.amount}</span>
                                    <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive opacity-0 group-hover:opacity-100" onClick={() => handleRemoveFee(id, true)}><Trash2 className="h-3 w-3"/></Button>
                                </div>
                            </div>
                        ))}
                        <Button variant="outline" size="sm" onClick={() => setIsMandatoryFeeDialogOpen(true)} className="w-full mt-2 h-7 text-[10px] uppercase font-black"><PlusCircle className="h-3 w-3 mr-1"/>Add Mandatory Fee</Button>
                    </div>
                    <Separator />
                    <Label className="font-bold">Optional Fees</Label>
                    <div className="border rounded p-2 min-h-[100px] bg-muted/10 space-y-1">
                        {Object.entries(optionalFees).map(([id, fee]) => (
                            <div key={id} className="flex justify-between items-center text-xs p-1.5 bg-background rounded border group">
                                <span>{fee.name}</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold">ZMW {fee.amount}</span>
                                    <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive opacity-0 group-hover:opacity-100" onClick={() => handleRemoveFee(id, false)}><Trash2 className="h-3 w-3"/></Button>
                                </div>
                            </div>
                        ))}
                        <Button variant="outline" size="sm" onClick={() => setIsOptionalFeeDialogOpen(true)} className="w-full mt-2 h-7 text-[10px] uppercase font-black"><PlusCircle className="h-3 w-3 mr-1"/>Add Optional Fee</Button>
                    </div>
                </TabsContent>
                <TabsContent value="controls" className="space-y-6 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1"><Label>Payment Threshold (%)</Label><Input type="number" value={paymentThreshold} onChange={e => setPaymentThreshold(Number(e.target.value))}/></div>
                        <div className="space-y-1"><Label>Grace Period (Days)</Label><Input type="number" value={gracePeriodDays} onChange={e => setGracePeriodDays(Number(e.target.value))}/></div>
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded bg-muted/10">
                        <Label>Activate Late Registration Fee</Label>
                        <Switch checked={lateRegistrationActive} onCheckedChange={setLateRegistrationActive} />
                    </div>
                    {lateRegistrationActive && <Input type="number" value={lateRegistrationFee} onChange={e => setLateRegistrationFee(Number(e.target.value))} placeholder="ZMW Amount" />}
                </TabsContent>
            </Tabs>
            <DialogFooter className="border-t pt-4">
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button onClick={handleSaveSemester} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}<Save className="mr-2 h-4 w-4 mr-2"/>Save Configuration</Button>
            </DialogFooter>

            <Dialog open={isMandatoryFeeDialogOpen || isOptionalFeeDialogOpen} onOpenChange={(o) => { if(!o) { setIsMandatoryFeeDialogOpen(false); setIsOptionalFeeDialogOpen(false); } }}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Select Fee Template</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <Select value={selectedFeeTemplate} onValueChange={v => { setSelectedFeeTemplate(v); setFeeAmount(String(feeTemplates.find(t=>t.id===v)?.amount || '')); }}>
                            <SelectTrigger><SelectValue placeholder="Select template..."/></SelectTrigger>
                            <SelectContent>{feeTemplates.filter(t => t.type.toLowerCase() === (isMandatoryFeeDialogOpen ? 'mandatory' : 'optional')).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <div className="space-y-1"><Label>Amount (Override)</Label><Input type="number" value={feeAmount} onChange={e => setFeeAmount(e.target.value)} /></div>
                    </div>
                    <DialogFooter><Button onClick={() => handleImportFee(isMandatoryFeeDialogOpen)}>Import Fee</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function RegistrationManagementPage() {
    const [allIntakes, setAllIntakes] = React.useState<Intake[]>([]);
    const [allProgrammes, setAllProgrammes] = React.useState<Programme[]>([]);
    const [allCourses, setAllCourses] = React.useState<Record<string, any>>({});
    const [allCoursePaths, setAllCoursePaths] = React.useState<any[]>([]);
    const [activePathSemesters, setActivePathSemesters] = React.useState<Record<string, Record<string, any>>>({});
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [allPaymentPlans, setAllPaymentPlans] = React.useState<PaymentPlan[]>([]);
    const [feeTemplates, setFeeTemplates] = React.useState<FeeTemplate[]>([]);
    const [calendarEvents, setCalendarEvents] = React.useState<any[]>([]);
    const [allTimetables, setAllTimetables] = React.useState<Record<string, any>>({});
    const [allUsers, setAllUsers] = React.useState<Record<string, any>>({});
    const [calendarSettings, setCalendarSettings] = React.useState<any>(null);
    const [institutionSettings, setInstitutionSettings] = React.useState<any>(null);
    
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);

    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
    const [editingSemester, setEditingSemester] = React.useState<Semester | null>(null);
    const [editingDeadlinesFor, setEditingDeadlinesFor] = React.useState<Semester | null>(null);
    const [selectedPlansInDialog, setSelectedPlansInDialog] = React.useState<Record<string, boolean>>({});
    const [deadlineDates, setDeadlineDates] = React.useState<Record<string, Date | null | undefined>>({});
    const [editInitialTab, setEditInitialTab] = React.useState('details');

    const [semesterToDeleteId, setSemesterToDeleteId] = React.useState<string | null>(null);
    const [isDeleteSemesterDialogOpen, setIsDeleteSemesterDialogOpen] = React.useState(false);

    const { toast } = useToast();
    
    const refreshData = React.useCallback(async () => {
        const semestersSnap = await get(ref(db, 'semesters'));
         if (semestersSnap.exists()) {
            const data = semestersSnap.val();
            const list: Semester[] = Object.keys(data).map(key => ({ id: key, ...data[key] }));
            setSemesters(list.sort((a, b) => b.name.localeCompare(a.name)));
        }
    }, []);

    React.useEffect(() => {
        setLoading(true);
        const refs = [
            ref(db, 'intakes'), ref(db, 'programmes'), ref(db, 'courses'), ref(db, 'coursePaths'),
            ref(db, 'semesterOfferings'), ref(db, 'settings/paymentPlans'), ref(db, 'semesters'), 
            ref(db, 'settings/feeTemplates'), ref(db, 'calendarEvents'), ref(db, 'users'),
            ref(db, 'settings/academicCalendar'), ref(db, 'timetables'), ref(db, 'settings/institution')
        ];
        const unsubs = refs.map((r, i) => onValue(r, (snapshot) => {
            const data = snapshot.val() || {};
            switch(i) {
                case 0: setAllIntakes(Object.keys(data).map(id => ({ id, ...data[id] })).sort((a,b) => b.name.localeCompare(a.name))); break;
                case 1: setAllProgrammes(Object.keys(data).map(id => ({ id, ...data[id] }))); break;
                case 2: setAllCourses(data); break;
                case 3: setAllCoursePaths(Object.keys(data).map(id => ({ id, ...data[id] }))); break;
                case 4: setActivePathSemesters(data); break;
                case 5: setAllPaymentPlans(Object.keys(data).map(id => ({ id, ...data[id] }))); break;
                case 6: setSemesters(Object.keys(data).map(id => ({ id, ...data[id] }))); break;
                case 7: setFeeTemplates(Object.keys(data).map(id => ({ id, ...data[id] }))); break;
                case 8: setCalendarEvents(Object.entries(data).map(([id, d]:[string, any])=>({id, ...d}))); break;
                case 9: setAllUsers(data); break;
                case 10: setCalendarSettings(data); break;
                case 11: setAllTimetables(data); break;
                case 12: setInstitutionSettings(data); break;
            }
            if(i === 12) setLoading(false);
        }));
        return () => unsubs.forEach(unsub => unsub());
    }, []);

    const isDateInSemesterRange = (date: Date, semester: Semester, autoDates?: { from: Date; to: Date } | null) => {
        let start = semester.startDate ? parseISO(semester.startDate) : autoDates?.from;
        let end = semester.endDate ? parseISO(semester.endDate) : autoDates?.to;
        if (!start || !end) return true;
        return isWithinInterval(date, { start, end });
    };

    const getDeadlineSummary = React.useCallback((semester: Semester, autoDates?: { from: Date; to: Date } | null) => {
        const linkedPlanIds = Object.keys(semester.paymentPlanIds || {});
        const plans = allPaymentPlans.filter(p => linkedPlanIds.includes(p.id));
        const summary: { title: string; date: string | null }[] = [];
        let isMissing = false;
        let isOutOfRange = false;

        plans.forEach(plan => {
            for (let i = 0; i < plan.installments; i++) {
                const title = `${plan.name} (${getOrdinalSuffix(i + 1)} Installment) Deadline - ${semester.name}`;
                const event = calendarEvents.find(e => e.title?.trim() === title.trim());
                if (!event) isMissing = true;
                else {
                    const d = parseISO(event.date);
                    if (!isDateInSemesterRange(d, semester, autoDates)) isOutOfRange = true;
                }
                summary.push({ title: `${plan.name} ${getOrdinalSuffix(i + 1)}`, date: event?.date || null });
            }
        });

        return { summary, isMissing, hasPlans: plans.length > 0, isOutOfRange };
    }, [allPaymentPlans, calendarEvents]);

    const handleOpenDeadlineDialog = (semester: Semester) => {
        setEditingDeadlinesFor(semester);
        setSelectedPlansInDialog(semester.paymentPlanIds || {});
        const dates: Record<string, Date | null> = {};
        allPaymentPlans.forEach(plan => {
            for (let i = 0; i < plan.installments; i++) {
                const title = `${plan.name} (${getOrdinalSuffix(i + 1)} Installment) Deadline`;
                const fullTitle = `${title} - ${semester.name}`;
                const ev = calendarEvents.find(e => e.title?.trim() === fullTitle.trim());
                if(ev) dates[title] = parseISO(ev.date);
            }
        });
        setDeadlineDates(dates);
    };

    const handleSaveAllDeadlines = async () => {
        if (!editingDeadlinesFor) return;
        setSaving(true);
        try {
            const updates: Record<string, any> = {};
            updates[`semesters/${editingDeadlinesFor.id}/paymentPlanIds`] = selectedPlansInDialog;
            for (const title in deadlineDates) {
                const date = deadlineDates[title];
                if (date) {
                    const existing = calendarEvents.find(e => e.title?.trim() === (title + " - " + editingDeadlinesFor.name).trim());
                    if (existing) updates[`calendarEvents/${existing.id}/date`] = format(date, 'yyyy-MM-dd');
                    else {
                        const nr = push(ref(db, 'calendarEvents'));
                        updates[`calendarEvents/${nr.key}`] = { title: `${title} - ${editingDeadlinesFor.name}`, date: format(date, 'yyyy-MM-dd'), semester: editingDeadlinesFor.name };
                    }
                }
            }
            await update(ref(db), updates);
            toast({ title: 'Deadlines Saved' });
            setEditingDeadlinesFor(null);
        } catch (e: any) { toast({ variant: 'destructive', title: 'Update Failed' }); }
        finally { setSaving(false); }
    };

    const handleSaveChanges = async () => {
        setSaving(true);
        try { 
            await set(ref(db, `semesterOfferings`), activePathSemesters);
            toast({ variant: 'success', title: 'Global Sync Complete' });
        } catch (error: any) { toast({ variant: 'destructive', title: 'Save Failed', description: error.message || 'An unexpected error occurred.' }); }
        finally { setSaving(false); }
    };

    const confirmDeleteSemester = async () => {
        if (!semesterToDeleteId) return;
        setSaving(true);
        try {
            const updates: Record<string, any> = {};
            updates[`/semesters/${semesterToDeleteId}`] = null;
            allCoursePaths.forEach(path => {
                if (path.semesters && path.semesters[semesterToDeleteId!]) {
                    updates[`/coursePaths/${path.id}/semesters/${semesterToDeleteId!}`] = null;
                }
            });
            updates[`/timetables/${semesterToDeleteId}`] = null;
            await update(ref(db), updates);
            toast({ title: "Semester Deleted" });
            setIsDeleteSemesterDialogOpen(false);
            setSemesterToDeleteId(null);
        } catch (e: any) { toast({ variant: 'destructive', title: "Delete Failed" }); }
        finally { setSaving(false); }
    };

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader>
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div>
                            <CardTitle className="font-headline text-2xl">Registration Management</CardTitle>
                            <CardDescription>Activate semesters and manage curriculum-aware enrollment paths.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" asChild><Link href="/admin/calendar">Global Calendar</Link></Button>
                            <Button onClick={() => setIsCreateDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4"/> New Semester</Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {loading ? <Skeleton className="h-96 w-full" /> : 
            <Accordion type="multiple" defaultValue={allIntakes.map(i => i.id)} className="w-full">
                {allIntakes.map(intake => {
                    const intakeStartStr = parseIntakeDate(intake.name);
                    const standing = intakeStartStr && calendarSettings ? calculateAcademicState(intakeStartStr, new Date(), calendarSettings.standardCycles, Object.values(calendarSettings.anomalies || {})) : null;

                    return (
                    <AccordionItem value={intake.id} key={intake.id}>
                        <AccordionTrigger className="px-4 hover:no-underline hover:bg-muted/30">
                            <div className="flex items-center justify-between w-full pr-4">
                                <span className="font-bold text-xl">{intake.name}</span>
                                {standing && <Badge variant="secondary" className="gap-1.5 font-bold h-6"><CalendarDays className="h-3 w-3" />Year {standing.year}, Sem {standing.semester}</Badge>}
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="p-4 space-y-4">
                            {allProgrammes.map(programme => {
                                const path = allCoursePaths.find(p => p.intakeId === intake.id && p.programmeId === programme.id);
                                if (!path || !path.semesters) return null;
                                
                                return (
                                    <div key={programme.id} className="space-y-4 p-4 border rounded-xl bg-muted/10">
                                        <div className="flex justify-between items-center mb-4">
                                            <Label className="font-bold text-lg">{programme.name}</Label>
                                            <Button variant="ghost" size="sm" asChild className="text-primary font-black uppercase text-[10px] tracking-widest"><Link href={`/admin/course-paths?intakeId=${intake.id}&programmeId=${programme.id}`}>Modify Roadmap &rarr;</Link></Button>
                                        </div>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            {Object.keys(path.semesters).map(semId => {
                                                const sem = semesters.find(s => s.id === semId);
                                                if (!sem || sem.intakeId !== intake.id) return null;
                                                
                                                const isActive = !!activePathSemesters[path.id]?.[semId]?.active;
                                                const courses = (path.semesters[semId].courses || []).map(cid => {
                                                    const c = allCourses[cid];
                                                    const lNames = (c?.lecturerIds || []).map(uid => allUsers[uid]?.name).filter(Boolean).join(', ') || allUsers[c?.lecturerId || '']?.name || 'Unassigned';
                                                    return { id: cid, code: c?.code, name: c?.name, lecturer: lNames };
                                                });

                                                const hasNoManualDates = !sem.startDate || !sem.endDate;
                                                const predictedDates = intakeStartStr && calendarSettings ? calculateSemesterDateRange(intakeStartStr, sem.year, sem.semesterInYear, calendarSettings.standardCycles) : null;

                                                const { summary: deadlines, isMissing, isOutOfRange, hasPlans } = getDeadlineSummary(sem, predictedDates);
                                                const isCurrentStanding = standing && sem.year === standing.year && sem.semesterInYear === standing.semester;
                                                
                                                const currentPolicy = sem.billingPolicy || institutionSettings?.billingPolicy || 'course';
                                                const isFlatFee = currentPolicy === 'semester';
                                                const feeMissing = isFlatFee && (!sem.tuitionFee || Number(sem.tuitionFee) <= 0);

                                                return (
                                                    <Card key={semId} className={cn("shadow-sm relative border-t-4", isActive ? "border-t-primary" : "border-t-muted opacity-80", isCurrentStanding && "ring-2 ring-primary ring-offset-2")}>
                                                        <CardHeader className="pb-3">
                                                            <div className="flex justify-between items-start">
                                                                <div className="space-y-1">
                                                                    <div className="flex flex-wrap items-center gap-2 pr-8">
                                                                        <CardTitle className="text-base">{sem.name}</CardTitle>
                                                                        {isCurrentStanding && <Badge className="h-4 text-[8px] bg-primary text-primary-foreground font-black uppercase whitespace-nowrap shrink-0">Current Standing</Badge>}
                                                                    </div>
                                                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                                                        {hasPlans && isOutOfRange && <Badge variant="destructive" className="h-4 text-[8px] uppercase animate-pulse bg-red-100 text-red-700">Date Conflict</Badge>}
                                                                        {isActive ? <Badge className="h-4 text-[8px] bg-green-100 text-green-700 border-green-200">Registration Open</Badge> : <Badge variant="secondary" className="h-4 text-[8px]">Closed</Badge>}
                                                                        <Badge variant="outline" className="h-4 text-[8px] uppercase">{isFlatFee ? 'Flat Fee' : 'Course Fee'}</Badge>
                                                                    </div>
                                                                </div>
                                                                <Switch className="absolute top-6 right-4" checked={isActive} onCheckedChange={() => {
                                                                    const next = {...activePathSemesters};
                                                                    if(!next[path.id]) next[path.id] = {};
                                                                    next[path.id][semId] = { active: !isActive, showReason: false };
                                                                    setActivePathSemesters(next);
                                                                }} />
                                                            </div>
                                                        </CardHeader>
                                                        <CardContent className="space-y-4">
                                                            {isFlatFee && (
                                                                <div className="p-2 rounded-lg border bg-primary/5 flex items-center justify-between">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[9px] font-black uppercase text-muted-foreground leading-none">Semester Tuition</span>
                                                                        {feeMissing ? (
                                                                            <span className="text-xs font-black text-destructive animate-pulse uppercase mt-1">Fees Not Set</span>
                                                                        ) : (
                                                                            <span className="text-sm font-black text-primary">ZMW {sem.tuitionFee?.toLocaleString()}</span>
                                                                        )}
                                                                    </div>
                                                                    {feeMissing && (
                                                                        <Button variant="outline" size="sm" className="h-7 text-[9px] font-black uppercase tracking-widest border-destructive/20 text-destructive hover:bg-destructive/10" onClick={() => { setEditingSemester(sem); setEditInitialTab('fees'); setIsEditDialogOpen(true); }}>Set Fee</Button>
                                                                    )}
                                                                </div>
                                                            )}

                                                            <div className="space-y-1">
                                                                <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Active window</Label>
                                                                {hasNoManualDates ? (
                                                                    <div className="flex flex-col gap-1">
                                                                        <Alert variant="default" className="bg-yellow-50 border-yellow-200 py-2">
                                                                            <AlertTriangle className="h-3 w-3 text-yellow-600" />
                                                                            <AlertDescription className="text-[10px] text-yellow-700 leading-tight">
                                                                                Dates missing. Use calculated window?
                                                                            </AlertDescription>
                                                                        </Alert>
                                                                        <div className="text-[10px] font-bold border rounded-md p-2 bg-primary/5 text-primary">
                                                                            {predictedDates ? `${format(predictedDates.from, 'PPP')} - ${format(predictedDates.to, 'PPP')}` : "Unavailable"}
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-[10px] font-bold">
                                                                        {format(parseISO(sem.startDate!), 'PPP')} - {format(parseISO(sem.endDate!), 'PPP')}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Active Curriculum</Label>
                                                                <div className="grid gap-1">
                                                                    {courses.map(c => <div key={c.id} className="text-xs p-1.5 bg-muted/30 rounded border border-dashed"><span className="font-bold">{c.code}</span>: {c.name} <p className="text-[10px] opacity-60">{c.lecturer}</p></div>)}
                                                                </div>
                                                            </div>
                                                            <Separator />
                                                            <div className="space-y-2">
                                                                <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Finance Deadlines</Label>
                                                                <div className="space-y-1">
                                                                    {deadlines.map((d, i) => (
                                                                        <div key={i} className="flex justify-between text-[10px] px-1">
                                                                            <span className="opacity-70">{d.title}</span>
                                                                            <span className={cn("font-bold", !d.date && "text-destructive italic")}>{d.date ? format(parseISO(d.date), 'dd MMM') : "Not Set"}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                        <CardFooter className="bg-muted/10 border-t flex justify-end gap-2 p-3">
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingSemester(sem); setEditInitialTab('details'); setIsEditDialogOpen(true); }}><Pencil className="h-4 w-4"/></Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDeadlineDialog(sem)}><CalendarIcon className="h-4 w-4"/></Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setSemesterToDeleteId(semId); setIsDeleteSemesterDialogOpen(true); }}><Trash2 className="h-4 w-4"/></Button>
                                                        </CardFooter>
                                                    </Card>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </AccordionContent>
                    </AccordionItem>
                    );
                })}
            </Accordion>}

            <div className="flex justify-end p-6 bg-muted/20 border-t rounded-xl shadow-inner">
                <Button size="lg" className="shadow-xl px-12 font-bold" onClick={handleSaveChanges} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}<Save className="mr-2 h-4 w-4"/>Save Master Configuration</Button>
            </div>

            <Dialog open={isCreateDialogOpen || isEditDialogOpen} onOpenChange={(o) => { if(!o) { setIsCreateDialogOpen(false); setIsEditDialogOpen(false); setEditingSemester(null); } }}>
                <DialogContent className="sm:max-w-xl">
                    <CreateOrEditDialogContent 
                        editingSemester={editingSemester} 
                        onClose={() => { setIsCreateDialogOpen(false); setIsEditDialogOpen(false); setEditingSemester(null); }} 
                        onSaveSuccess={() => { refreshData(); setIsCreateDialogOpen(false); setIsEditDialogOpen(false); setEditingSemester(null); }} 
                        allPaymentPlans={allPaymentPlans} 
                        feeTemplates={feeTemplates}
                        allIntakes={allIntakes}
                        calendarSettings={calendarSettings}
                        initialTab={editInitialTab}
                    />
                </DialogContent>
            </Dialog>

            <Dialog open={!!editingDeadlinesFor} onOpenChange={() => setEditingDeadlinesFor(null)}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader><DialogTitle>Quick Deadline Adjustments</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
                        <Label className="text-base font-bold">1. Linked Payment Plans</Label>
                        <div className="grid grid-cols-2 gap-2 p-3 border rounded bg-muted/20">
                            {allPaymentPlans.filter(p=>!p.archived).map(p => (
                                <div key={p.id} className="flex items-center space-x-2">
                                    <Checkbox id={`dl-p-${p.id}`} checked={!!selectedPlansInDialog[p.id]} onCheckedChange={() => setSelectedPlansInDialog(prev => ({...prev, [p.id]: !prev[p.id]}))}/>
                                    <Label htmlFor={`dl-p-${p.id}`}>{p.name}</Label>
                                </div>
                            ))}
                        </div>
                        <Label className="text-base font-bold">2. Set Dates</Label>
                        {allPaymentPlans.filter(p => selectedPlansInDialog[p.id]).map(p => (
                            <div key={p.id} className="space-y-2 border p-3 rounded">
                                <p className="text-xs font-black uppercase text-primary border-b pb-1 mb-2">{p.name}</p>
                                {Array.from({length: p.installments}).map((_, i) => {
                                    const title = `${p.name} (${getOrdinalSuffix(i + 1)} Installment) Deadline`;
                                    const val = deadlineDates[title];
                                    return (
                                        <div key={i} className="flex items-center justify-between">
                                            <span className="text-xs">{getOrdinalSuffix(i+1)} Installment</span>
                                            <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className="w-48 text-xs">{val ? format(val, 'PPP') : "Select Date"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={val || undefined} onSelect={d => setDeadlineDates(prev => ({...prev, [title]: d}))} initialFocus/></PopoverContent></Popover>
                                        </div>
                                    )
                                })}
                            </div>
                        ))}
                    </div>
                    <DialogFooter><Button variant="ghost" onClick={() => setEditingDeadlinesFor(null)}>Cancel</Button><Button onClick={handleSaveAllDeadlines} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}<Save className="mr-2 h-4 w-4 mr-2"/>Apply Dates</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteSemesterDialogOpen} onOpenChange={setIsDeleteSemesterDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the semester record and its associated data. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setSemesterToDeleteId(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteSemester} className="bg-destructive text-destructive-foreground">Delete Semester</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
