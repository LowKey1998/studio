
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Loader2, Trash2 } from "lucide-react";
import { db } from '@/lib/firebase';
import { ref, onValue, set, push, remove } from 'firebase/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

type BudgetItem = {
    id: string;
    category: string;
    budgeted: number;
    actual: number;
};

export default function BudgetingPage() {
    const [budget, setBudget] = React.useState<BudgetItem[]>([]);
    const [expenses, setExpenses] = React.useState<any>({});
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);

    // Dialog State
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [category, setCategory] = React.useState('');
    const [budgetedAmount, setBudgetedAmount] = React.useState('');

    const { toast } = useToast();

    React.useEffect(() => {
        const budgetRef = ref(db, 'budget');
        const unsubBudget = onValue(budgetRef, (snapshot) => {
            setBudget(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({id, ...snapshot.val()[id]})) : []);
            setLoading(false);
        });

        const expensesRef = ref(db, 'expenses');
        const unsubExpenses = onValue(expensesRef, (snapshot) => {
            const expenseByCategory: any = {};
            if(snapshot.exists()){
                Object.values(snapshot.val()).forEach((exp: any) => {
                    expenseByCategory[exp.category] = (expenseByCategory[exp.category] || 0) + exp.amount;
                });
            }
            setExpenses(expenseByCategory);
        });

        return () => {
            unsubBudget();
            unsubExpenses();
        }
    }, []);
    
    const handleSaveItem = async () => {
        if (!category || !budgetedAmount) return;
        setSaving(true);
        try {
            await push(ref(db, 'budget'), { category, budgeted: parseFloat(budgetedAmount), actual: 0 });
            toast({ title: "Budget Item Added" });
            setCategory('');
            setBudgetedAmount('');
            setIsDialogOpen(false);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Failed to add item' });
        } finally {
            setSaving(false);
        }
    };
    
    const handleDeleteItem = async (id: string) => {
        await remove(ref(db, `budget/${id}`));
        toast({ title: 'Budget item removed' });
    }

    const budgetWithActuals = budget.map(item => ({
        ...item,
        actual: expenses[item.category] || 0,
    }));

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                 <div>
                    <CardTitle>Budget Forecasting</CardTitle>
                    <CardDescription>Create and manage budgets, and track actual spending against them.</CardDescription>
                 </div>
                 <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                     <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4"/>New Budget Item</Button></DialogTrigger>
                     <DialogContent>
                        <DialogHeader><DialogTitle>New Budget Item</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-1"><Label>Category</Label><Input value={category} onChange={e => setCategory(e.target.value)}/></div>
                            <div className="space-y-1"><Label>Budgeted Amount</Label><Input type="number" value={budgetedAmount} onChange={e => setBudgetedAmount(e.target.value)}/></div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleSaveItem} disabled={saving}>{saving && <Loader2 className="mr-2"/>}Save</Button>
                        </DialogFooter>
                     </DialogContent>
                 </Dialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Budgeted Amount (ZMW)</TableHead>
                            <TableHead className="text-right">Actual Amount (ZMW)</TableHead>
                            <TableHead className="text-right">Variance (ZMW)</TableHead>
                            <TableHead className="text-right"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={5}><Skeleton className="h-24"/></TableCell></TableRow> :
                         budgetWithActuals.map(item => (
                            <TableRow key={item.id}>
                                <TableCell>{item.category}</TableCell>
                                <TableCell className="text-right">{item.budgeted.toFixed(2)}</TableCell>
                                <TableCell className="text-right">{item.actual.toFixed(2)}</TableCell>
                                <TableCell className={`text-right font-medium ${item.budgeted < item.actual ? 'text-red-600' : 'text-green-600'}`}>
                                    {(item.budgeted - item.actual).toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
