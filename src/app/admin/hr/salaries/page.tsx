
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Save, DollarSign, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, onValue, update } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';


type SalaryComponents = {
    baseSalary?: number;
    housingAllowance?: number;
    transportAllowance?: number;
    otherAllowances?: number;
};

type StaffMember = {
    uid: string;
    id: string;
    name: string;
    salaryComponents?: SalaryComponents;
};

export default function SalariesPage() {
    const [staffList, setStaffList] = React.useState<StaffMember[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);

    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingStaff, setEditingStaff] = React.useState<StaffMember | null>(null);
    const [salaryComponents, setSalaryComponents] = React.useState<SalaryComponents>({});

    const { toast } = useToast();

    React.useEffect(() => {
        const usersRef = ref(db, 'users');
        const unsubscribe = onValue(usersRef, (snapshot) => {
            if (snapshot.exists()) {
                const usersData = snapshot.val();
                const staff: StaffMember[] = Object.keys(usersData)
                    .filter(uid => usersData[uid].role === 'Staff')
                    .map(uid => ({
                        uid,
                        id: usersData[uid].id,
                        name: usersData[uid].name,
                        salaryComponents: usersData[uid].salaryComponents || {},
                    }));
                setStaffList(staff.sort((a, b) => a.name.localeCompare(b.name)));
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const openEditDialog = (staff: StaffMember) => {
        setEditingStaff(staff);
        setSalaryComponents(staff.salaryComponents || {});
        setIsDialogOpen(true);
    };

    const handleComponentChange = (field: keyof SalaryComponents, value: string) => {
        setSalaryComponents(prev => ({
            ...prev,
            [field]: value ? parseFloat(value) : 0,
        }));
    };

    const handleSaveChanges = async () => {
        if (!editingStaff) return;
        setSaving(true);
        try {
            await update(ref(db, `users/${editingStaff.uid}`), {
                salaryComponents: salaryComponents,
            });
            toast({ title: "Salary Updated", description: "The salary structure has been saved." });
            setIsDialogOpen(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Update Failed", description: error.message });
        } finally {
            setSaving(false);
        }
    };
    
    const calculateGrossSalary = (components?: SalaryComponents) => {
        if (!components) return 0;
        return (components.baseSalary || 0) + (components.housingAllowance || 0) + (components.transportAllowance || 0) + (components.otherAllowances || 0);
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Staff Salary Management</CardTitle>
                <CardDescription>Set and update the salary structure for each staff member.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Staff ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead className="text-right">Gross Salary (ZMW)</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                             Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell>
                                </TableRow>
                            ))
                        ) : staffList.map(staff => (
                            <TableRow key={staff.uid}>
                                <TableCell>{staff.id}</TableCell>
                                <TableCell className="font-medium">{staff.name}</TableCell>
                                <TableCell className="text-right font-bold">{calculateGrossSalary(staff.salaryComponents).toFixed(2)}</TableCell>
                                <TableCell className="text-right">
                                     <Button variant="outline" size="sm" onClick={() => openEditDialog(staff)}>
                                        <Pencil className="mr-2 h-4 w-4"/>
                                        Edit Salary
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                 <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit Salary for {editingStaff?.name}</DialogTitle>
                            <DialogDescription>Define the components of the gross salary.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-1"><Label>Base Salary</Label><Input type="number" value={salaryComponents.baseSalary || ''} onChange={e => handleComponentChange('baseSalary', e.target.value)} /></div>
                            <div className="space-y-1"><Label>Housing Allowance</Label><Input type="number" value={salaryComponents.housingAllowance || ''} onChange={e => handleComponentChange('housingAllowance', e.target.value)} /></div>
                            <div className="space-y-1"><Label>Transport Allowance</Label><Input type="number" value={salaryComponents.transportAllowance || ''} onChange={e => handleComponentChange('transportAllowance', e.target.value)} /></div>
                            <div className="space-y-1"><Label>Other Taxable Allowances</Label><Input type="number" value={salaryComponents.otherAllowances || ''} onChange={e => handleComponentChange('otherAllowances', e.target.value)} /></div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleSaveChanges} disabled={saving}>{saving && <Loader2 className="mr-2"/>}Save Changes</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}
