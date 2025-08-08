
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DollarSign, Download, Send } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import Logo from '@/components/logo';
import { sendPayslipEmail } from '@/ai/flows/send-payslip-email';

type StaffMember = {
    uid: string;
    id: string; // STF-001
    name: string;
    email: string;
    role: string;
    subRoles?: string[];
    baseSalary: number;
};

type PayrollDetails = {
    grossSalary: number;
    deductions: number;
    netPay: number;
};

// Mock payroll data calculation
const calculatePayroll = (staff: StaffMember): PayrollDetails => {
    const grossSalary = staff.baseSalary;
    const deductions = grossSalary * 0.15; // Mock 15% deduction
    const netPay = grossSalary - deductions;
    return { grossSalary, deductions, netPay };
};

const PayslipContent = ({ staff, payroll }: { staff: StaffMember, payroll: PayrollDetails }) => (
    <div className="p-6 bg-white text-black max-w-2xl mx-auto my-8 font-sans">
        <div className="flex justify-between items-center border-b pb-4">
             <Logo />
            <div className="text-right">
                <h1 className="font-bold text-2xl">Payslip</h1>
                <p className="text-sm">For the month of {format(new Date(), 'MMMM yyyy')}</p>
            </div>
        </div>
        <div className="grid grid-cols-2 gap-4 my-6">
            <div>
                <h2 className="font-semibold text-gray-500">Employee Details</h2>
                <p>{staff.name}</p>
                <p>ID: {staff.id}</p>
                <p>{staff.subRoles?.join(', ') || staff.role}</p>
            </div>
             <div className="text-right">
                <h2 className="font-semibold text-gray-500">Pay Period</h2>
                <p>{format(new Date(), 'MMMM d, yyyy')}</p>
            </div>
        </div>
        <Separator/>
        <div className="my-6">
            <div className="flex justify-between py-2"><p>Gross Salary</p><p>ZMW {payroll.grossSalary.toFixed(2)}</p></div>
            <div className="flex justify-between py-2"><p>Deductions (PAYE, NAPSA)</p><p className="text-red-600">(ZMW {payroll.deductions.toFixed(2)})</p></div>
        </div>
        <Separator/>
        <div className="flex justify-between font-bold text-lg my-6">
            <p>Net Pay</p>
            <p>ZMW {payroll.netPay.toFixed(2)}</p>
        </div>
    </div>
);


export default function PayrollPage() {
    const [staffList, setStaffList] = React.useState<StaffMember[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [actionLoading, setActionLoading] = React.useState<string | null>(null);
    const [selectedStaff, setSelectedStaff] = React.useState<{ staff: StaffMember; payroll: PayrollDetails } | null>(null);
    const [isPayslipOpen, setIsPayslipOpen] = React.useState(false);
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
    
    const handleViewPayslip = (staff: StaffMember) => {
        const payroll = calculatePayroll(staff);
        setSelectedStaff({ staff, payroll });
        setIsPayslipOpen(true);
    };

    const handleSendPayslip = async () => {
        if (!selectedStaff) return;
        setActionLoading(selectedStaff.staff.uid);
        try {
            await sendPayslipEmail({
                staffName: selectedStaff.staff.name,
                staffEmail: selectedStaff.staff.email,
                month: format(new Date(), 'MMMM yyyy'),
                grossSalary: selectedStaff.payroll.grossSalary,
                deductions: selectedStaff.payroll.deductions,
                netPay: selectedStaff.payroll.netPay
            });
            toast({ variant: 'success', title: 'Email Sent', description: `Payslip has been sent to ${selectedStaff.staff.email}.` });
        } catch (e: any) {
            toast({ variant: "destructive", title: "Email Failed", description: e.message });
        } finally {
            setActionLoading(null);
        }
    };


    return (
        <>
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
                                const payroll = calculatePayroll(staff);
                                return (
                                    <TableRow key={staff.uid}>
                                        <TableCell className="font-medium">{staff.id}</TableCell>
                                        <TableCell>{staff.name}</TableCell>
                                        <TableCell>{staff.subRoles?.join(', ') || staff.role}</TableCell>
                                        <TableCell className="text-right">{payroll.grossSalary.toFixed(2)}</TableCell>
                                        <TableCell className="text-right text-red-600">{payroll.deductions.toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-bold">{payroll.netPay.toFixed(2)}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm" onClick={() => handleViewPayslip(staff)}>View Payslip</Button>
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
        
        <Dialog open={isPayslipOpen} onOpenChange={setIsPayslipOpen}>
            <DialogContent className="max-w-3xl p-0">
                {selectedStaff && (
                    <>
                    <div className="bg-gray-100">
                        <PayslipContent staff={selectedStaff.staff} payroll={selectedStaff.payroll}/>
                    </div>
                    <div className="p-6 bg-background rounded-b-lg flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsPayslipOpen(false)}>Close</Button>
                        <Button onClick={handleSendPayslip} disabled={actionLoading === selectedStaff.staff.uid}>
                             {actionLoading === selectedStaff.staff.uid ? <Send className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>} Send to Email
                        </Button>
                    </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
        </>
    );
}
