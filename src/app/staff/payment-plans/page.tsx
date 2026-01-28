
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle, Trash2, Percent, Library, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase';
import { ref, onValue, set, push, update } from 'firebase/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';

type PaymentPlan = {
    id: string;
    name: string;
    installments: number;
    installmentPercentages: number[];
    archived?: boolean;
}

type Semester = {
    id: string;
    name: string;
    status: 'Open' | 'Closed' | 'Archived';
    paymentPlanIds?: Record<string, boolean>;
};

type UserData = {
    role: 'Staff';
    subRoles?: string[];
}


export default function PaymentPlansPage() {
    const [paymentPlans, setPaymentPlans] = React.useState<PaymentPlan[]>([]);
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [userData, setUserData] = React.useState<UserData | null>(null);
    
    // Dialog state
    const [isPlanDialogOpen, setIsPlanDialogOpen] = React.useState(false);
    const [planName, setPlanName] = React.useState('');
    const [planInstallments, setPlanInstallments] = React.useState(1);
    const [percentages, setPercentages] = React.useState<number[]>([100]);

    // Add to semester dialog state
    const [isAddToSemesterOpen, setIsAddToSemesterOpen] = React.useState(false);
    const [selectedPlan, setSelectedPlan] = React.useState<PaymentPlan | null>(null);
    const [selectedSemesters, setSelectedSemesters] = React.useState<Record<string, boolean>>({});

    const { toast } = useToast();

     React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setCurrentUser(user);
                const userRef = ref(db, `users/${user.uid}`);
                const userUnsub = onValue(userRef, (snapshot) => {
                    if (snapshot.exists()) {
                        setUserData(snapshot.val());
                    } else {
                        setUserData(null);
                    }
                });
                return () => userUnsub();
            }
        });
        return () => unsubscribe();
    }, []);

    React.useEffect(() => {
        if (!userData || !(userData.subRoles?.includes('Accountant'))) {
             setLoading(false);
             return;
        }

        const plansRef = ref(db, 'settings/paymentPlans');
        const unsubPlans = onValue(plansRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setPaymentPlans(Object.keys(data).map(id => ({ id, ...data[id] })));
            } else {
                setPaymentPlans([]);
            }
            setLoading(false);
        });

        const semestersRef = ref(db, 'semesters');
        const unsubSemesters = onValue(semestersRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setSemesters(Object.keys(data).map(id => ({ id, ...data[id] })).filter(s => s.status !== 'Archived'));
            } else {
                setSemesters([]);
            }
        });

        return () => {
            unsubPlans();
            unsubSemesters();
        };
    }, [userData]);
    
    const openAddToSemesterDialog = (plan: PaymentPlan) => {
        setSelectedPlan(plan);
        const initialSelections: Record<string, boolean> = {};
        semesters.forEach(semester => {
            if (semester.paymentPlanIds && semester.paymentPlanIds[plan.id]) {
                initialSelections[semester.id] = true;
            }
        });
        setSelectedSemesters(initialSelections);
        setIsAddToSemesterOpen(true);
    };

    const handleSemesterSelection = (semesterId: string) => {
        setSelectedSemesters(prev => {
            const newSelection = { ...prev };
            if (newSelection[semesterId]) {
                delete newSelection[semesterId];
            } else {
                newSelection[semesterId] = true;
            }
            return newSelection;
        });
    };
    
    const handleAddToSemesterSubmit = async () => {
        if (!selectedPlan) return;
        setSaving(true);
        try {
            const updates: Record<string, any> = {};
            semesters.forEach(semester => {
                 updates[`/semesters/${semester.id}/paymentPlanIds/${selectedPlan.id}`] = selectedSemesters[semester.id] ? true : null;
            });
            await update(ref(db), updates);
            toast({ variant: 'success', title: 'Semesters Updated', description: `Plan "${selectedPlan.name}" has been updated across semesters.` });
            setIsAddToSemesterOpen(false);
            setSelectedPlan(null);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to update semesters', description: error.message });
        } finally {
            setSaving(false);
        }
    };


    const resetForm = () => {
        setPlanName('');
        setPlanInstallments(1);
        setPercentages([100]);
        setIsPlanDialogOpen(false);
    }
    
    const handleInstallmentsChange = (countStr: string) => {
        let count = parseInt(countStr, 10);
        if (isNaN(count) || count < 1) count = 1;
        if (count > 12) count = 12;

        setPlanInstallments(count);
        
        const newPercentages = new Array(count).fill(0);
        const basePercent = Math.floor(100 / count);
        let remainder = 100 % count;

        for (let i = 0; i < count; i++) {
            newPercentages[i] = basePercent + (remainder > 0 ? 1 : 0);
            if(remainder > 0) remainder--;
        }
        setPercentages(newPercentages);
    };

    const handlePercentageChange = (index: number, value: string) => {
        const newPercentages = [...percentages];
        newPercentages[index] = Number(value);
        setPercentages(newPercentages);
    };
    
    const totalPercentage = React.useMemo(() => percentages.reduce((acc, p) => acc + (p || 0), 0), [percentages]);


    const handleCreatePaymentPlan = async () => {
        if (!planName || planInstallments < 1) {
            toast({ variant: 'destructive', title: 'Invalid plan details.' });
            return;
        }
        if (totalPercentage !== 100) {
            toast({ variant: 'destructive', title: 'Percentages must sum to 100%.' });
            return;
        }
        if (percentages.some(p => p <= 0)) {
            toast({ variant: 'destructive', title: 'All installment percentages must be greater than 0.' });
            return;
        }

        setSaving(true);
        try {
            const newPlanRef = push(ref(db, 'settings/paymentPlans'));
            await set(newPlanRef, { 
                name: planName, 
                installments: planInstallments, 
                installmentPercentages: percentages,
                archived: false 
            });
            toast({ variant: 'success', title: 'Payment Plan Created' });
            resetForm();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to create plan', description: error.message });
        } finally {
            setSaving(false);
        }
    };
    
    const handleDeletePaymentPlan = async (planId: string) => {
        if(!window.confirm("Are you sure you want to archive this payment plan? It will no longer be available for new registrations.")) return;
        setSaving(true);
        try {
            await update(ref(db, `settings/paymentPlans/${planId}`), { archived: true });
            toast({variant: 'success', title: 'Payment plan archived.'});
        } catch(e: any) {
             toast({ variant: 'destructive', title: 'Failed to archive plan', description: e.message });
        } finally {
            setSaving(false);
        }
    };
    
    if (loading) {
        return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;
    }
    
    if (!currentUser || !userData) {
        return <Card><CardContent className="p-6">You must be logged in to view this page.</CardContent></Card>;
    }

    if (!(userData?.subRoles?.includes('Accountant'))) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <Alert variant="destructive">
                        <Info className="h-4 w-4" />
                        <AlertTitle>Access Denied</AlertTitle>
                        <AlertDescription>You do not have permission to view this page. This feature is restricted to Accountants.</AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
        <Card className="shadow-lg">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="font-headline text-2xl">Payment Plan Management</CardTitle>
                        <CardDescription>Create and manage payment plans available to students during registration.</CardDescription>
                    </div>
                     <Dialog open={isPlanDialogOpen} onOpenChange={(open) => { if(!open) resetForm(); setIsPlanDialogOpen(open)}}>
                        <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/>Create Plan</Button></DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader><DialogTitle>Create New Payment Plan</DialogTitle></DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-1"><Label>Plan Name</Label><Input value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="e.g., Half-Payment Plan"/></div>
                                <div className="space-y-1"><Label>Number of Installments</Label><Input type="number" min="1" max="12" value={planInstallments} onChange={(e) => handleInstallmentsChange(e.target.value)}/></div>
                                
                                <div className="space-y-2">
                                    <Label>Installment Percentages</Label>
                                    <div className="grid gap-2" style={{gridTemplateColumns: `repeat(${planInstallments > 2 ? 2 : 1}, 1fr)`}}>
                                        {percentages.map((p, i) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <Label htmlFor={`p-${i}`} className="text-sm min-w-max">Installment {i+1}</Label>
                                                <div className="relative w-full">
                                                    <Input id={`p-${i}`} type="number" min="1" max="100" value={p} onChange={(e) => handlePercentageChange(i, e.target.value)} className="pr-7"/>
                                                    <Percent className="h-4 w-4 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"/>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <Alert variant={totalPercentage !== 100 ? 'destructive' : 'default'} className="mt-2">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertTitle>Total: {totalPercentage}%</AlertTitle>
                                        {totalPercentage !== 100 && <AlertDescription>Percentages must add up to 100%.</AlertDescription>}
                                    </Alert>
                                </div>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                                <Button onClick={handleCreatePaymentPlan} disabled={saving || totalPercentage !== 100}>
                                     {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Create Plan
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Plan Name</TableHead>
                            <TableHead>Installments</TableHead>
                            <TableHead>Distribution</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paymentPlans.length > 0 ? (
                           paymentPlans.filter(p => !p.archived).map(plan => (
                                <TableRow key={plan.id}>
                                    <TableCell className="font-medium">{plan.name}</TableCell>
                                    <TableCell>{plan.installments}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{plan.installmentPercentages?.join('% / ')}%</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm" onClick={() => openAddToSemesterDialog(plan)}>
                                            Add to Semester
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDeletePaymentPlan(plan.id)} disabled={saving}>
                                            <Trash2 className="h-4 w-4 text-destructive"/>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                             <TableRow><TableCell colSpan={4} className="text-center h-24">No payment plans created yet.</TableCell></TableRow>
                        )}
                        {paymentPlans.filter(p => !p.archived).length === 0 && !loading && (
                            <TableRow><TableCell colSpan={4} className="text-center h-24">No active payment plans.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

        <Dialog open={isAddToSemesterOpen} onOpenChange={setIsAddToSemesterOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add "{selectedPlan?.name}" to Semesters</DialogTitle>
                    <DialogDescription>Select the semesters where this payment plan should be available.</DialogDescription>
                </DialogHeader>
                <div className="max-h-[400px] overflow-y-auto py-4 pr-2 space-y-2">
                    {semesters.map(semester => (
                        <div key={semester.id} className="flex items-center gap-2 rounded-md border p-3">
                            <Checkbox 
                                id={`semester-${semester.id}`}
                                checked={!!selectedSemesters[semester.id]}
                                onCheckedChange={() => handleSemesterSelection(semester.id)}
                            />
                            <Label htmlFor={`semester-${semester.id}`} className="font-normal">{semester.name}</Label>
                        </div>
                    ))}
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={handleAddToSemesterSubmit} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        </>
    );
}
