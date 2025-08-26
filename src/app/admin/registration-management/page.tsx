
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, History, ShieldAlert, Pencil, PlusCircle, Calendar as CalendarIcon, FileText, Check, Trash2, Power, PowerOff, Info, AlertCircle } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

// --- TYPE DEFINITIONS ---
type Fee = { id: string; name: string; amount: number; };
type FeeTemplate = { id: string; name: string; amount: number; type: 'Mandatory' | 'Optional'; };
type PaymentPlan = { id: string; name: string; installments: number; installmentPercentages: number[]; archived?: boolean; };
type Semester = { id: string; name: string; status: 'Open' | 'Closed' | 'Archived'; lateRegistrationActive?: boolean; startDate?: string; endDate?: string; paymentPlanIds?: Record<string, boolean>; mandatoryFees?: Record<string, Omit<Fee, 'id'>>; optionalFees?: Record<string, Omit<Fee, 'id'>>; };


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
    const { toast } = useToast();
    
    React.useEffect(() => {
        if (editingSemester) {
            setSemesterNameInput(editingSemester.name || '');
            setSemesterDates({
                from: editingSemester.startDate ? parseISO(editingSemester.startDate) : undefined,
                to: editingSemester.endDate ? parseISO(editingSemester.endDate) : undefined
            });
        } else {
             setSemesterNameInput('');
             setSemesterDates(undefined);
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
            </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSaveSemester} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{editingSemester ? 'Save Changes' : 'Create Semester'}</Button></DialogFooter>
        </>
    );
}

function SetFeesDialogContent({ semester, onClose, onSaveSuccess }: { semester: Semester; onClose: () => void; onSaveSuccess: () => void; }) {
    const [saving, setSaving] = React.useState(false);
    const [feeTemplates, setFeeTemplates] = React.useState<FeeTemplate[]>([]);
    const [mandatoryFees, setMandatoryFees] = React.useState<Record<string, Omit<Fee, 'id'>>>({});
    const [optionalFees, setOptionalFees] = React.useState<Record<string, Omit<Fee, 'id'>>>({});
    const [isFeeDialogOpen, setIsFeeDialogOpen] = React.useState(false);
    const [selectedFeeTemplate, setSelectedFeeTemplate] = React.useState('');
    const [feeAmount, setFeeAmount] = React.useState('');
    const [currentFeeType, setCurrentFeeType] = React.useState<'Mandatory' | 'Optional'>('Mandatory');

    const { toast } = useToast();
    
    React.useEffect(() => {
        setMandatoryFees(semester.mandatoryFees || {});
        setOptionalFees(semester.optionalFees || {});
        
        const feeTemplatesRef = ref(db, 'settings/feeTemplates');
        onValue(feeTemplatesRef, (snapshot) => {
             if(snapshot.exists()) {
                const data = snapshot.val();
                setFeeTemplates(Object.keys(data).map(id => ({ id, ...data[id] })));
            }
        });
    }, [semester]);
    
     const handleImportFee = () => {
        if (!selectedFeeTemplate || !feeAmount) { toast({ variant: 'destructive', title: 'Missing Fee Details' }); return; }
        const template = feeTemplates.find(t => t.id === selectedFeeTemplate);
        if (!template) return;
        
        const newFee = { name: template.name, amount: parseFloat(feeAmount) };
        const feeId = push(ref(db, 'semesters')).key!;
        
        if (currentFeeType === 'Mandatory') {
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
            setMandatoryFees(prev => { const newFees = { ...prev }; delete newFees[feeId]; return newFees; });
        } else {
            setOptionalFees(prev => { const newFees = { ...prev }; delete newFees[feeId]; return newFees; });
        }
    };
    
    const handleSaveFees = async () => {
        setSaving(true);
        try {
             await update(ref(db, `semesters/${semester.id}`), { mandatoryFees, optionalFees });
             toast({ variant: 'success', title: 'Fees Updated' });
             onSaveSuccess();
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        } finally {
            setSaving(false);
        }
    };


    const renderFeeSection = (isMandatory: boolean) => {
        const fees = isMandatory ? mandatoryFees : optionalFees;
        const availableTemplates = feeTemplates.filter(t => t.type === (isMandatory ? 'Mandatory' : 'Optional'));
        return (
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <h4 className="font-semibold">{isMandatory ? 'Mandatory Fees' : 'Optional Fees'}</h4>
                     <Dialog open={isFeeDialogOpen && currentFeeType === (isMandatory ? 'Mandatory' : 'Optional')} onOpenChange={(open) => {if(!open) setIsFeeDialogOpen(false)}}>
                        <DialogTrigger asChild>
                            <Button size="sm" variant="outline" onClick={() => { setCurrentFeeType(isMandatory ? 'Mandatory' : 'Optional'); setIsFeeDialogOpen(true); }}><PlusCircle className="h-4 w-4 mr-1"/>Import Fee</Button>
                        </DialogTrigger>
                        <DialogContent onInteractOutside={(e) => e.stopPropagation()}>
                            <DialogHeader>
                                <DialogTitle>Import {isMandatory ? 'Mandatory' : 'Optional'} Fee Template</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-1"><Label>Fee Name</Label>
                                    <Select value={selectedFeeTemplate} onValueChange={(val) => {setSelectedFeeTemplate(val); setFeeAmount(String(feeTemplates.find(t => t.id === val)?.amount || ''));}}>
                                        <SelectTrigger><SelectValue placeholder="Select a fee template..."/></SelectTrigger>
                                        <SelectContent>{availableTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1"><Label>Amount (ZMW)</Label><Input type="number" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} placeholder="e.g., 250" /></div>
                            </div>
                            <DialogFooter>
                                <Button variant="ghost" onClick={() => setIsFeeDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleImportFee} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Add Fee</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
                <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="w-[50px]"></TableHead></TableRow></TableHeader>
                    <TableBody>{Object.keys(fees).length > 0 ? Object.entries(fees).map(([id, fee]) =>
                        <TableRow key={id}><TableCell>{fee.name}</TableCell><TableCell className="text-right">{fee.amount.toFixed(2)}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleDeleteFee(id, isMandatory)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell></TableRow>
                    ) : <TableRow><TableCell colSpan={3} className="text-center h-24">No fees added.</TableCell></TableRow>}
                    </TableBody>
                </Table>
            </div>
        )
    }

    return (
        <>
            <DialogHeader><DialogTitle>Set Fees for {semester.name}</DialogTitle></DialogHeader>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-4 py-4">{renderFeeSection(true)}{renderFeeSection(false)}</div>
            <DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSaveFees} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Save Fees</Button></DialogFooter>
        </>
    );
}

// --- MAIN PAGE COMPONENT ---
export default function RegistrationManagementPage() {
    const [loading, setLoading] = React.useState(true);
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [allPaymentPlans, setAllPaymentPlans] = React.useState<PaymentPlan[]>([]);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [editingSemester, setEditingSemester] = React.useState<Semester | null>(null);

    const [isPlansDialogOpen, setIsPlansDialogOpen] = React.useState(false);
    const [isFeesDialogOpen, setIsFeesDialogOpen] = React.useState(false);
    const [selectedSemesters, setSelectedSemesters] = React.useState<Record<string, boolean>>({});

    const { toast } = useToast();

    React.useEffect(() => {
        const refs = [ ref(db, 'semesters'), ref(db, 'settings/paymentPlans') ];
        const unsubs = refs.map((r, i) => onValue(r, (snapshot) => {
            const data = snapshot.val() || {};
            switch(i) {
                case 0: setSemesters(Object.keys(data).map(id => ({ id, ...data[id] })).sort((a,b) => b.name.localeCompare(a.name))); break;
                case 1: setAllPaymentPlans(Object.keys(data).map(id => ({ id, ...data[id] }))); break;
            }
        }));
        setLoading(false);
        return () => unsubs.forEach(unsub => unsub());
    }, []);
    
    const openEditDialog = (semester: Semester) => {
        setEditingSemester(semester);
        setIsCreateDialogOpen(true); // Re-use the create dialog for editing
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

    return (
        <div className="space-y-6">
        <Card className="shadow-lg">
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle className="font-headline text-2xl">Semester Management</CardTitle>
                    <CardDescription>Create academic semesters, link payment plans, and set applicable fees.</CardDescription>
                </div>
                 <Dialog open={isCreateDialogOpen} onOpenChange={(open) => { setIsCreateDialogOpen(open); if (!open) setEditingSemester(null);}}>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/> New Semester</Button></DialogTrigger>
                    <DialogContent className="sm:max-w-xl"><CreateOrEditDialogContent editingSemester={editingSemester} onClose={() => {setIsCreateDialogOpen(false); setEditingSemester(null)}} onSaveSuccess={() => {setIsCreateDialogOpen(false); setEditingSemester(null);}} allPaymentPlans={allPaymentPlans} feeTemplates={[]} /></DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                 {loading ? (<div className="space-y-4 pt-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
                ) : semesters.length > 0 ? (
                    <div className="space-y-4">
                        {semesters.map(semester => (
                            <Card key={semester.id}>
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle>{semester.name}</CardTitle>
                                            <CardDescription>
                                                <span className="mr-4">Status: <Badge variant={semester.status === 'Open' ? 'default' : 'secondary'}>{semester.status}</Badge></span>
                                                <span>Late Reg: <Badge variant={semester.lateRegistrationActive ? 'default' : 'secondary'}>{semester.lateRegistrationActive ? 'Active' : 'Inactive'}</Badge></span>
                                            </CardDescription>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" onClick={() => handleToggleSemesterStatus(semester)}>{semester.status === 'Open' ? <PowerOff className="mr-2 h-4"/> : <Power className="mr-2 h-4"/>}{semester.status === 'Open' ? 'Close' : 'Open'}</Button>
                                            <Button variant="outline" size="sm" onClick={() => openEditDialog(semester)}><Pencil className="mr-2 h-4"/>Edit Details</Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardFooter className="flex-col items-start gap-4 bg-muted/50 p-4">
                                     <div className="w-full">
                                        <h4 className="text-sm font-semibold mb-2">Configuration</h4>
                                        <div className="flex gap-2">
                                            <Button size="sm" onClick={() => {setEditingSemester(semester); setIsPlansDialogOpen(true)}}>Manage Payment Plans</Button>
                                            <Button size="sm" onClick={() => {setEditingSemester(semester); setIsFeesDialogOpen(true)}}>Set Semester Fees</Button>
                                            <Button size="sm" variant="secondary" onClick={() => handleToggleLateRegistration(semester)}><ShieldAlert className="mr-2 h-4"/>{semester.lateRegistrationActive ? 'Disable' : 'Enable'} Late Fee</Button>
                                        </div>
                                     </div>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                ) : (<p className="text-center py-8 text-muted-foreground">No semesters created yet.</p>)}
            </CardContent>
        </Card>
        
        <Dialog open={isPlansDialogOpen} onOpenChange={setIsPlansDialogOpen}>
            {editingSemester && (
                <DialogContent>
                    <DialogHeader><DialogTitle>Link Payment Plans for {editingSemester.name}</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-2 max-h-96 overflow-y-auto">
                        {allPaymentPlans.filter(p => !p.archived).map(plan => (
                             <div key={plan.id} className="flex items-center gap-2 rounded-md border p-3">
                                <Checkbox id={`plan-${plan.id}`} checked={!!(editingSemester.paymentPlanIds && editingSemester.paymentPlanIds[plan.id])} onCheckedChange={(checked) => {
                                    const newPlans = { ...editingSemester.paymentPlanIds };
                                    if(checked) newPlans[plan.id] = true;
                                    else delete newPlans[plan.id];
                                    setEditingSemester({...editingSemester, paymentPlanIds: newPlans});
                                }}/>
                                <Label htmlFor={`plan-${plan.id}`}>{plan.name} ({plan.installments} Installments)</Label>
                            </div>
                        ))}
                    </div>
                    <DialogFooter><Button onClick={async () => { await update(ref(db, `semesters/${editingSemester.id}`), { paymentPlanIds: editingSemester.paymentPlanIds }); toast({title: "Updated Successfully"}); setIsPlansDialogOpen(false);}}>Save</Button></DialogFooter>
                </DialogContent>
            )}
        </Dialog>
        
         <Dialog open={isFeesDialogOpen} onOpenChange={setIsFeesDialogOpen}>
            {editingSemester && (
                <DialogContent className="sm:max-w-2xl"><SetFeesDialogContent semester={editingSemester} onClose={() => setIsFeesDialogOpen(false)} onSaveSuccess={() => {setIsFeesDialogOpen(false);}} /></DialogContent>
            )}
        </Dialog>
        </div>
    );
}
