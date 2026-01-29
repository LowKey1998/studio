
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Loader2, PlusCircle, Trash2, Pencil } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, get, set, push, update, remove, onValue } from 'firebase/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';

type BankDetails = {
    id: string;
    bankName: string;
    accountName: string;
    accountNumber: string;
    branchCode: string;
    swiftCode?: string;
};

export default function BankIntegrationPage() {
    const [bankDetailsList, setBankDetailsList] = React.useState<BankDetails[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingBank, setEditingBank] = React.useState<BankDetails | null>(null);

    // Form state
    const [bankName, setBankName] = React.useState('');
    const [accountName, setAccountName] = React.useState('');
    const [accountNumber, setAccountNumber] = React.useState('');
    const [branchCode, setBranchCode] = React.useState('');
    const [swiftCode, setSwiftCode] = React.useState('');
    
    const { toast } = useToast();

    React.useEffect(() => {
        const settingsRef = ref(db, 'settings/bankDetails');
        const unsub = onValue(settingsRef, (snapshot) => {
            const data = snapshot.val() || {};
            setBankDetailsList(Object.keys(data).map(id => ({ id, ...data[id] })));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const resetForm = () => {
        setBankName('');
        setAccountName('');
        setAccountNumber('');
        setBranchCode('');
        setSwiftCode('');
        setEditingBank(null);
    };

    const openDialog = (bank: BankDetails | null) => {
        if (bank) {
            setEditingBank(bank);
            setBankName(bank.bankName);
            setAccountName(bank.accountName);
            setAccountNumber(bank.accountNumber);
            setBranchCode(bank.branchCode);
            setSwiftCode(bank.swiftCode || '');
        } else {
            resetForm();
        }
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        if (!bankName || !accountName || !accountNumber || !branchCode) {
            toast({ variant: 'destructive', title: 'Please fill all required fields.' });
            return;
        }
        setSaving(true);
        const data = { bankName, accountName, accountNumber, branchCode, swiftCode };
        try {
            if (editingBank) {
                await update(ref(db, `settings/bankDetails/${editingBank.id}`), data);
                toast({ title: 'Bank Details Updated' });
            } else {
                await push(ref(db, 'settings/bankDetails'), data);
                toast({ title: 'Bank Account Added' });
            }
            setIsDialogOpen(false);
            resetForm();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
        } finally {
            setSaving(false);
        }
    };
    
    const handleDelete = async (bankId: string) => {
        if (!window.confirm('Are you sure you want to delete this bank account?')) return;
        await remove(ref(db, `settings/bankDetails/${bankId}`));
        toast({ title: 'Bank Account Removed' });
    };

    return (
        <Card>
            <CardHeader className="flex-row items-start justify-between">
                <div>
                    <CardTitle>Bank Details Configuration</CardTitle>
                    <CardDescription>Manage bank accounts to be displayed for direct deposits.</CardDescription>
                </div>
                <Button onClick={() => openDialog(null)}><PlusCircle className="mr-2 h-4 w-4"/>Add Bank Account</Button>
            </CardHeader>
            <CardContent className="space-y-4">
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Bank Name</TableHead>
                            <TableHead>Account Name</TableHead>
                            <TableHead>Account Number</TableHead>
                            <TableHead>Branch Code</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={5}>Loading...</TableCell></TableRow>
                        : bankDetailsList.map(bank => (
                            <TableRow key={bank.id}>
                                <TableCell>{bank.bankName}</TableCell>
                                <TableCell>{bank.accountName}</TableCell>
                                <TableCell>{bank.accountNumber}</TableCell>
                                <TableCell>{bank.branchCode}</TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button variant="ghost" size="icon" onClick={() => openDialog(bank)}>
                                        <Pencil className="h-4 w-4"/>
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(bank.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive"/>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                 </Table>
            </CardContent>
            
            <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open);}}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingBank ? 'Edit' : 'Add New'} Bank Account</DialogTitle>
                    </DialogHeader>
                     <div className="space-y-4 max-w-lg py-4">
                        <div className="space-y-1">
                            <Label htmlFor="bankName">Bank Name</Label>
                            <Input id="bankName" placeholder="e.g., Zambia National Commercial Bank" value={bankName} onChange={e => setBankName(e.target.value)}/>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="accountName">Account Name</Label>
                            <Input id="accountName" placeholder="e.g., Edutrack 360" value={accountName} onChange={e => setAccountName(e.target.value)}/>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="accountNumber">Account Number</Label>
                            <Input id="accountNumber" placeholder="e.g., 0123456789123" value={accountNumber} onChange={e => setAccountNumber(e.target.value)}/>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="branchCode">Branch Code</Label>
                            <Input id="branchCode" placeholder="e.g., 010203" value={branchCode} onChange={e => setBranchCode(e.target.value)}/>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="swiftCode">SWIFT Code (Optional)</Label>
                            <Input id="swiftCode" placeholder="e.g., ZNCOZMLU" value={swiftCode} onChange={e => setSwiftCode(e.target.value)}/>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
