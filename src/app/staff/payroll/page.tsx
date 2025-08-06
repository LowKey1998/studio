'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DollarSign, Download, Info } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [userData, setUserData] = React.useState<any>(null); // For subRoles check
    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
            setCurrentUser(user);
            const userRef = ref(db, `users/${user.uid}`);
            const snapshot = await get(userRef);
            if (snapshot.exists()) {
                setUserData(snapshot.val());
            }
          } else {
              setLoading(false);
          }
        });
        return () => unsubscribe();
    }, []);

    React.useEffect(() => {
        if (!userData) {
            if (currentUser === null) {
                setLoading(false);
            }
            return;
        }
        
        if (!(userData.role === 'Staff' && userData.subRoles?.includes('Accountant'))) {
             setLoading(false);
             return;
        }

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
    }, [userData, toast, currentUser]);

    if (loading) {
         return (
            <Card className="shadow-lg">
                <CardHeader>
                    <Skeleton className="h-8 w-1/3" />
                    <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                </CardContent>
            </Card>
        );
    }
    
    if (!userData || !(userData.role === 'Staff' && userData.subRoles?.includes('Accountant'))) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <Alert variant="destructive">
                        <Info className="h-4 w-4" />
                        <AlertTitle>Access Denied</AlertTitle>
                        <AlertDescription>
                            You do not have permission to view the payroll page. This feature is restricted to Accountants.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

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
                        {staffList.map((staff) => {
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
                        })}
                    </TableBody>
                </Table>
                 {!loading && staffList.length === 0 && (
                    <div className="text-center py-16 text-muted-foreground">No staff data found.</div>
                )}
            </CardContent>
        </Card>
    );
}