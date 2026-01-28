
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle, Trash2, Pencil, Info, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase';
import { ref, onValue, set, push, update, remove } from 'firebase/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';


type FeeTemplate = {
    id: string;
    name: string;
    amount: number;
    type: 'Mandatory' | 'Optional';
}

type UserData = {
    role: 'Admin' | 'Staff';
    subRoles?: string[];
}

export default function FeeManagementPage() {
    const [feeTemplates, setFeeTemplates] = React.useState<FeeTemplate[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);

    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingFee, setEditingFee] = React.useState<FeeTemplate | null>(null);
    const [feeName, setFeeName] = React.useState('');
    const [feeAmount, setFeeAmount] = React.useState('');
    const [feeType, setFeeType] = React.useState<'Mandatory' | 'Optional'>('Optional');
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [userData, setUserData] = React.useState<UserData | null>(null);

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
            } else {
                 setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const canManage = React.useMemo(() => {
        if (!userData) return false;
        const isAccountant = userData.subRoles?.map(r => r.toLowerCase()).includes('accountant');
        const isAdmin = userData.role?.toLowerCase() === 'admin';
        return isAdmin || isAccountant;
    }, [userData]);


    React.useEffect(() => {
        if(!canManage && userData) {
            setLoading(false);
            return;
        }
        if(!userData) {
            return;
        }
        
        const templatesRef = ref(db, 'settings/feeTemplates');
        const unsub = onValue(templatesRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setFeeTemplates(Object.keys(data).map(id => ({ id, ...data[id] })));
            } else {
                setFeeTemplates([]);
            }
            setLoading(false);
        });

        return () => unsub();
    }, [userData, canManage]);
    
    const resetForm = () => {
        setEditingFee(null);
        setFeeName('');
        setFeeAmount('');
        setFeeType('Optional');
        setIsDialogOpen(false);
    }
    
    const openEditDialog = (fee: FeeTemplate) => {
        setEditingFee(fee);
        setFeeName(fee.name);
        setFeeAmount(String(fee.amount));
        setFeeType(fee.type || 'Optional');
        setIsDialogOpen(true);
    }

    const handleSaveFee = async () => {
        if (!feeName || !feeAmount) {
            toast({ variant: 'destructive', title: 'Fee name and amount are required.' });
            return;
        }

        setSaving(true);
        try {
            const feeData = { name: feeName, amount: parseFloat(feeAmount), type: feeType };
            if (editingFee) {
                await update(ref(db, `settings/feeTemplates/${editingFee.id}`), feeData);
                toast({ variant: 'success', title: 'Fee Template Updated' });
            } else {
                const newPlanRef = push(ref(db, 'settings/feeTemplates'));
                await set(newPlanRef, feeData);
                toast({ variant: 'success', title: 'Fee Template Created' });
            }
            resetForm();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to save fee template', description: error.message });
        } finally {
            setSaving(false);
        }
    };
    
    const handleDeleteFee = async (feeId: string) => {
        if(!window.confirm("Are you sure you want to delete this fee template? This cannot be undone.")) return;
        setSaving(true);
        try {
            await remove(ref(db, `settings/feeTemplates/${feeId}`));
            toast({variant: 'success', title: 'Fee template deleted.'});
        } catch(e: any) {
             toast({ variant: 'destructive', title: 'Failed to delete template', description: e.message });
        } finally {
            setSaving(false);
        }
    };
    
    if (loading) {
        return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;
    }

    if (!canManage) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <Alert variant="destructive">
                        <Info className="h-4 w-4" />
                        <AlertTitle>Access Denied</AlertTitle>
                        <AlertDescription>You do not have permission to manage fee templates.</AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    const mandatoryFees = feeTemplates.filter(f => f.type === 'Mandatory');
    const optionalFees = feeTemplates.filter(f => f.type === 'Optional');

    const renderFeeTable = (title: string, fees: FeeTemplate[]) => (
        <div className="space-y-4">
            <h3 className="font-headline text-xl">{title}</h3>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Fee Name</TableHead>
                        <TableHead className="text-right">Default Amount (ZMW)</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {fees.length > 0 ? (
                       fees.map(template => (
                            <TableRow key={template.id}>
                                <TableCell className="font-medium">{template.name}</TableCell>
                                <TableCell className="text-right">{template.amount.toFixed(2)}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(template)} disabled={saving}>
                                        <Pencil className="h-4 w-4"/>
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteFee(template.id)} disabled={saving}>
                                        <Trash2 className="h-4 w-4 text-destructive"/>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                         <TableRow><TableCell colSpan={3} className="text-center h-24">No {title.toLowerCase()} created yet.</TableCell></TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );

    return (
        <>
        <Card className="shadow-lg">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="font-headline text-2xl">Fee Template Management</CardTitle>
                        <CardDescription>Create and manage global fee templates that can be used for any semester.</CardDescription>
                    </div>
                     <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) resetForm(); setIsDialogOpen(open)}}>
                        <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/>Create Template</Button></DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>{editingFee ? 'Edit' : 'Create'} Fee Template</DialogTitle>
                                <DialogDescription>This creates a reusable fee with a default amount.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-1"><Label>Fee Name</Label><Input value={feeName} onChange={(e) => setFeeName(e.target.value)} placeholder="e.g., Library Fee"/></div>
                                <div className="space-y-1"><Label>Default Amount (ZMW)</Label><Input type="number" min="0" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)}/></div>
                                 <div className="space-y-2">
                                    <Label>Fee Type</Label>
                                     <RadioGroup value={feeType} onValueChange={(v) => setFeeType(v as any)} className="flex gap-4">
                                        <div className="flex items-center space-x-2"><RadioGroupItem value="Mandatory" id="r-mandatory" /><Label htmlFor="r-mandatory">Mandatory</Label></div>
                                        <div className="flex items-center space-x-2"><RadioGroupItem value="Optional" id="r-optional" /><Label htmlFor="r-optional">Optional</Label></div>
                                    </RadioGroup>
                                </div>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                                <Button onClick={handleSaveFee} disabled={saving}>
                                     {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                     {editingFee ? 'Save Changes' : 'Create Template'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent className="space-y-8">
                {renderFeeTable('Mandatory Fees', mandatoryFees)}
                <Separator/>
                {renderFeeTable('Optional Fees', optionalFees)}
            </CardContent>
        </Card>
        </>
    );
}
