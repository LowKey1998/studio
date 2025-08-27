
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
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


// --- TYPE DEFINITIONS ---
type Course = { id: string; name: string; code: string; year: number; status: 'active' | 'archived'; lecturerName?: string; };
type Intake = { id: string; name: string; };
type Programme = { id: string; name: string; courseIds?: Record<string, boolean>, tuitionFee?: number; };
type CoursePathHistoryItem = { reason: string; oldCourses: string[]; newCourses: string[]; timestamp: any; };
type CoursePathSemester = { courses: string[]; history?: Record<string, CoursePathHistoryItem>; };
type CoursePath = { id: string; intakeId: string; programmeId: string; semesters: Record<string, CoursePathSemester> }; // Key is now semesterId
type Fee = { id: string; name: string; amount: number; };
type FeeTemplate = { id: string; name: string; amount: number; type: 'Mandatory' | 'Optional'; };
type PaymentPlan = { id: string; name: string; installments: number; installmentPercentages: number[]; archived?: boolean; };
type Semester = { id: string; name: string; status: 'Open' | 'Closed' | 'Archived'; lateRegistrationActive?: boolean; startDate?: string; endDate?: string; paymentPlanIds?: Record<string, boolean>; mandatoryFees?: Record<string, Fee>; optionalFees?: Record<string, Fee>; year: number; semesterInYear: number; intakeId: string; };
type DeadlineInfo = { title: string; date: string | null; eventId: string | null; };
type GroupedCourses = { [year: string]: Course[]; };


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
        const dialogOpenState = isMandatory ? isMandatoryFeeDialogOpen : isOptionalFeeDialogOpen;
        const setDialogOpenState = isMandatory ? setIsMandatoryFeeDialogOpen : setIsOptionalFeeDialogOpen;

        return (
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <Label>{isMandatory ? 'Mandatory Fees' : 'Optional Fees'}</Label>
                    <Dialog open={dialogOpenState} onOpenChange={setDialogOpenState}>
                        <DialogTrigger asChild>
                            <Button size="sm" variant="outline"><PlusCircle className="h-4 w-4 mr-1"/>Import {isMandatory ? 'Mandatory' : 'Optional'} Fee</Button>
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
    const [allCourses, setAllCourses] = React.useState<Record<string, Course>>({});
    const [availableForSemester, setAvailableForSemester] = React.useState<string[]>([]);
    const [loading, setLoading] = React.useState(true);
    
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [selectedSemester, setSelectedSemester] = React.useState<string>('');
    const [allPaymentPlans, setAllPaymentPlans] = React.useState<PaymentPlan[]>([]);
    const [feeTemplates, setFeeTemplates] = React.useState<FeeTemplate[]>([]);
    const [allProgrammes, setAllProgrammes] = React.useState<Programme[]>([]);

    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
    const [editingSemester, setEditingSemester] = React.useState<Semester | null>(null);

    const [semesterDeadlines, setSemesterDeadlines] = React.useState<DeadlineInfo[]>([]);
    const [deadlineDates, setDeadlineDates] = React.useState<Record<string, Date | undefined>>({});
    const [editingDeadlineId, setEditingDeadlineId] = React.useState<string | null>(null);
    const [editingDeadlinesFor, setEditingDeadlinesFor] = React.useState<{ semesterName: string; } | null>(null);
    
    // State for course path view
    const [pathCoursesForSemester, setPathCoursesForSemester] = React.useState<Course[]>([]);
    const [isFlatFee, setIsFlatFee] = React.useState(false);

    const { toast } = useToast();
    
     React.useEffect(() => {
        const refs = [
            ref(db, 'semesters'),
            ref(db, 'settings/paymentPlans'),
            ref(db, 'settings/feeTemplates'),
            ref(db, 'courses'),
            ref(db, 'programmes')
        ];
        
        const unsubs = refs.map((r, i) => onValue(r, (snapshot) => {
            const data = snapshot.val() || {};
            switch(i) {
                case 0: 
                    const list: Semester[] = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                    setSemesters(list.sort((a, b) => b.name.localeCompare(a.name)));
                    if (!selectedSemester && list.length > 0) setSelectedSemester(list[0].id);
                    break;
                case 1: setAllPaymentPlans(Object.keys(data).map(id => ({ id, ...data[id] }))); break;
                case 2: setFeeTemplates(Object.keys(data).map(id => ({ id, ...data[id] }))); break;
                case 3: setAllCourses(data); break;
                case 4: setAllProgrammes(Object.keys(data).map(id => ({ id, ...data[id] }))); break;
            }
        }));

        return () => unsubs.forEach(unsub => unsub());
    }, [selectedSemester]);


    const fetchDataForSemester = React.useCallback(async () => {
        const semesterData = semesters.find(s => s.id === selectedSemester);
        if (!semesterData) { setLoading(false); return; }
        setLoading(true);
        setSemesterDeadlines([]);
        setPathCoursesForSemester([]);
        
        try {
            const [eventsSnapshot, semesterOfferingsSnapshot, coursePathsSnap, usersSnap] = await Promise.all([
                get(ref(db, 'calendarEvents')),
                get(ref(db, `semesterOfferings/${selectedSemester}`)),
                get(ref(db, 'users')),
                get(ref(db, 'coursePaths'))
            ]);

            // --- Deadline Logic ---
            const eventMap = new Map<string, {date: string, id: string}>();
            if (eventsSnapshot.exists()) { 
                Object.entries(eventsSnapshot.val()).forEach(([id, event]:[string, any]) => {
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

            // --- Course Path Logic ---
            const intakeCoursePaths = Object.values(coursePathsSnap.val() as Record<string, CoursePath>).filter(p => p.intakeId === semesterData.intakeId);
            const courseIdsInSemester = new Set<string>();
            const programmeTuitionStatus = new Map<string, boolean>();

            intakeCoursePaths.forEach(path => {
                const programme = allProgrammes.find(p => p.id === path.programmeId);
                if (programme?.tuitionFee && programme.tuitionFee > 0) {
                    programmeTuitionStatus.set(path.programmeId, true);
                } else {
                    programmeTuitionStatus.set(path.programmeId, false);
                }

                if (path.semesters && path.semesters[selectedSemester]) {
                    path.semesters[selectedSemester].courses.forEach(courseId => courseIdsInSemester.add(courseId));
                }
            });

            const userMap = new Map<string, string>();
            if (usersSnap.exists()) { Object.entries(usersSnap.val()).forEach(([uid, userData]: [string, any]) => userMap.set(uid, userData.name)); }

            const coursesForSem = Array.from(courseIdsInSemester).map(id => {
                const courseData = allCourses[id];
                return courseData ? { ...courseData, id, lecturerName: userMap.get(courseData.lecturerId) || 'N/A'} : null;
            }).filter(Boolean) as Course[];

            setPathCoursesForSemester(coursesForSem.sort((a, b) => a.code.localeCompare(b.code)));
            
            // Assume flat fee if any programme linked to this semester's intake has one. This is a simplification.
            const hasAnyFlatFee = Array.from(programmeTuitionStatus.values()).some(isFlat => isFlat);
            setIsFlatFee(hasAnyFlatFee);

            setAvailableForSemester(semesterOfferingsSnapshot.exists() ? semesterOfferingsSnapshot.val().courseIds : (hasAnyFlatFee ? Array.from(courseIdsInSemester) : []));
            
        } catch (error) { console.error('Error fetching data:', error); toast({ variant: 'destructive', title: 'Failed to load data' });
        } finally { setLoading(false); }
    }, [selectedSemester, semesters, toast, allPaymentPlans, allCourses, allProgrammes]);

    React.useEffect(() => {
        if(selectedSemester){ fetchDataForSemester();
        } else { setLoading(false); }
    }, [selectedSemester, fetchDataForSemester]);

    const handleToggleSemesterStatus = async (semester: Semester) => {
        let newStatus: Semester['status'];
        if (semester.status === 'Open') {
            newStatus = 'Closed';
        } else { // Covers 'Closed' and 'Archived'
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
        } catch (e: any) { toast({ variant: 'destructive', title: 'Update Failed', description: e.message }); }
    };
    
    const handleToggleLateRegistration = async (semester: Semester) => {
        const newStatus = !(semester.lateRegistrationActive ?? false);
        try { await update(ref(db, `semesters/${semester.id}`), { lateRegistrationActive: newStatus });
             toast({ variant: 'success', title: `Late Registration ${newStatus ? 'Enabled' : 'Disabled'}` });
        } catch (e: any) { toast({ variant: 'destructive', title: 'Update Failed', description: e.message }); }
    };

    const handleSelectCourse = (courseId: string) => {
        if (isFlatFee) return;
        setAvailableForSemester(prev => prev.includes(courseId) ? prev.filter(id => id !== courseId) : [...prev, courseId]);
    };

    const handleSaveChanges = async () => {
        const semester = semesters.find(s => s.id === selectedSemester);
        if (!semester) return;
        setSaving(true);
        try { 
            await set(ref(db, `semesterOfferings/${selectedSemester}`), { 
                courseIds: availableForSemester, 
                isOpen: semester.status === 'Open'
            });
            toast({ variant: 'success', title: 'Settings Saved', description: `Registration settings for ${semester.name} have been updated.` });
        } catch (error: any) { toast({ variant: 'destructive', title: 'Save Failed', description: error.message || 'An unexpected error occurred.' });
        } finally { setSaving(false); }
    };
    
    const handleSaveDeadline = async (title: string, eventId: string | null) => {
        if(!currentSemester) return;
        const date = deadlineDates[title];
        if (!date) { toast({ variant: 'destructive', title: 'Date required' }); return; }
        setSaving(true);
        const fullTitle = `${title} - ${currentSemester.name}`;
        try {
            if(eventId) {
                await update(ref(db, `calendarEvents/${eventId}`), { date: format(date, 'yyyy-MM-dd') });
            } else {
                const newEventRef = push(ref(db, 'calendarEvents'));
                await set(newEventRef, { title: fullTitle, date: format(date, 'yyyy-MM-dd'), semester: currentSemester.name });
            }
            toast({ title: "Deadline Updated" });
            setDeadlineDates(prev => ({...prev, [title]: undefined}));
            setEditingDeadlineId(null);
            fetchDataForSemester(); // Refetch data to update deadline list
        } catch (error: any) { 
            toast({ variant: 'destructive', title: 'Failed to save deadline' }); 
        } finally { 
            setSaving(false); 
        }
    }
    
    const totalSelected = availableForSemester.length;
    const currentSemester = semesters.find(s => s.id === selectedSemester);
    const semesterName = currentSemester?.name || '';
    const canSave = semesterDeadlines.every(d => d.date !== null);

    return (
        <div className="space-y-6">
        <Card className="shadow-lg">
            <CardHeader><CardTitle className="font-headline text-2xl">Registration Management</CardTitle><CardDescription>Create semesters, manage fees, and select which courses are available for student registration.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-end gap-2"><div className="flex-grow"><Label htmlFor="semester-select">Select Semester</Label>
                    <Select value={selectedSemester} onValueChange={setSelectedSemester}><SelectTrigger id="semester-select"><SelectValue placeholder="Select a semester..." /></SelectTrigger>
                        <SelectContent>{semesters.map(s => (<SelectItem key={s.id} value={s.id}><div className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", s.status === 'Open' ? 'bg-green-500' : s.status === 'Closed' ? 'bg-red-500' : 'bg-gray-400')}></span>{s.name} ({s.status})</div></SelectItem>))}</SelectContent>
                    </Select>
                </div>
                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                        <DialogTrigger asChild><Button variant="outline"><PlusCircle className="mr-2 h-4 w-4"/> New Semester</Button></DialogTrigger>
                        <DialogContent className="sm:max-w-xl"><CreateOrEditDialogContent editingSemester={null} onClose={() => setIsCreateDialogOpen(false)} onSaveSuccess={() => {refreshData(); setIsCreateDialogOpen(false);}} allPaymentPlans={allPaymentPlans} feeTemplates={feeTemplates} /></DialogContent>
                    </Dialog>
                </div>
                 {currentSemester && (
                    <div className="space-y-4"><div className='flex flex-wrap gap-2'>
                        <Button variant={currentSemester.status === 'Open' ? 'destructive' : 'default'} onClick={() => handleToggleSemesterStatus(currentSemester)} disabled={!canSave && currentSemester.status !== 'Open'} title={!canSave && currentSemester.status !== 'Open' ? 'Set payment deadlines first' : ''}>{currentSemester.status === 'Open' ? <PowerOff className="mr-2 h-4 w-4" /> : <Power className="mr-2 h-4 w-4" />}{currentSemester.status === 'Open' ? 'Close Registration' : 'Open Registration'}</Button>
                        {currentSemester.status === 'Open' && (<Button variant={currentSemester.lateRegistrationActive ? 'destructive' : 'secondary'} onClick={() => handleToggleLateRegistration(currentSemester)}><ShieldAlert className="mr-2 h-4 w-4" />{currentSemester.lateRegistrationActive ? 'Disable Late Registration' : 'Enable Late Registration'}</Button>)}
                        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                            <DialogTrigger asChild><Button variant="outline" onClick={() => setEditingSemester(currentSemester)}><Pencil className="mr-2 h-4 w-4" /> Edit</Button></DialogTrigger>
                            <DialogContent className="sm:max-w-xl"><CreateOrEditDialogContent editingSemester={editingSemester} onClose={() => setIsEditDialogOpen(false)} onSaveSuccess={() => {refreshData(); setIsEditDialogOpen(false);}} allPaymentPlans={allPaymentPlans} feeTemplates={feeTemplates} /></DialogContent>
                        </Dialog>
                    </div>
                        {!loading && !canSave && currentSemester.status !== 'Open' && (<Alert variant="destructive" className="mt-4"><AlertCircle className="h-4 w-4" /><AlertTitle>Action Required: Missing Payment Deadlines</AlertTitle><AlertDescription><p>You cannot open registration for <strong>{semesterName}</strong> until all payment deadlines for its linked payment plans are set in the Academic Calendar. The following are missing:</p><ul className="list-disc pl-5 mt-2 mb-3 text-xs">{semesterDeadlines.filter(d => d.date === null).map(d => <li key={d.title}>{d.title}</li>)}</ul><Button asChild variant="link" className="p-0 h-auto"><Link href="/admin/calendar">Go to Calendar to add deadlines</Link></Button></AlertDescription></Alert>)}
                    </div>
                 )}
            </CardContent>
        </Card>
        
        {currentSemester && (
            <Card>
                <Tabs defaultValue="courses">
                    <CardHeader>
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="courses">Available Courses</TabsTrigger>
                            <TabsTrigger value="finance">Financial Setup</TabsTrigger>
                        </TabsList>
                    </CardHeader>
                    <TabsContent value="courses">
                        <CardContent>
                            {isFlatFee && <Alert className="mb-4"><Info className="h-4 w-4"/><AlertDescription>At least one programme for this intake uses a flat semester fee. All courses below are mandatory and pre-selected.</AlertDescription></Alert>}
                            {loading ? (<div className="space-y-4 pt-4"><Skeleton className="h-40 w-full" /></div>
                            ) : pathCoursesForSemester.length > 0 ? (
                                <Table>
                                    <TableHeader><TableRow><TableHead className="w-[50px]">Enable</TableHead><TableHead>Course Code</TableHead><TableHead>Course Name</TableHead><TableHead>Assigned Lecturer</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {pathCoursesForSemester.map((course) => (
                                            <TableRow key={course.id} data-state={availableForSemester.includes(course.id) ? "selected" : undefined}>
                                                <TableCell><Checkbox id={`course-${course.id}`} checked={availableForSemester.includes(course.id)} onCheckedChange={() => handleSelectCourse(course.id)} disabled={!canSave && currentSemester?.status !== 'Open' || isFlatFee}/></TableCell>
                                                <TableCell className="font-medium">{course.code}</TableCell>
                                                <TableCell>{course.name}</TableCell>
                                                <TableCell>{course.lecturerName}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (<div className="py-16 text-center text-muted-foreground"><BookOpen className="mx-auto h-12 w-12" /><h3 className="mt-4 text-lg font-semibold">No Courses Found</h3><p className="mt-2 text-sm">No courses are defined in the course path for this semester.</p></div>)}
                        </CardContent>
                        <CardFooter className="flex justify-end items-center gap-4 border-t pt-6">
                            <div className="text-sm text-muted-foreground"><span className="font-bold text-foreground">{totalSelected}</span> course(s) selected for registration</div>
                            <Button onClick={handleSaveChanges} disabled={saving || loading || (!canSave && currentSemester?.status !== 'Open')}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{saving ? 'Saving...' : 'Save Changes'}</Button>
                        </CardFooter>
                    </TabsContent>
                    <TabsContent value="finance">
                        <CardContent className="space-y-4">
                             <div className="grid md:grid-cols-2 gap-6">
                                {['Mandatory', 'Optional'].map(type => {
                                    const isMandatory = type === 'Mandatory';
                                    const fees = isMandatory ? currentSemester?.mandatoryFees : currentSemester?.optionalFees;
                                    return (
                                        <div key={type}>
                                            <h4 className="font-semibold mb-2">{type} Fees</h4>
                                            <div className="border rounded-md">
                                            {fees && Object.keys(fees).length > 0 ? Object.values(fees).map((fee, index) => (
                                                <div key={index} className={`flex justify-between items-center p-3 text-sm ${index < Object.keys(fees).length - 1 ? 'border-b' : ''}`}>
                                                    <span>{fee.name}</span>
                                                    <span className="font-medium">ZMW {fee.amount.toFixed(2)}</span>
                                                </div>
                                            )) : <p className="text-xs text-muted-foreground text-center p-4">No {type.toLowerCase()} fees for this semester.</p>}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                            <Separator className="my-6"/>
                             <div>
                                <h4 className="font-semibold">Payment Plans & Deadlines</h4>
                                <p className="text-sm text-muted-foreground">Deadlines are set in the Academic Calendar.</p>
                            </div>
                            {semesterDeadlines.length > 0 ? (<div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">{semesterDeadlines.map(({title, date, eventId}) => {
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
                            )
                        })}</div>
                        ) : (<Alert variant="default"><Info className="h-4 w-4"/><AlertTitle>No Payment Plans Linked</AlertTitle><AlertDescription>There are no payment plans linked to this semester, so no deadlines are required.</AlertDescription></Alert>)}
                        </CardContent>
                         <CardFooter className="flex justify-end"><Button variant="outline" asChild><Link href="/admin/calendar"><CalendarIcon className="mr-2 h-4 w-4" /> Manage in Calendar</Link></Button></CardFooter>
                    </TabsContent>
                </Tabs>
            </Card>
        )}
        </div>
    );
}
