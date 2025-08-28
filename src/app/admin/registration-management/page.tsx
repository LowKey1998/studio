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
    const [semesterNameInput, setSemesterNameInput] = React.useState('');
    const [semesterDates, setSemesterDates] = React.useState<DateRange | undefined>();
    const [selectedPaymentPlans, setSelectedPaymentPlans] = React.useState<Record<string, boolean>>({});
    const [mandatoryFees, setMandatoryFees] = React.useState<Record<string, Omit<Fee, 'id'>>>({});
    const [optionalFees, setOptionalFees] = React.useState<Record<string, Omit<Fee, 'id'>>>({});
    
    // New state for create form
    const [selectedIntake, setSelectedIntake] = React.useState('');
    const [yearInput, setYearInput] = React.useState('');
    const [semesterInYearInput, setSemesterInYearInput] = React.useState('');
    
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
            setSelectedIntake(editingSemester.intakeId || '');
            setYearInput(editingSemester.year?.toString() || '');
            setSemesterInYearInput(editingSemester.semesterInYear?.toString() || '');
        } else {
             setSemesterNameInput('');
             setSemesterDates(undefined);
             setSelectedPaymentPlans({});
             setMandatoryFees({});
             setOptionalFees({});
             setSelectedIntake('');
             setYearInput('');
             setSemesterInYearInput('');
        }
    }, [editingSemester]);
    
     React.useEffect(() => {
        if (!editingSemester && selectedIntake && yearInput && semesterInYearInput) {
            const intake = intakes.find(i => i.id === selectedIntake);
            if (intake) {
                setSemesterNameInput(`${intake.name} Year ${yearInput} Semester ${semesterInYearInput}`);
            }
        }
    }, [selectedIntake, yearInput, semesterInYearInput, editingSemester, intakes]);


    const handlePlanSelection = (planId: string) => {
        setSelectedPaymentPlans(prev => {
            const newSelection = { ...prev };
            if (newSelection[planId]) delete newSelection[planId];
            else newSelection[planId] = true;
            return newSelection;
        });
    };
    
    const handleAddFee = (isMandatory: boolean) => {
        const newFeeName = prompt(`Enter the name for the new ${isMandatory ? 'mandatory' : 'optional'} fee:`);
        if (!newFeeName) return;
        const newFeeAmountStr = prompt(`Enter the amount for "${newFeeName}":`);
        const newFeeAmount = parseFloat(newFeeAmountStr || '0');
        if (isNaN(newFeeAmount) || newFeeAmount <= 0) {
             toast({ variant: 'destructive', title: 'Invalid Amount'});
             return;
        }

        const newFee = { name: newFeeName, amount: newFeeAmount };
        const feeId = push(ref(db, 'semesters')).key!;
        
        if (isMandatory) {
            setMandatoryFees(prev => ({ ...prev, [feeId]: newFee }));
        } else {
            setOptionalFees(prev => ({ ...prev, [feeId]: newFee }));
        }
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
        if ((!editingSemester && (!selectedIntake || !yearInput || !semesterInYearInput)) || !semesterNameInput.trim() || !semesterDates?.from) { 
            toast({ variant: 'destructive', title: 'Missing Semester Details'}); return; 
        }
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
                intakeId: editingSemester?.intakeId || selectedIntake,
                year: editingSemester?.year || Number(yearInput),
                semesterInYear: editingSemester?.semesterInYear || Number(semesterInYearInput),
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
                     <div className="flex gap-2">
                        <Button size="sm" variant="secondary" type="button" onClick={() => handleAddFee(isMandatory)}><PlusCircle className="h-4 w-4 mr-1"/>Create New</Button>
                        <Dialog open={dialogOpenState} onOpenChange={setDialogOpenState}>
                            <DialogTrigger asChild>
                                <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1"/>Import from Template</Button>
                            </DialogTrigger>
                            <DialogContent onInteractOutside={(e) => e.stopPropagation()}>
                                <DialogHeader>
                                    <DialogTitle>Import {isMandatory ? 'Mandatory' : 'Optional'} Fee Template</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="space-y-1"><Label>Fee Name</Label>
                                        <Select value={selectedFeeTemplate} onValueChange={(val) => {setSelectedFeeTemplate(val); setFeeAmount(String(feeTemplates.find(t => t.id === val)?.amount || ''));}}>
                                            <SelectTrigger><SelectValue placeholder={`Select a ${isMandatory ? 'mandatory' : 'optional'} fee...`}/></SelectTrigger>
                                            <SelectContent>{feeTemplates.filter(t => t.type.toLowerCase() === (isMandatory ? 'mandatory' : 'optional')).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
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
            <TabsContent value="details" className="pt-4">
                <div className="grid gap-4">
                    {!editingSemester && (
                        <div className="grid grid-cols-3 gap-4">
                             <div className="space-y-1"><Label>Intake</Label><Select value={selectedIntake} onValueChange={setSelectedIntake}><SelectTrigger><SelectValue placeholder="Select intake..."/></SelectTrigger><SelectContent>{intakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
                             <div className="space-y-1"><Label>Year</Label><Input type="number" placeholder="e.g., 1" value={yearInput} onChange={e => setYearInput(e.target.value)} /></div>
                             <div className="space-y-1"><Label>Semester</Label><Input type="number" placeholder="e.g., 1" value={semesterInYearInput} onChange={e => setSemesterInYearInput(e.target.value)}/></div>
                        </div>
                    )}
                    <div className="space-y-1"><Label htmlFor="semester-name">Semester Name</Label><Input id="semester-name" value={semesterNameInput} onChange={(e) => setSemesterNameInput(e.target.value)} disabled={!editingSemester}/></div>
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
            <TabsContent value="fees" className="pt-4"><div className="space-y-4">{renderFeeContent(true)}{renderFeeContent(false)}</div></TabsContent>
        </Tabs>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSaveSemester} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{editingSemester ? 'Save Changes' : 'Create Semester'}</Button></DialogFooter>
        </>
    );
}

function FinancialSetupView({ semester, allPaymentPlans }: { semester: Semester, allPaymentPlans: PaymentPlan[] }) {
    const [deadlines, setDeadlines] = React.useState<DeadlineInfo[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [editingDeadlineId, setEditingDeadlineId] = React.useState<string | null>(null);
    const [deadlineDates, setDeadlineDates] = React.useState<Record<string, Date | undefined>>({});
    const { toast } = useToast();

    const fetchDeadlines = React.useCallback(async () => {
        setLoading(true);
        try {
            const eventsSnapshot = await get(ref(db, 'calendarEvents'));
            const eventMap = new Map<string, { date: string, id: string }>();
            if (eventsSnapshot.exists()) {
                Object.entries(eventsSnapshot.val()).forEach(([id, event]: [string, any]) => {
                    eventMap.set(event.title.trim(), { date: event.date, id });
                });
            }

            const linkedPlanIds = Object.keys(semester.paymentPlanIds || {});
            const linkedPlans = allPaymentPlans.filter(p => linkedPlanIds.includes(p.id));
            const requiredDeadlines: string[] = [];
            linkedPlans.forEach(plan => {
                for (let i = 0; i < plan.installments; i++) {
                    requiredDeadlines.push(`${plan.name} (${getOrdinalSuffix(i + 1)} Installment) Deadline - ${semester.name}`);
                }
            });

            setDeadlines(requiredDeadlines.map(title => {
                const existing = eventMap.get(title.trim());
                return { title: title.replace(` - ${semester.name}`, ''), date: existing?.date || null, eventId: existing?.id || null };
            }));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [semester, allPaymentPlans]);

    React.useEffect(() => {
        fetchDeadlines();
    }, [fetchDeadlines]);

    const handleSaveDeadline = async (title: string, eventId: string | null) => {
        const date = deadlineDates[title];
        if (!date) { toast({ variant: 'destructive', title: 'Date required' }); return; }
        setSaving(true);
        const fullTitle = `${title} - ${semester.name}`;
        try {
            const eventRef = eventId ? ref(db, `calendarEvents/${eventId}`) : push(ref(db, 'calendarEvents'));
            await set(eventRef, { title: fullTitle, date: format(date, 'yyyy-MM-dd'), semester: semester.name });
            toast({ title: "Deadline Updated" });
            setDeadlineDates(prev => ({ ...prev, [title]: undefined }));
            setEditingDeadlineId(null);
            fetchDeadlines();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to save deadline' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <Skeleton className="h-40 w-full" />
    }

    return (
        <div className="space-y-4">
            <h4 className="font-semibold">Payment Deadlines</h4>
            {deadlines.length > 0 ? (
                <div className="space-y-2">
                    {deadlines.map(({ title, date, eventId }) => {
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
                    })}
                </div>
            ) : <Alert><Info className="h-4 w-4" /><AlertTitle>No Payment Plans Linked</AlertTitle><AlertDescription>No payment deadlines are required as no payment plans are linked to this semester.</AlertDescription></Alert>}
        </div>
    );
}

function AvailableCoursesView({ semester, programme, path, allCourses, availableForSemester, onCourseSelect, canEdit }: {
    semester: Semester,
    programme: Programme,
    path: CoursePath | undefined,
    allCourses: Record<string, Course>,
    availableForSemester: string[],
    onCourseSelect: (courseId: string) => void;
    canEdit: boolean;
}) {
    if (!path || !path.semesters || !path.semesters[semester.id]) {
        return <p className="text-muted-foreground p-4">No course path defined for this programme in this semester.</p>;
    }
    
    const semesterCourseIds = path.semesters[semester.id].courses || [];
    const isFlatFee = !!programme.tuitionFee;

    const coursesByYear = semesterCourseIds
        .map(id => allCourses[id] ? { ...allCourses[id], id } : null)
        .filter(c => c && c.status === 'active')
        .reduce((acc, course) => {
            if(!course) return acc;
            const yearKey = `Year ${course.year}`;
            if (!acc[yearKey]) acc[yearKey] = [];
            acc[yearKey].push(course);
            return acc;
        }, {} as GroupedCourses);
        
    return (
        <div className="space-y-4">
             {isFlatFee && <Alert><Info className="h-4 w-4"/><AlertDescription>This programme has a flat semester fee. All courses below are required and pre-selected for students.</AlertDescription></Alert>}
            {Object.entries(coursesByYear).map(([year, courses]) => (
                <div key={year}>
                    <h4 className="font-semibold mb-2">{year}</h4>
                     <div className="border rounded-md">
                        {courses.map((course, index) => (
                            <div key={course.id} className={`flex items-center gap-3 p-3 ${index < courses.length - 1 ? 'border-b' : ''}`}>
                                <Checkbox
                                    id={`course-${course.id}`}
                                    checked={isFlatFee || availableForSemester.includes(course.id)}
                                    disabled={!canEdit || isFlatFee}
                                    onCheckedChange={() => onCourseSelect(course.id)}
                                />
                                <Label htmlFor={`course-${course.id}`} className="flex-1 cursor-pointer">
                                    <p>{course.name}</p>
                                    <p className="text-xs text-muted-foreground">{course.code}</p>
                                </Label>
                                 <span className="text-sm font-mono">ZMW {course.cost?.toFixed(2) || '0.00'}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
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
    
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [activeTab, setActiveTab] = React.useState<'Open' | 'Closed' | 'Archived'>('Open');
    const [intakeFilter, setIntakeFilter] = React.useState('all');
    const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
    const [editingSemester, setEditingSemester] = React.useState<Semester | null>(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [availableForSemester, setAvailableForSemester] = React.useState<string[]>([]);
    const [selectedSemester, setSelectedSemester] = React.useState<string>('');


    const [allPaymentPlans, setAllPaymentPlans] = React.useState<PaymentPlan[]>([]);
    const [feeTemplates, setFeeTemplates] = React.useState<FeeTemplate[]>([]);

    const { toast } = useToast();
    
    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [
                semestersSnap, coursesSnap, programmesSnap, plansSnap, feesSnap, intakesSnap, coursePathsSnap
            ] = await Promise.all([
                get(ref(db, 'semesters')), get(ref(db, 'courses')), get(ref(db, 'programmes')),
                get(ref(db, 'settings/paymentPlans')), get(ref(db, 'settings/feeTemplates')),
                get(ref(db, 'intakes')), get(ref(db, 'coursePaths'))
            ]);
    
            setSemesters(semestersSnap.exists() ? Object.keys(semestersSnap.val()).map(id => ({ id, ...semestersSnap.val()[id] })) : []);
            setAllCourses(coursesSnap.val() || {});
            setAllProgrammes(programmesSnap.exists() ? Object.keys(programmesSnap.val()).map(id => ({ id, ...programmesSnap.val()[id] })) : []);
            setAllPaymentPlans(plansSnap.exists() ? Object.keys(plansSnap.val()).map(id => ({ id, ...plansSnap.val()[id] })) : []);
            setFeeTemplates(feesSnap.exists() ? Object.keys(feesSnap.val()).map(id => ({ id, ...feesSnap.val()[id] })) : []);
            const intakesData = intakesSnap.val() || {};
            const intakesList = intakesSnap.exists() ? Object.keys(intakesData).map(id => ({ id, ...intakesData[id] })).sort((a,b) => b.name.localeCompare(a.name)) : [];
            setAllIntakes(intakesList);
            if (intakesList.length > 0 && intakeFilter === 'all') setIntakeFilter(intakesList[0].id);

            setAllCoursePaths(coursePathsSnap.exists() ? Object.values(coursePathsSnap.val()) : []);
            
        } catch (e) { console.error(e) } 
        finally { setLoading(false); }
    }, [intakeFilter]);

    const fetchOfferings = React.useCallback(async (semesterId: string) => {
        const semester = semesters.find(s => s.id === semesterId);
        if(!semester) return;
        const offeringsSnap = await get(ref(db, `semesterOfferings/${semester.name}/courseIds`));
        setAvailableForSemester(offeringsSnap.exists() ? offeringsSnap.val() : []);
    }, [semesters]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    React.useEffect(() => {
        if(selectedSemester) fetchOfferings(selectedSemester);
    }, [selectedSemester, fetchOfferings]);


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
        } catch (e: any) { toast({ variant: 'destructive', title: 'Update Failed', description: e.message }); }
    };
    
    const handleArchiveSemester = async (semesterId: string) => {
        if(!window.confirm("Are you sure you want to archive this semester? This will hide it from the main view but won't delete data.")) return;
        try {
            await update(ref(db, `semesters/${semesterId}`), { status: 'Archived' });
            toast({ variant: 'success', title: `Semester archived.` });
        } catch(e: any) {
            toast({ variant: 'destructive', title: 'Archive Failed', description: e.message });
        }
    }
    
    const handleToggleLateRegistration = async (semester: Semester) => {
        const newStatus = !(semester.lateRegistrationActive ?? false);
        try { await update(ref(db, `semesters/${semester.id}`), { lateRegistrationActive: newStatus });
             toast({ variant: 'success', title: `Late Registration ${newStatus ? 'Enabled' : 'Disabled'}` });
        } catch (e: any) { toast({ variant: 'destructive', title: 'Update Failed', description: e.message }); }
    };

    const handleSelectCourse = (courseId: string) => {
        setAvailableForSemester(prev => prev.includes(courseId) ? prev.filter(id => id !== courseId) : [...prev, courseId]);
    };

    const handleSaveChanges = async () => {
        const semester = semesters.find(s => s.id === selectedSemester);
        if (!semester) return;
        setSaving(true);
        try { 
            await set(ref(db, `semesterOfferings/${semester.name}`), { courseIds: availableForSemester, isOpen: semester.status === 'Open' });
            toast({ variant: 'success', title: 'Settings Saved', description: `Registration settings for ${semester.name} have been updated.` });
        } catch (error: any) { toast({ variant: 'destructive', title: 'Save Failed', description: error.message || 'An unexpected error occurred.' });
        } finally { setSaving(false); }
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
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Registration Management</CardTitle>
                    <CardDescription>Create semesters, manage fees, and select which courses are available for student registration.</CardDescription>
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
                        <div className="self-end">
                            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                                <DialogTrigger asChild><Button variant="default"><PlusCircle className="mr-2 h-4 w-4"/> New Semester</Button></DialogTrigger>
                                <DialogContent className="sm:max-w-xl"><CreateOrEditDialogContent editingSemester={null} onClose={() => setIsCreateDialogOpen(false)} onSaveSuccess={() => {refreshData(); setIsCreateDialogOpen(false);}} allPaymentPlans={allPaymentPlans} feeTemplates={feeTemplates} intakes={allIntakes} /></DialogContent>
                            </Dialog>
                        </div>
                    </div>
                     <Accordion type="single" collapsible className="w-full" onValueChange={setSelectedSemester}>
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
                                    <Button variant={semester.status === 'Open' ? 'destructive' : 'default'} onClick={() => handleToggleSemesterStatus(semester)}><Power className="mr-2 h-4 w-4" />{semester.status === 'Open' ? 'Close Registration' : 'Open Registration'}</Button>
                                    {semester.status === 'Open' && (<Button variant={semester.lateRegistrationActive ? 'destructive' : 'secondary'} onClick={() => handleToggleLateRegistration(semester)}><ShieldAlert className="mr-2 h-4 w-4" />{semester.lateRegistrationActive ? 'Disable Late Registration' : 'Enable Late Registration'}</Button>)}
                                    <Button variant="outline" onClick={() => handleOpenEditDialog(semester)}><Pencil className="mr-2 h-4 w-4" /> Edit</Button>
                                    {activeTab !== 'Archived' && (<Button variant="outline" onClick={() => handleArchiveSemester(semester.id)}><Trash2 className="mr-2 h-4 w-4"/> Archive</Button>)}
                                </div>
                                <Tabs defaultValue="courses">
                                    <TabsList>
                                        <TabsTrigger value="courses">Available Courses</TabsTrigger>
                                        <TabsTrigger value="financials">Financial Setup</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="courses">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle>Course Selection</CardTitle>
                                                <CardDescription>Select which courses are available for registration in this semester.</CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                {allProgrammes.map(prog => (
                                                    <Accordion key={prog.id} type="single" collapsible className="w-full">
                                                        <AccordionItem value={prog.id}><AccordionTrigger>{prog.name}</AccordionTrigger>
                                                        <AccordionContent>
                                                             <AvailableCoursesView 
                                                                semester={semester}
                                                                programme={prog}
                                                                path={allCoursePaths.find(p => p.intakeId === semester.intakeId && p.programmeId === prog.id)}
                                                                allCourses={allCourses}
                                                                availableForSemester={availableForSemester}
                                                                onCourseSelect={handleSelectCourse}
                                                                canEdit={semester.status !== 'Open'}
                                                             />
                                                        </AccordionContent>
                                                        </AccordionItem>
                                                    </Accordion>
                                                ))}
                                            </CardContent>
                                            <CardFooter className="justify-end"><Button onClick={handleSaveChanges} disabled={saving || semester.status === 'Open'}>Save Course Selection</Button></CardFooter>
                                        </Card>
                                    </TabsContent>
                                    <TabsContent value="financials">
                                       <Card>
                                           <CardHeader><CardTitle>Financial Setup</CardTitle></CardHeader>
                                           <CardContent><FinancialSetupView semester={semester} allPaymentPlans={allPaymentPlans} /></CardContent>
                                       </Card>
                                    </TabsContent>
                                </Tabs>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                    {!loading && filteredSemesters.length === 0 && <Alert><AlertCircle className="h-4 w-4"/><AlertTitle>No Semesters Found</AlertTitle><AlertDescription>There are no semesters matching the current filter.</AlertDescription></Alert>}
                </CardContent>
            </Card>
             <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-xl"><CreateOrEditDialogContent editingSemester={editingSemester} onClose={() => setIsEditDialogOpen(false)} onSaveSuccess={() => {refreshData(); setIsEditDialogOpen(false);}} allPaymentPlans={allPaymentPlans} feeTemplates={feeTemplates} intakes={allIntakes} /></DialogContent>
            </Dialog>
        </div>
    );
}

