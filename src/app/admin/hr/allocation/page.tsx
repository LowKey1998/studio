'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from '@/lib/firebase';
import { ref, onValue, update } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Staff = {
    uid: string;
    name: string;
    subRoles?: string[];
    department?: string;
};

type Department = {
    id: string;
    name: string;
};

export default function StaffAllocationPage() {
    const [staff, setStaff] = React.useState<Staff[]>([]);
    const [departments, setDepartments] = React.useState<Department[]>([]);
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();

    React.useEffect(() => {
        const usersRef = ref(db, 'users');
        const unsubUsers = onValue(usersRef, (snapshot) => {
            const usersData = snapshot.val() || {};
            setStaff(
                Object.keys(usersData)
                .filter(uid => usersData[uid].role === 'Staff')
                .map(uid => ({ uid, ...usersData[uid] }))
                .sort((a,b) => a.name.localeCompare(b.name))
            );
            setLoading(false);
        });

        const deptsRef = ref(db, 'settings/departments');
        const unsubDepts = onValue(deptsRef, (snapshot) => {
            const deptsData = snapshot.val() || {};
            setDepartments(
                Object.keys(deptsData).map(id => ({ id, ...deptsData[id] }))
            );
        });

        return () => {
            unsubUsers();
            unsubDepts();
        };
    }, []);

    const handleAssignDepartment = async (staffUid: string, departmentName: string) => {
        try {
            await update(ref(db, `users/${staffUid}`), { department: departmentName });
            toast({ title: "Department Assigned", description: "The staff member's department has been updated." });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: "Assignment Failed" });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Staff Allocation</CardTitle>
                <CardDescription>Manage staff assignments to different departments.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Role(s)</TableHead>
                            <TableHead>Department</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={3}><Skeleton className="h-24"/></TableCell></TableRow>
                        : staff.map(s => (
                             <TableRow key={s.uid}>
                                <TableCell>{s.name}</TableCell>
                                <TableCell>{s.subRoles?.join(', ')}</TableCell>
                                <TableCell>
                                    <Select value={s.department} onValueChange={(value) => handleAssignDepartment(s.uid, value)}>
                                        <SelectTrigger className="w-[280px]">
                                            <SelectValue placeholder="Assign a department..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {departments.map(dept => (
                                                <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
