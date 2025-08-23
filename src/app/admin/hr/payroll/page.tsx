
'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DollarSign, Download, Info, Mail, Link as LinkIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { sendPayslipEmail } from '@/ai/flows/send-payslip-email';
import { syncPayrollToQuickbooks } from '@/ai/flows/sync-to-quickbooks';
import { syncPayrollToSage } from '@/ai/flows/sync-to-sage';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';

type StaffMember = {
    uid: string;
    id: string; // STF-001
    name: string;
    email: string;
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
    const [actionLoading, setActionLoading] = React.useState<string | null>(null);
    const { user, userProfile, loading } = useAuth();
    const [isQuickBooksEnabled, setIsQuickBooksEnabled] = React.useState(false);
    const [isSageEnabled, setIsSageEnabled] = React.useState(false);
    const { toast } = useToast();

    React.useEffect(() => {
        const settingsRef = ref(db, 'settings/integrations');
        const unsubSettings = onValue(settingsRef, (snapshot) => {
            if (snapshot.exists()) {
                const integrations = snapshot.val();
                setIsQuickBooksEnabled(integrations.quickbooks?.enabled);
                setIsSageEnabled(integrations.sage?.enabled);
            }
        });

        return () => unsubSettings();
    }, []);


    React.useEffect(() => {
        if (!user) {
            return;
        }

        const fetchStaff = async () => {
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
                            baseSalary: usersData[uid].baseSalary || 0,
                        }));
                    setStaffList(staff);
                }
            } catch (error) {
                console.error("Error fetching staff data:", error);
                toast({ variant: "destructive", title: "Error", description: "Could not fetch staff data." });
            }
        };

        fetchStaff();
    }, [user, toast]);
    
    const handleSendPayslip = async (staff: StaffMember, payroll: {deductions: number, netPay: number}) => {
        setActionLoading(`payslip-${staff.uid}`);
        try {
            const currentMonth = format(new Date(), 'MMMM yyyy');
            const result = await sendPayslipEmail({
                staffName: staff.name,
                staffEmail: staff.email,
                month: currentMonth,
                grossSalary: staff.baseSalary,
                deductions: payroll.deductions,
                netPay: payroll.netPay
            });
            toast({title: "Payslip Sent", description: result});
        } catch (e: any) {
             toast({ variant: 'destructive', title: 'Failed to Send', description: e.message });
        } finally {
             setActionLoading(null);
        }
    }
    
    const handleSyncToQuickBooks = async (staff: StaffMember, payroll: {deductions: number, netPay: number}) => {
         setActionLoading(`sync-qb-${staff.uid}`);
        try {
            const currentMonth = format(new Date(), 'MMMM yyyy');
            await syncPayrollToQuickbooks({
                staffName: staff.name,
                staffId: staff.id,
                month: currentMonth,
                grossSalary: staff.baseSalary,
                deductions: payroll.deductions,
                netPay: payroll.netPay,
            });
            toast({ title: 'Payroll Synced', description: `Payroll for ${staff.name} has been synced to QuickBooks.` });
        } catch (e: any) {
             toast({ variant: 'destructive', title: 'Sync Failed', description: e.message });
        } finally {
             setActionLoading(null);
        }
    }
    
    const handleSyncToSage = async (staff: StaffMember, payroll: {deductions: number, netPay: number}) => {
         setActionLoading(`sync-sage-${staff.uid}`);
        try {
            const currentMonth = format(new Date(), 'MMMM yyyy');
            await syncPayrollToSage({
                staffName: staff.name,
                staffId: staff.id,
                month: currentMonth,
                grossSalary: staff.baseSalary,
                deductions: payroll.deductions,
                netPay: payroll.netPay,
            });
            toast({ title: 'Payroll Synced', description: `Payroll for ${staff.name} has been synced to Sage.` });
        } catch (e: any) {
             toast({ variant: 'destructive', title: 'Sync Failed', description: e.message });
        } finally {
             setActionLoading(null);
        }
    }


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
                            const payroll = calculatePayroll(staff);
                            return (
                                <TableRow key={staff.uid}>
                                    <TableCell className="font-medium">{staff.id}</TableCell>
                                    <TableCell>{staff.name}</TableCell>
                                    <TableCell>{staff.subRoles?.join(', ') || staff.role}</TableCell>
                                    <TableCell className="text-right">{staff.baseSalary.toFixed(2)}</TableCell>
                                    <TableCell className="text-right text-red-600">{payroll.deductions.toFixed(2)}</TableCell>
                                    <TableCell className="text-right font-bold">{payroll.netPay.toFixed(2)}</TableCell>
                                    <TableCell className="text-right flex gap-2 justify-end">
                                        <Button variant="outline" size="icon" onClick={() => handleSendPayslip(staff, payroll)} disabled={!!actionLoading}>
                                           {actionLoading === `payslip-${staff.uid}` ? <Loader2 className="h-4 w-4 animate-spin"/> : <Mail className="h-4 w-4"/>}
                                        </Button>
                                         {isQuickBooksEnabled && (
                                            <Button variant="outline" size="icon" onClick={() => handleSyncToQuickBooks(staff, payroll)} disabled={!!actionLoading} title="Sync to QuickBooks">
                                                {actionLoading === `sync-qb-${staff.uid}` ? <Loader2 className="h-4 w-4 animate-spin"/> : <LinkIcon className="h-4 w-4"/>}
                                            </Button>
                                        )}
                                        {isSageEnabled && (
                                            <Button variant="outline" size="icon" onClick={() => handleSyncToSage(staff, payroll)} disabled={!!actionLoading} title="Sync to Sage">
                                                {actionLoading === `sync-sage-${staff.uid}` ? <Loader2 className="h-4 w-4 animate-spin"/> : <LinkIcon className="h-4 w-4"/>}
                                            </Button>
                                        )}
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
