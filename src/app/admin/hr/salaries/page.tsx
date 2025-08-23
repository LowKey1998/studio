'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Save, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, onValue, update } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';

type StaffMember = {
    uid: string;
    id: string;
    name: string;
    baseSalary: number;
};

export default function SalariesPage() {
    const [staffList, setStaffList] = React.useState<StaffMember[]>([]);
    const [salaries, setSalaries] = React.useState<Record<string, number | string>>({});
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
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
                        baseSalary: usersData[uid].baseSalary || 0,
                    }));
                setStaffList(staff.sort((a, b) => a.name.localeCompare(b.name)));
                
                const initialSalaries: Record<string, number> = {};
                staff.forEach(s => {
                    initialSalaries[s.uid] = s.baseSalary;
                });
                setSalaries(initialSalaries);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleSalaryChange = (uid: string, value: string) => {
        setSalaries(prev => ({
            ...prev,
            [uid]: value,
        }));
    };

    const handleSaveChanges = async () => {
        setSaving(true);
        try {
            const updates: Record<string, any> = {};
            for (const uid in salaries) {
                const newSalary = parseFloat(salaries[uid] as string);
                if (!isNaN(newSalary)) {
                    updates[`/users/${uid}/baseSalary`] = newSalary;
                }
            }
            await update(ref(db), updates);
            toast({ title: "Salaries Updated", description: "All changes have been saved successfully." });
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Update Failed", description: error.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Staff Salaries</CardTitle>
                <CardDescription>Set and update the base salary for each staff member.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Staff ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead className="w-[200px]">Base Salary (ZMW)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                             Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={3}><Skeleton className="h-8 w-full" /></TableCell>
                                </TableRow>
                            ))
                        ) : staffList.map(staff => (
                            <TableRow key={staff.uid}>
                                <TableCell>{staff.id}</TableCell>
                                <TableCell className="font-medium">{staff.name}</TableCell>
                                <TableCell>
                                    <div className="relative">
                                        <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/>
                                        <Input
                                            type="number"
                                            value={salaries[staff.uid] ?? ''}
                                            onChange={(e) => handleSalaryChange(staff.uid, e.target.value)}
                                            className="pl-8"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
            <CardFooter className="flex justify-end border-t pt-6">
                 <Button onClick={handleSaveChanges} disabled={saving || loading}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                </Button>
            </CardFooter>
        </Card>
    );
}
