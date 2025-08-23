
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, createNotification } from '@/lib/firebase';
import { ref, onValue, update, get } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { addDays, format, isBefore, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Clock } from 'lucide-react';

type StaffMember = {
    uid: string;
    id: string;
    name: string;
    dateHired?: string;
    probationEndDate?: string;
    probationExtended?: boolean;
    contractType?: 'Probation' | 'Permanent' | 'Contract';
};

export default function ProbationTrackingPage() {
    const [probationaryStaff, setProbationaryStaff] = React.useState<StaffMember[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [dialogOpen, setDialogOpen] = React.useState<StaffMember | null>(null);
    const [newContractType, setNewContractType] = React.useState<'Permanent' | 'Contract'>('Permanent');
    
    const { toast } = useToast();

    React.useEffect(() => {
        const usersRef = ref(db, 'users');
        const unsubscribe = onValue(usersRef, (snapshot) => {
            if (snapshot.exists()) {
                const usersData = snapshot.val();
                const staffList = Object.keys(usersData)
                    .map(uid => ({ uid, ...usersData[uid] }))
                    .filter(user => user.role === 'Staff' && (user.contractType === 'Probation' || !user.contractType));
                
                const staffWithDates = staffList.map(staff => {
                    const dateHired = staff.dateHired || new Date().toISOString(); // Default if not present
                    return {
                        ...staff,
                        dateHired,
                        probationEndDate: staff.probationExtended 
                            ? format(addDays(parseISO(staff.probationEndDate || dateHired), 90), 'yyyy-MM-dd')
                            : format(addDays(parseISO(dateHired), 90), 'yyyy-MM-dd'),
                    }
                });

                setProbationaryStaff(staffWithDates);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleProbationUpdate = async (action: 'extend' | 'confirm') => {
        if (!dialogOpen) return;

        try {
            const userRef = ref(db, `users/${dialogOpen.uid}`);
            let updates: Partial<StaffMember> & { notificationMessage: string };
            
            if(action === 'extend') {
                updates = { 
                    probationExtended: true, 
                    probationEndDate: format(addDays(parseISO(dialogOpen.probationEndDate!), 90), 'yyyy-MM-dd'),
                    notificationMessage: 'Your probation period has been extended by 90 days.'
                };
            } else { // confirm
                updates = { 
                    contractType: newContractType,
                    notificationMessage: `Congratulations! Your probation has been confirmed. Your new contract type is: ${newContractType}.`
                };
            }

            const { notificationMessage, ...dbUpdates } = updates;
            await update(userRef, dbUpdates);
            await createNotification(dialogOpen.uid, notificationMessage, '/staff/profile');

            toast({ title: 'Probation Status Updated', description: `${dialogOpen.name}'s status has been updated.` });
            setDialogOpen(null);

        } catch (error) {
            toast({ variant: 'destructive', title: 'Update Failed' });
        }
    }


    return (
        <Card>
            <CardHeader>
                <CardTitle>Probation Tracking</CardTitle>
                <CardDescription>Monitor staff members currently on their probation period.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Probation End Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-24"/></TableCell></TableRow>
                        : probationaryStaff.map(staff => {
                            const isOverdue = isBefore(new Date(staff.probationEndDate!), new Date());
                            return (
                            <TableRow key={staff.uid}>
                                <TableCell>{staff.name} ({staff.id})</TableCell>
                                <TableCell>{format(parseISO(staff.probationEndDate!), 'PPP')}</TableCell>
                                <TableCell><Badge variant={isOverdue ? 'destructive' : 'secondary'}>{isOverdue ? 'Overdue' : 'Active'}</Badge></TableCell>
                                <TableCell className="text-right">
                                    <Button variant="outline" onClick={() => setDialogOpen(staff)}>Manage Probation</Button>
                                </TableCell>
                            </TableRow>
                        )})}
                    </TableBody>
                </Table>
                
                 <Dialog open={!!dialogOpen} onOpenChange={() => setDialogOpen(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Manage Probation for {dialogOpen?.name}</DialogTitle>
                            <DialogDescription>
                                Current probation ends on {dialogOpen && format(parseISO(dialogOpen.probationEndDate!), 'PPP')}. Choose an action below.
                            </DialogDescription>
                        </DialogHeader>
                         <div className="space-y-4 py-4">
                            <div className="p-4 border rounded-lg">
                                <h4 className="font-semibold mb-2">Confirm Employment</h4>
                                <div className="space-y-2">
                                    <Label>New Contract Type</Label>
                                    <Select value={newContractType} onValueChange={(v) => setNewContractType(v as any)}>
                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Permanent">Permanent</SelectItem>
                                            <SelectItem value="Contract">Contract</SelectItem>
                                        </SelectContent>
                                    </Select>
                                     <Button className="w-full" onClick={() => handleProbationUpdate('confirm')}>Confirm & Award Contract</Button>
                                </div>
                            </div>
                             <div className="p-4 border rounded-lg">
                                <h4 className="font-semibold mb-2">Extend Probation</h4>
                                <p className="text-sm text-muted-foreground mb-2">This will extend the current probation period by another 90 days from the current end date.</p>
                                <Button className="w-full" variant="secondary" onClick={() => handleProbationUpdate('extend')}>Extend Probation by 90 Days</Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

            </CardContent>
        </Card>
    );
}
