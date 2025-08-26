
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, Route, History, Info, Download, Power, PowerOff, ShieldAlert, Pencil, PlusCircle, Calendar as CalendarIcon, FileText, CheckCircle2, AlertCircle, Wallet, HandCoins, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth, createNotification, getAllStudentAndStaffIds } from '@/lib/firebase';
import { ref, get, set, onValue, update, push, remove } from 'firebase/database';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogClose, DialogFooter } from '@/components/ui/dialog';
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
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// --- TYPE DEFINITIONS ---
type Fee = { id: string; name: string; amount: number; };
type FeeTemplate = { id: string; name: string; amount: number; type: 'Mandatory' | 'Optional'; };
type PaymentPlan = { id: string; name: string; installments: number; installmentPercentages: number[]; archived?: boolean; };
type Semester = { id: string; name: string; status: 'Open' | 'Closed' | 'Archived'; lateRegistrationActive?: boolean; lateRegistrationFee?: number; startDate?: string; endDate?: string; paymentPlanIds?: Record<string, boolean>; mandatoryFees?: Record<string, Fee>; optionalFees?: Record<string, Fee>; };
type CalendarEvent = { id: string; title: string; date: string; };
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
};

function CreateOrEditDialogContent({ editingSemester, onClose, onSaveSuccess }: CreateOrEditDialogContentProps) {
    const [saving, setSaving] = React.useState(false);
    const [semesterNameInput, setSemesterNameInput] = React.useState('');
    const [semesterDates, setSemesterDates] = React.useState<DateRange | undefined>();
    const [lateFee, setLateFee] = React.useState<number | undefined>();
    const { toast } = useToast();
    
    React.useEffect(() => {
        if (editingSemester) {
            setSemesterNameInput(editingSemester.name || '');
            setSemesterDates({
                from: editingSemester.startDate ? parseISO(editingSemester.startDate) : undefined,
                to: editingSemester.endDate ? parseISO(editingSemester.endDate) : undefined
            });
            setLateFee(editingSemester.lateRegistrationFee);
        } else {
             setSemesterNameInput('');
             setSemesterDates(undefined);
             setLateFee(0);
        }
    }, [editingSemester]);


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
                lateRegistrationFee: lateFee,
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
    
    return (
        <><DialogHeader><DialogTitle>{editingSemester ? 'Edit' : 'Create'} Semester</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="space-y-1"><Label htmlFor="semester-name">Semester Name</Label><Input id="semester-name" value={semesterNameInput} onChange={(e) => setSemesterNameInput(e.target.value)} placeholder="e.g., 2024JAN Year 1 Semester 1"/></div>
                <div className="space-y-1"><Label htmlFor="semester-dates">Semester Start & End Dates</Label>
                    <Popover><PopoverTrigger asChild><Button id="semester-dates" variant="outline" className={cn("w-full justify-start text-left font-normal", !semesterDates?.from && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{semesterDates?.from ? (semesterDates.to ? `${format(semesterDates.from, "PPP")} - ${format(semesterDates.to, "PPP")}` : format(semesterDates.from, "PPP")) : <span>Pick a date range</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" selected={semesterDates} onSelect={setSemesterDates} numberOfMonths={2} /></PopoverContent></Popover>
                </div>
                 <div className="space-y-1">
                    <Label htmlFor="late-fee">Late Registration Fee (ZMW)</Label>
                    <Input id="late-fee" type="number" value={lateFee ?? ''} onChange={(e) => setLateFee(Number(e.target.value))} />
                </div>
            </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSaveSemester} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{editingSemester ? 'Save Changes' : 'Create Semester'}</Button></DialogFooter>
        </>
    );
}

// --- MAIN PAGE COMPONENT ---
export default function RegistrationManagementPage() {
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [allPaymentPlans, setAllPaymentPlans] = React.useState<PaymentPlan[]>([]);
    const [feeTemplates, setFeeTemplates] = React.useState<FeeTemplate[]>([]);

    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
    const [editingSemester, setEditingSemester] = React.useState<Semester | null>(null);

    const [isFeesDialogOpen, setIsFeesDialogOpen] = React.useState(false);
    const [isPlansDialogOpen, setIsPlansDialogOpen] = React.useState(false);
    const [isDeadlinesDialogOpen, setIsDeadlinesDialogOpen] = React.useState(false);
    
    const [semesterDeadlines, setSemesterDeadlines] = React.useState<DeadlineInfo[]>([]);
    const [deadlineDates, setDeadlineDates] = React.useState<Record<string, Date | undefined>>({});
    const [editingDeadlineId, setEditingDeadlineId] = React.useState<string | null>(null);

    const { toast } = useToast();
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    const [semesterCourses, setSemesterCourses] = React.useState<Record<string, Course[]>>({});

    React.useEffect(() => {
        const refs = [ ref(db, 'semesters'), ref(db, 'settings/paymentPlans'), ref(db, 'settings/feeTemplates'), ref(db, 'courses'), ref(db, 'semesterOfferings') ];
        const unsubs = refs.map((r, i) => onValue(r, (snapshot) => {
            const data = snapshot.val() || {};
            switch(i) {
                case 0: 
                    const semesterList = Object.keys(data).map(id => ({ id, ...data[id] })).sort((a,b) => b.name.localeCompare(a.name));
                    setSemesters(semesterList);
                    if (semesterList.length > 0 && !editingSemester) {
                        setEditingSemester(semesterList[0]);
                    }
                    break;
                case 1: setAllPaymentPlans(Object.keys(data).map(id => ({ id, ...data[id] }))); break;
                case 2: setFeeTemplates(Object.keys(data).map(id => ({ id, ...data[id] }))); break;
                case 3: 
                    const courseData = data;
                    get(ref(db, 'semesterOfferings')).then(offeringSnap => {
                        const offerings = offeringSnap.val() || {};
                        const semCourses: Record<string, Course[]> = {};
                        for (const semName in offerings) {
                             const courseIds = offerings[semName].courseIds || [];
                             semCourses[semName] = courseIds.map((cid: string) => courseData[cid] ? { id: cid, ...courseData[cid] } : null).filter(Boolean);
                        }
                        setSemesterCourses(semCourses);
                    });
                    break;
            }
        }));
        setLoading(false);
        return () => unsubs.forEach(unsub => unsub());
    }, []);
    
    const openEditDialog = (semester: Semester) => {
        setEditingSemester(semester);
        setIsEditDialogOpen(true);
    };

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
        } catch (e: any) { toast({ variant: 'destructive', title: 'Update Failed', description: e.message }); }
    };
    
    const handleToggleLateRegistration = async (semester: Semester) => {
        const newStatus = !(semester.lateRegistrationActive ?? false);
        try { await update(ref(db, `semesters/${semester.id}`), { lateRegistrationActive: newStatus });
             toast({ variant: 'success', title: `Late Registration ${newStatus ? 'Enabled' : 'Disabled'}` });
        } catch (e: any) { toast({ variant: 'destructive', title: 'Update Failed', description: e.message }); }
    };
    
    const openDeadlineDialog = async (semester: Semester) => {
        setEditingSemester(semester);
        setEditingDeadlineId(null); 
        setDeadlineDates({});
        
        const eventsSnapshot = await get(ref(db, 'calendarEvents'));
        const eventMap = new Map<string, {date: string, id: string}>();
        if (eventsSnapshot.exists()) { 
            Object.entries(eventsSnapshot.val()).forEach(([id, event]:[string, any]) => {
                eventMap.set(event.title.trim(), { date: event.date, id });
            });
        }
        const linkedPlanIds = Object.keys(semester.paymentPlanIds || {});
        const linkedPlans = allPaymentPlans.filter(p => linkedPlanIds.includes(p.id));
        const required: DeadlineInfo[] = [];
        linkedPlans.forEach(plan => {
             for (let i = 0; i < plan.installments; i++) {
                const title = `${plan.name} (${getOrdinalSuffix(i + 1)} Installment) Deadline - ${semester.name}`;
                const existing = eventMap.get(title.trim());
                required.push({ title: title.replace(` - ${semester.name}`, ''), date: existing?.date || null, eventId: existing?.id || null });
            }
        })
        setSemesterDeadlines(required);
        setIsDeadlinesDialogOpen(true);
    };

    const handleSaveDeadline = async (title: string, eventId: string | null) => {
        if(!editingSemester) return;
        const date = deadlineDates[title];
        if (!date) { toast({ variant: 'destructive', title: 'Date required' }); return; }
        setSaving(true);
        const fullTitle = `${title} - ${editingSemester.name}`;
        try {
            if (eventId) {
                await update(ref(db, `calendarEvents/${eventId}`), { date: format(date, 'yyyy-MM-dd') });
            } else {
                const newEventRef = push(ref(db, 'calendarEvents'));
                await set(newEventRef, { title: fullTitle, date: format(date, 'yyyy-MM-dd'), semester: editingSemester.name });
            }
            toast({ title: "Deadline Updated" });
            setDeadlineDates(prev => ({...prev, [title]: undefined}));
            setEditingDeadlineId(null);
            openDeadlineDialog(editingSemester); // Re-fetch
        } catch (error: any) { 
            toast({ variant: 'destructive', title: 'Failed to save deadline' }); 
        } finally { 
            setSaving(false); 
        }
    }

    return (
        <div className="space-y-6">
        <Card className="shadow-lg">
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle className="font-headline text-2xl">Semester Management</CardTitle>
                    <CardDescription>Create academic semesters, link payment plans, and set applicable fees.</CardDescription>
                </div>
                 <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/> New Semester</Button></DialogTrigger>
                    <DialogContent className="sm:max-w-xl"><CreateOrEditDialogContent editingSemester={null} onClose={() => setIsCreateDialogOpen(false)} onSaveSuccess={() => {setIsCreateDialogOpen(false);}} /></DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                 {loading ? (<div className="space-y-4 pt-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}</div>
                ) : semesters.length > 0 ? (
                    <Accordion type="multiple" defaultValue={semesters.map(s => s.id)} className="w-full space-y-4">
                        {semesters.map(semester => {
                             const canSave = true; // Simplified for now
                             return (
                            <Card key={semester.id}>
                                <AccordionItem value={semester.id} className="border-b-0">
                                <AccordionTrigger className="p-6 hover:no-underline [&[data-state=open]]:border-b">
                                    <div className="flex justify-between items-start w-full">
                                        <div>
                                            <CardTitle>{semester.name}</CardTitle>
                                            <CardDescription>
                                                <span className="mr-4">Status: <Badge variant={semester.status === 'Open' ? 'default' : 'secondary'}>{semester.status}</Badge></span>
                                                <span>Late Reg: <Badge variant={semester.lateRegistrationActive ? 'default' : 'secondary'}>{semester.lateRegistrationActive ? 'Active' : 'Inactive'}</Badge></span>
                                            </CardDescription>
                                        </div>
                                        <div className="flex gap-2 self-start sm:self-center">
                                            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openEditDialog(semester); }}><Pencil className="mr-2 h-4"/>Edit</Button>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                 <AccordionContent className="px-6 pb-6 space-y-4">
                                     <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                         {/* Courses */}
                                         <div className="space-y-2">
                                             <h4 className="font-semibold">Courses for Registration</h4>
                                             <div className="text-xs text-muted-foreground p-2 border rounded-md max-h-40 overflow-y-auto space-y-1">
                                                 {(semesterCourses[semester.name] || []).length > 0 ? 
                                                    (semesterCourses[semester.name] || []).map(c => <p key={c.id}>{c.code} - {c.name}</p>) :
                                                    <p>No courses selected.</p>
                                                 }
                                             </div>
                                         </div>
                                         {/* Fees */}
                                          <div className="space-y-2">
                                             <h4 className="font-semibold">Fees</h4>
                                             <p className="text-xs text-muted-foreground">Late Reg Fee: <strong>ZMW {(semester.lateRegistrationFee || 0).toFixed(2)}</strong></p>
                                             <div className="text-xs text-muted-foreground p-2 border rounded-md max-h-40 overflow-y-auto space-y-1">
                                                {Object.values(semester.mandatoryFees || {}).map(f => <p key={f.name}>Mandatory: {f.name} (ZMW {f.amount.toFixed(2)})</p>)}
                                                {Object.values(semester.optionalFees || {}).map(f => <p key={f.name}>Optional: {f.name} (ZMW {f.amount.toFixed(2)})</p>)}
                                                 {Object.keys(semester.mandatoryFees || {}).length === 0 && Object.keys(semester.optionalFees || {}).length === 0 && <p>No fees set.</p>}
                                             </div>
                                         </div>
                                         {/* Deadlines */}
                                          <div className="space-y-2">
                                             <h4 className="font-semibold">Payment Deadlines</h4>
                                              <div className="text-xs text-muted-foreground p-2 border rounded-md max-h-40 overflow-y-auto space-y-1">
                                                <p>Configure deadlines via the "Set Deadlines" button in the edit dialog.</p>
                                             </div>
                                         </div>
                                     </div>
                                </AccordionContent>
                                </AccordionItem>
                            </Card>
                             )
                        })}
                    </Accordion>
                ) : (<p className="text-center py-8 text-muted-foreground">No semesters created yet.</p>)}
            </CardContent>
        </Card>
        
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
             {editingSemester && <DialogContent className="sm:max-w-4xl"><CreateOrEditDialogContent editingSemester={editingSemester} onClose={() => setIsEditDialogOpen(false)} onSaveSuccess={() => {setIsEditDialogOpen(false);}} allPaymentPlans={allPaymentPlans} feeTemplates={feeTemplates} /></DialogContent>}
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
