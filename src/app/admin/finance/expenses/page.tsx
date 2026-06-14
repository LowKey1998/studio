
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle, Trash2, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, onValue, set, push, remove, get } from 'firebase/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { syncExpenseToQuickbooks } from '@/ai/flows/sync-to-quickbooks';
import { syncExpenseToSage } from '@/ai/flows/sync-to-sage';

type Expense = {
    id: string;
    date: string;
    category: string;
    description: string;
    amount: number;
    vendor?: string;
    department?: string;
};

const expenseCategories = ["Salaries", "Infrastructure", "Scholarships", "Utilities", "Equipment", "Others", "Supplies", "Maintenance", "Marketing", "Travel", "Other"];
const departments = ["Academics", "Administration", "Maintenance", "Library", "Clinicals", "Student Life", "Research"];

export default function ExpenseTrackingPage() {
    const [expenses, setExpenses] = React.useState<Expense[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [date, setDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
    const [category, setCategory] = React.useState('');
    const [department, setDepartment] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [amount, setAmount] = React.useState('');
    const [vendor, setVendor] = React.useState('');
    
    const [isQuickBooksEnabled, setIsQuickBooksEnabled] = React.useState(false);
    const [isSageEnabled, setIsSageEnabled] = React.useState(false);

    const { toast } = useToast();

    React.useEffect(() => {
        const expensesRef = ref(db, 'expenses');
        const unsub = onValue(expensesRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setExpenses(Object.keys(data).map(id => ({ id, ...data[id] })).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            } else {
                setExpenses([]);
            }
            setLoading(false);
        });

        const settingsRef = ref(db, 'settings/integrations');
        const unsubSettings = onValue(settingsRef, (snapshot) => {
            if (snapshot.exists()) {
                const integrations = snapshot.val();
                setIsQuickBooksEnabled(integrations.quickbooks?.enabled && integrations.quickbooks?.syncExpenses);
                setIsSageEnabled(integrations.sage?.enabled);
            }
        });

        return () => {
            unsub();
            unsubSettings();
        };
    }, []);

    const resetForm = () => {
        setDate(format(new Date(), 'yyyy-MM-dd'));
        setCategory('');
        setDepartment('');
        setDescription('');
        setAmount('');
        setVendor('');
    };

    const handleSaveExpense = async () => {
        if (!date || !category || !department || !description || !amount) {
            toast({ variant: 'destructive', title: 'Missing required fields' });
            return;
        }
        setSaving(true);
        try {
            const newExpenseRef = push(ref(db, 'expenses'));
            const expenseData = {
                date,
                category,
                department,
                description,
                amount: parseFloat(amount),
                vendor
            };
            await set(newExpenseRef, expenseData);
            toast({ title: 'Expense Recorded' });

            const syncData = { expenseId: newExpenseRef.key!, ...expenseData };

            if(isQuickBooksEnabled) {
                await syncExpenseToQuickbooks(syncData);
                toast({ title: 'Synced to QuickBooks' });
            }
            if(isSageEnabled) {
                await syncExpenseToSage(syncData);
                toast({ title: 'Synced to Sage' });
            }

            setIsDialogOpen(false);
            resetForm();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to record expense', description: e.message });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteExpense = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this expense record?")) return;
        await remove(ref(db, `expenses/${id}`));
        toast({ title: 'Expense Deleted' });
    };

    const totalExpenses = React.useMemo(() => {
        return expenses.reduce((sum, exp) => sum + exp.amount, 0);
    }, [expenses]);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Expense Tracking</CardTitle>
                    <CardDescription>Record and monitor all institutional expenditures.</CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4"/>Log Expense</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Log New Expense</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-1"><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
                            <div className="space-y-1"><Label>Category</Label>
                                <Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue placeholder="Select a category..."/></SelectTrigger>
                                    <SelectContent>{expenseCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1"><Label>Department / Division</Label>
                                <Select value={department} onValueChange={setDepartment}><SelectTrigger><SelectValue placeholder="Select a department..."/></SelectTrigger>
                                    <SelectContent>{departments.map(dept => <SelectItem key={dept} value={dept}>{dept}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1"><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} /></div>
                            <div className="space-y-1"><Label>Amount (ZMW)</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
                             <div className="space-y-1"><Label>Vendor (Optional)</Label><Input value={vendor} onChange={e => setVendor(e.target.value)} /></div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleSaveExpense} disabled={saving}>{saving && <Loader2 className="mr-2 h-4"/>}Save Expense</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead>Department</TableHead><TableHead>Description</TableHead><TableHead>Vendor</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right"></TableHead></TableRow></TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={7}><Skeleton className="h-24"/></TableCell></TableRow> :
                         expenses.map(exp => (
                            <TableRow key={exp.id}>
                                <TableCell>{format(new Date(exp.date), 'PPP')}</TableCell>
                                <TableCell>{exp.category}</TableCell>
                                <TableCell className="font-semibold">{exp.department || 'N/A'}</TableCell>
                                <TableCell>{exp.description}</TableCell>
                                <TableCell>{exp.vendor}</TableCell>
                                <TableCell className="text-right font-medium">{exp.amount.toFixed(2)}</TableCell>
                                <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleDeleteExpense(exp.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell>
                            </TableRow>
                         ))}
                    </TableBody>
                </Table>
            </CardContent>
            <CardFooter className="justify-end font-bold text-lg">
                Total Expenses: ZMW {totalExpenses.toFixed(2)}
            </CardFooter>
        </Card>
    );
}

