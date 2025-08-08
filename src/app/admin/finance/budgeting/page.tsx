
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle } from "lucide-react";

export default function BudgetingPage() {
    const budgetItems = [
        { category: 'Salaries', budgeted: 500000, actual: 480000 },
        { category: 'Marketing', budgeted: 50000, actual: 55000 },
        { category: 'Supplies', budgeted: 75000, actual: 65000 },
    ];

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                 <div>
                    <CardTitle>Budget Forecasting</CardTitle>
                    <CardDescription>Create and manage budgets, and track actual spending against them.</CardDescription>
                 </div>
                 <Button><PlusCircle className="mr-2 h-4"/>New Budget Item</Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Budgeted Amount (ZMW)</TableHead>
                            <TableHead className="text-right">Actual Amount (ZMW)</TableHead>
                            <TableHead className="text-right">Variance (ZMW)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {budgetItems.map(item => (
                            <TableRow key={item.category}>
                                <TableCell>{item.category}</TableCell>
                                <TableCell className="text-right">{item.budgeted.toFixed(2)}</TableCell>
                                <TableCell className="text-right">{item.actual.toFixed(2)}</TableCell>
                                <TableCell className={`text-right font-medium ${item.budgeted < item.actual ? 'text-red-600' : 'text-green-600'}`}>
                                    {(item.actual - item.budgeted).toFixed(2)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
