'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, Route, Info, Power, PowerOff, ShieldAlert, Pencil, PlusCircle, Calendar as CalendarIcon, Trash2, BookCopy, UserPlus, History } from 'lucide-react';
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
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

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
                    <PopoverContent className="w-auto p-0"><Calendar mode="range" selected={semesterDates} onSelect={setSemesterDates} numberOfMonths={2} /></PopoverContent></Popover>
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
    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
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
                                        return (
                                            <Card key={programme.id} className="bg-muted/50 mb-4">
                                                <CardHeader><CardTitle className="text-base">{programme.name}</CardTitle></CardHeader>
                                                <CardContent className="space-y-4">
                                                    {Object.entries(path.semesters).map(([semId, semData]) => {
                                                        const semDetails = semesters.find(s => s.id === semId);
                                                        if (!semDetails) return null;
                                                        const isActive = !!activePathSemesters[path.id]?.[semId]?.active;
                                                        return (
                                                            <div key={semId} className="p-4 border rounded-lg bg-card flex flex-col gap-4">
                                                                <div className="flex justify-between items-center">
                                                                    <Label className="font-bold">{semDetails.name}</Label>
                                                                    <div className="flex items-center gap-4">
                                                                        <span className={cn("text-[10px] font-bold uppercase", isActive ? "text-green-600" : "text-muted-foreground")}>{isActive ? "Active" : "Inactive"}</span>
                                                                        <Switch checked={isActive} onCheckedChange={() => handleToggleSemester(path.id, semId)} />
                                                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteSemester(semId)}><Trash2 className="h-4 w-4"/></Button>
                                                                    </div>
                                                                </div>
                                                                <div className="text-sm text-muted-foreground">{(semData.courses || []).map(cid => allCourses[cid]?.code).join(', ')}</div>
                                                                <div className="flex gap-2 pt-2 border-t">
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
        </div>
    );
}
