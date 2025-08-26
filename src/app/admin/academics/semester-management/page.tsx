'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle, Trash2, Calendar as CalendarIcon, Info, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, onValue, set, push, remove, update } from 'firebase/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { format, parseISO } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


type Intake = { id: string; name: string; };
type Semester = { id: string; name: string; year: number; semesterInYear: number; intakeId: string; status: 'Open' | 'Closed' | 'Archived'; lateRegistrationActive?: boolean; startDate?: string; endDate?: string; };
type Fee = { id: string; name: string; amount: number; };
type FeeTemplate = { id: string; name: string; amount: number; type: 'Mandatory' | 'Optional'; };
type PaymentPlan = { id: string; name: string; installments: number; installmentPercentages: number[]; archived?: boolean; };

// --- DIALOG CONTENT COMPONENT ---
type CreateOrEditDialogContentProps = {
    editingSemester: Semester | null;
    intakes: Intake[];
    onClose: () => void;
    onSaveSuccess: () => void;
};

function CreateOrEditDialogContent({ editingSemester, intakes, onClose, onSaveSuccess }: CreateOrEditDialogContentProps) {
    const [saving, setSaving] = React.useState(false);
    const [intakeId, setIntakeId] = React.useState('');
    const [year, setYear] = React.useState<number | string>('');
    const [semesterInYear, setSemesterInYear] = React.useState<number | string>('');
    const [semesterDates, setSemesterDates] = React.useState<DateRange | undefined>();

    const { toast } = useToast();
    
    React.useEffect(() => {
        if (editingSemester) {
            setIntakeId(editingSemester.intakeId);
            setYear(editingSemester.year);
            setSemesterInYear(editingSemester.semesterInYear);
            setSemesterDates({
                from: editingSemester.startDate ? parseISO(editingSemester.startDate) : undefined,
                to: editingSemester.endDate ? parseISO(editingSemester.endDate) : undefined
            });
        } else {
             setIntakeId('');
             setYear('');
             setSemesterInYear('');
             setSemesterDates(undefined);
        }
    }, [editingSemester]);

    const handleSaveSemester = async () => {
        const intakeName = intakes.find(i => i.id === intakeId)?.name;
        if (!intakeId || !year || !semesterInYear || !intakeName) { toast({ variant: 'destructive', title: 'Missing Semester Details'}); return; }
        setSaving(true);
        try {
            const semesterName = `${intakeName} Year ${year} Semester ${semesterInYear}`;
            const semesterData: Omit<Semester, 'id'> & { id?: string } = {
                ...(editingSemester || {}),
                name: semesterName,
                intakeId,
                year: Number(year),
                semesterInYear: Number(semesterInYear),
                status: editingSemester?.status || 'Closed',
                lateRegistrationActive: editingSemester?.lateRegistrationActive || false,
                startDate: semesterDates?.from ? format(semesterDates.from, 'yyyy-MM-dd') : undefined,
                endDate: semesterDates?.to ? format(semesterDates.to, 'yyyy-MM-dd') : undefined,
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
            <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1"><Label>Intake</Label><Select value={intakeId} onValueChange={setIntakeId}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{intakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label>Year</Label><Input type="number" min="1" value={year} onChange={e => setYear(Number(e.target.value))}/></div>
                <div className="space-y-1"><Label>Semester in Year</Label><Input type="number" min="1" max="3" value={semesterInYear} onChange={e => setSemesterInYear(Number(e.target.value))}/></div>
            </div>
            <div className="space-y-1"><Label>Semester Start & End Dates</Label>
                <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal", !semesterDates?.from && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{semesterDates?.from ? (semesterDates.to ? `${format(semesterDates.from, "PPP")} - ${format(semesterDates.to, "PPP")}` : format(semesterDates.from, "PPP")) : <span>Pick a date range</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" selected={semesterDates} onSelect={setSemesterDates} numberOfMonths={2} /></PopoverContent></Popover>
            </div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSaveSemester} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{editingSemester ? 'Save Changes' : 'Create Semester'}</Button></DialogFooter>
        </>
    );
}

// --- MAIN PAGE COMPONENT ---
export default function SemesterManagementPage() {
    const [intakes, setIntakes] = React.useState<Intake[]>([]);
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    // Dialog state
    const [isIntakeDialogOpen, setIsIntakeDialogOpen] = React.useState(false);
    const [intakeName, setIntakeName] = React.useState('');
    const [isSemesterDialogOpen, setIsSemesterDialogOpen] = React.useState(false);
    const [editingSemester, setEditingSemester] = React.useState<Semester | null>(null);

    const { toast } = useToast();

    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [intakesSnap, semestersSnap] = await Promise.all([
                get(ref(db, 'intakes')),
                get(ref(db, 'semesters'))
            ]);
            
            if (intakesSnap.exists()) { setIntakes(Object.keys(intakesSnap.val()).map(id => ({ id, ...intakesSnap.val()[id] })).sort((a,b) => b.name.localeCompare(a.name))); } else { setIntakes([]); }
            if (semestersSnap.exists()) { setSemesters(Object.keys(semestersSnap.val()).map(id => ({ id, ...semestersSnap.val()[id] })).sort((a,b) => b.name.localeCompare(a.name))); } else { setSemesters([]); }

        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Failed to load data.' });
        } finally {
            setLoading(false);
        }
    }, [toast]);
    
    React.useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    const openSemesterDialog = (semester: Semester | null) => {
        setEditingSemester(semester);
        setIsSemesterDialogOpen(true);
    };

    const handleSaveIntake = async () => {
        if (!intakeName.trim()) return;
        setSaving(true);
        try {
            await push(ref(db, 'intakes'), { name: intakeName.trim() });
            toast({ title: 'Intake created.' });
            setIntakeName('');
            setIsIntakeDialogOpen(false);
        } catch (e: any) { toast({ variant: 'destructive', title: 'Failed to save intake.' });
        } finally { setSaving(false); }
    };
    
    const handleDelete = async (type: 'intake' | 'semester', id: string) => {
        const path = type === 'intake' ? `intakes/${id}` : `semesters/${id}`;
        if (!window.confirm(`Are you sure you want to delete this ${type}? This may affect course paths and registrations.`)) return;
        try {
            await remove(ref(db, path));
            toast({ title: `${type.charAt(0).toUpperCase() + type.slice(1)} deleted.` });
        } catch (e) {
             toast({ variant: 'destructive', title: `Failed to delete ${type}.` });
        }
    }


    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline text-2xl">Semester Management</CardTitle>
                <CardDescription>Create and manage Intakes and their associated academic Semesters.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Intakes Section */}
                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <div><CardTitle>Intakes</CardTitle><CardDescription>Student intake periods, e.g., "2024JAN".</CardDescription></div>
                        <Dialog open={isIntakeDialogOpen} onOpenChange={setIsIntakeDialogOpen}>
                            <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4"/>New Intake</Button></DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>Create New Intake</DialogTitle></DialogHeader>
                                <div className="py-4"><Input placeholder="e.g., 2024JAN" value={intakeName} onChange={e => setIntakeName(e.target.value.toUpperCase())} /></div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsIntakeDialogOpen(false)}>Cancel</Button>
                                    <Button onClick={handleSaveIntake} disabled={saving}>{saving && <Loader2 className="animate-spin mr-2 h-4"/>}Create Intake</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Intake Name</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                            <TableBody>{intakes.map(i => (
                                <TableRow key={i.id}><TableCell>{i.name}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleDelete('intake', i.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell></TableRow>
                            ))}</TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Semesters Section */}
                 <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <div><CardTitle>Semesters</CardTitle><CardDescription>Academic semesters linked to an intake.</CardDescription></div>
                        <Button onClick={() => openSemesterDialog(null)}><PlusCircle className="mr-2 h-4"/> New Semester</Button>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Semester Name</TableHead><TableHead>Status</TableHead><TableHead>Dates</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                            <TableBody>{semesters.map(s => (
                                <TableRow key={s.id}>
                                    <TableCell>{s.name}</TableCell>
                                    <TableCell>{s.status}</TableCell>
                                    <TableCell>{s.startDate && s.endDate ? `${format(parseISO(s.startDate), 'PPP')} - ${format(parseISO(s.endDate), 'PPP')}` : 'N/A'}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => openSemesterDialog(s)}><Pencil className="h-4 w-4"/></Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete('semester', s.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                    </TableCell>
                                </TableRow>
                            ))}</TableBody>
                        </Table>
                    </CardContent>
                </Card>

                 <Dialog open={isSemesterDialogOpen} onOpenChange={() => setIsSemesterDialogOpen(false)}>
                    <DialogContent className="sm:max-w-3xl"><CreateOrEditDialogContent editingSemester={editingSemester} intakes={intakes} onClose={() => setIsSemesterDialogOpen(false)} onSaveSuccess={() => {fetchData(); setIsSemesterDialogOpen(false);}} /></DialogContent>
                </Dialog>

            </CardContent>
        </Card>
    );
}
