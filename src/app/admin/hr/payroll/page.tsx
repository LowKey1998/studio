
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DollarSign, Download } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';

type StaffMember = {
    uid: string;
    id: string; // STF-001
    name: string;
    role: string;
    subRoles?: string[];
    baseSalary: number;
};

// Mock payroll data calculation
const calculatePayroll = (staff: StaffMember) => {
    const deductions = staff.baseSalary * 0.15; // Mock 15% deduction
    const netPay = staff.baseSalary - deductions;
    return { deductions, netPay };
};

export default function PayrollPage() {
    const [staffList, setStaffList] = React.useState<StaffMember[]>([]);
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();

    React.useEffect(() => {
        const fetchStaff = async () => {
            setLoading(true);
            try {
                const usersRef = ref(db, 'users');
                const snapshot = await get(usersRef);
                if (snapshot.exists()) {
                    const usersData = snapshot.val();
                    const staff: StaffMember[] = Object.keys(usersData)
                        .filter(uid => usersData[uid].role === 'Staff')
                        .map(uid => ({
                            uid,
                            ...usersData[uid],
                            baseSalary: usersData[uid].baseSalary || 50000, // Mock base salary
                        }));
                    setStaffList(staff);
                }
            } catch (error) {
                console.error("Error fetching staff data:", error);
                toast({ variant: "destructive", title: "Error", description: "Could not fetch staff data." });
            } finally {
                setLoading(false);
            }
        };

        fetchStaff();
    }, [toast]);

    return (
        <Card className="shadow-lg">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <CardTitle className="font-headline text-2xl">Staff Payroll</CardTitle>
                    <CardDescription>View and manage monthly payroll for all staff members.</CardDescription>
                </div>
                <Button disabled>
                    <Download className="mr-2 h-4 w-4" />
                    Export as CSV
                </Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Staff ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead className="text-right">Base Salary (ZMW)</TableHead>
                            <TableHead className="text-right">Deductions (ZMW)</TableHead>
                            <TableHead className="text-right">Net Pay (ZMW)</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-9 w-24 ml-auto" /></TableCell>
                                </TableRow>
                            ))
                        ) : staffList.length > 0 ? (
                            staffList.map((staff) => {
                                const { deductions, netPay } = calculatePayroll(staff);
                                return (
                                    <TableRow key={staff.uid}>
                                        <TableCell className="font-medium">{staff.id}</TableCell>
                                        <TableCell>{staff.name}</TableCell>
                                        <TableCell>{staff.subRoles?.join(', ') || staff.role}</TableCell>
                                        <TableCell className="text-right">{staff.baseSalary.toFixed(2)}</TableCell>
                                        <TableCell className="text-right text-red-600">{deductions.toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-bold">{netPay.toFixed(2)}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm" disabled>View Payslip</Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        ) : (
                            <TableRow><TableCell colSpan={7} className="h-24 text-center">No staff members found.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
