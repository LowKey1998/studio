'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { db, createNotification } from '@/lib/firebase';
import { ref, onValue, update, get } from 'firebase/database';
import { 
    Search, 
    Filter, 
    GraduationCap, 
    CheckCircle2, 
    XCircle, 
    Loader2, 
    Clock, 
    Info, 
    DollarSign, 
    Library, 
    Save, 
    AlertTriangle, 
    Check, 
    AlertCircle,
    User
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type DepartmentStatus = 'Not Started' | 'Pending' | 'Cleared' | 'Rejected';

type DeptClearance = {
    status: DepartmentStatus;
    notes: string;
};

type ClearanceStudent = {
    uid: string;
    studentName: string;
    studentEmail: string;
    academic: DeptClearance;
    finance: DeptClearance;
    library: DeptClearance;
    hostel: DeptClearance;
    registry: DeptClearance;
    overallStatus: 'Not Started' | 'Pending' | 'Cleared' | 'Rejected';
    submittedAt?: string;
    clearanceDate?: string;
};

export default function AdminClearancePage() {
    const [loading, setLoading] = React.useState(true);
    const [updating, setUpdating] = React.useState(false);
    const [students, setStudents] = React.useState<ClearanceStudent[]>([]);
    const [selectedStudent, setSelectedStudent] = React.useState<ClearanceStudent | null>(null);
    
    // Search and filters
    const [searchQuery, setSearchQuery] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<string>('ALL');

    // Override states
    const [academicStatus, setAcademicStatus] = React.useState<DepartmentStatus>('Pending');
    const [academicNotes, setAcademicNotes] = React.useState('');
    
    const [financeStatus, setFinanceStatus] = React.useState<DepartmentStatus>('Pending');
    const [financeNotes, setFinanceNotes] = React.useState('');
    
    const [libraryStatus, setLibraryStatus] = React.useState<DepartmentStatus>('Pending');
    const [libraryNotes, setLibraryNotes] = React.useState('');
    
    const [hostelStatus, setHostelStatus] = React.useState<DepartmentStatus>('Pending');
    const [hostelNotes, setHostelNotes] = React.useState('');
    
    const [registryStatus, setRegistryStatus] = React.useState<DepartmentStatus>('Pending');
    const [registryNotes, setRegistryNotes] = React.useState('');

    const [overallStatus, setOverallStatus] = React.useState<'Not Started' | 'Pending' | 'Cleared' | 'Rejected'>('Pending');

    // Dynamic suggested data for the selected student
    const [suggestedBalance, setSuggestedBalance] = React.useState<number | null>(null);
    const [suggestedBooks, setSuggestedBooks] = React.useState<number | null>(null);
    const [loadingSuggestions, setLoadingSuggestions] = React.useState(false);

    const { toast } = useToast();

    React.useEffect(() => {
        const clearancesRef = ref(db, 'graduationClearances');
        const unsub = onValue(clearancesRef, (snapshot) => {
            if (snapshot.exists()) {
                const list = Object.entries(snapshot.val()).map(([uid, data]: [string, any]) => ({
                    uid,
                    ...data
                }));
                setStudents(list);
            } else {
                setStudents([]);
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // Load selected student values into forms
    React.useEffect(() => {
        if (selectedStudent) {
            setAcademicStatus(selectedStudent.academic?.status || 'Pending');
            setAcademicNotes(selectedStudent.academic?.notes || '');
            
            setFinanceStatus(selectedStudent.finance?.status || 'Pending');
            setFinanceNotes(selectedStudent.finance?.notes || '');
            
            setLibraryStatus(selectedStudent.library?.status || 'Pending');
            setLibraryNotes(selectedStudent.library?.notes || '');
            
            setHostelStatus(selectedStudent.hostel?.status || 'Pending');
            setHostelNotes(selectedStudent.hostel?.notes || '');
            
            setRegistryStatus(selectedStudent.registry?.status || 'Pending');
            setRegistryNotes(selectedStudent.registry?.notes || '');

            setOverallStatus(selectedStudent.overallStatus || 'Pending');

            // Load live metrics
            loadLiveMetrics(selectedStudent.uid);
        } else {
            setSuggestedBalance(null);
            setSuggestedBooks(null);
        }
    }, [selectedStudent]);

    const loadLiveMetrics = async (uid: string) => {
        setLoadingSuggestions(true);
        try {
            // Finance calculation
            const regsSnap = await get(ref(db, `registrations/${uid}`));
            const invoicesSnap = await get(ref(db, `invoices/${uid}`));
            const transactionsSnap = await get(ref(db, 'transactions'));
            
            let totalDue = 0;
            let totalPaid = 0;

            if (regsSnap.exists()) {
                const regs = regsSnap.val();
                const invoices = invoicesSnap.val() || {};
                Object.values(regs).forEach((reg: any) => {
                    if (reg.invoiceId && invoices[reg.invoiceId]) {
                        const inv = invoices[reg.invoiceId];
                        const tuition = Number(inv.totalTuition || 0);
                        const mandatory = Number(inv.totalMandatoryFees || 0);
                        const optional = Number(inv.totalOptionalFees || 0);
                        const late = Number(inv.lateFee || 0);
                        const scholPerc = Number(inv.scholarshipPercentage || 0);
                        
                        const scholarshipAmount = inv.applyScholarship ? (tuition * (scholPerc / 100)) : 0;
                        totalDue += (tuition - scholarshipAmount + mandatory + optional + late);
                    }
                });
            }

            if (transactionsSnap.exists()) {
                Object.values(transactionsSnap.val()).forEach((t: any) => {
                    if (t.userId === uid && t.status === 'successful') {
                        totalPaid += (Number(t.amount) || 0);
                    }
                });
            }
            setSuggestedBalance(Math.max(0, totalDue - totalPaid));

            // Library books calculation
            const bookRequestsSnap = await get(ref(db, 'bookRequests'));
            let activeLoans = 0;
            if (bookRequestsSnap.exists()) {
                Object.values(bookRequestsSnap.val()).forEach((req: any) => {
                    if (req.userId === uid && req.status === 'Checked Out') {
                        activeLoans++;
                    }
                });
            }
            setSuggestedBooks(activeLoans);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingSuggestions(false);
        }
    };

    const handleSaveClearance = async () => {
        if (!selectedStudent) return;
        setUpdating(true);
        try {
            const updates: Record<string, any> = {};
            const path = `graduationClearances/${selectedStudent.uid}`;
            
            updates[`${path}/academic`] = { status: academicStatus, notes: academicNotes, updatedAt: new Date().toISOString() };
            updates[`${path}/finance`] = { status: financeStatus, notes: financeNotes, updatedAt: new Date().toISOString() };
            updates[`${path}/library`] = { status: libraryStatus, notes: libraryNotes, updatedAt: new Date().toISOString() };
            updates[`${path}/hostel`] = { status: hostelStatus, notes: hostelNotes, updatedAt: new Date().toISOString() };
            updates[`${path}/registry`] = { status: registryStatus, notes: registryNotes, updatedAt: new Date().toISOString() };
            updates[`${path}/overallStatus`] = overallStatus;
            
            if (overallStatus === 'Cleared') {
                updates[`${path}/clearanceDate`] = new Date().toISOString();
            }

            await update(ref(db), updates);

            // Notify Student
            await createNotification(
                selectedStudent.uid,
                `Your Graduation Clearance file status has been updated to "${overallStatus}". Please review details in the portal.`,
                '/student/graduation/clearance'
            );

            toast({ title: 'Clearance Updated', description: 'Student clearance details saved and notification dispatched.' });
            
            // Refresh detail reference
            setSelectedStudent(prev => prev ? { 
                ...prev, 
                academic: { status: academicStatus, notes: academicNotes },
                finance: { status: financeStatus, notes: financeNotes },
                library: { status: libraryStatus, notes: libraryNotes },
                hostel: { status: hostelStatus, notes: hostelNotes },
                registry: { status: registryStatus, notes: registryNotes },
                overallStatus
            } : null);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Update failed', description: e.message });
        } finally {
            setUpdating(false);
        }
    };

    const filteredStudents = students.filter(student => {
        const matchesSearch = 
            student.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            student.studentEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
            student.uid.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesStatus = statusFilter === 'ALL' || student.overallStatus === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Cleared': return <Badge className="bg-green-500 hover:bg-green-600 text-white font-bold">Cleared</Badge>;
            case 'Pending': return <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold">Pending</Badge>;
            case 'Rejected': return <Badge className="bg-red-500 hover:bg-red-600 text-white font-bold">Rejected</Badge>;
            default: return <Badge variant="secondary">Not Started</Badge>;
        }
    };

    if (loading) return <div className="p-6 space-y-4"><Loader2 className="animate-spin" /> Loading Clearance Registry...</div>;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Student List */}
            <div className="lg:col-span-5 space-y-4">
                <Card className="shadow-lg border-0">
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="flex items-center gap-2">
                            <GraduationCap className="h-6 w-6 text-primary" /> Clearance Audit Registry
                        </CardTitle>
                        <CardDescription>Review and manage student graduation clearance status.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Search student or UID..." 
                                    className="pl-8 text-sm"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-32"><SelectValue placeholder="Status" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Statuses</SelectItem>
                                    <SelectItem value="Pending">Pending</SelectItem>
                                    <SelectItem value="Cleared">Cleared</SelectItem>
                                    <SelectItem value="Rejected">Rejected</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {filteredStudents.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic text-center py-6">No clearance files matched filters.</p>
                        ) : (
                            <div className="border rounded-md overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead className="text-xs">Student</TableHead>
                                            <TableHead className="text-xs text-right">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredStudents.map((s) => (
                                            <TableRow 
                                                key={s.uid}
                                                className={`cursor-pointer transition-colors duration-150 ${selectedStudent?.uid === s.uid ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/30'}`}
                                                onClick={() => setSelectedStudent(s)}
                                            >
                                                <TableCell className="py-2.5">
                                                    <div className="font-semibold text-xs leading-none mb-1">{s.studentName}</div>
                                                    <div className="text-[10px] text-muted-foreground">{s.studentEmail}</div>
                                                </TableCell>
                                                <TableCell className="text-right py-2.5">
                                                    {getStatusBadge(s.overallStatus)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Right Column: Clearance Details Form */}
            <div className="lg:col-span-7">
                {selectedStudent ? (
                    <Card className="shadow-lg border-0">
                        <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
                            <div className="space-y-1">
                                <CardTitle className="text-lg flex items-center gap-1.5"><User className="h-5 w-5 text-primary"/> Clearance Review: {selectedStudent.studentName}</CardTitle>
                                <CardDescription className="text-xs">UID: {selectedStudent.uid} | Email: {selectedStudent.studentEmail}</CardDescription>
                            </div>
                            <div>
                                {getStatusBadge(selectedStudent.overallStatus)}
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-6">
                            {/* Live metrics recommendation box */}
                            <div className="p-4 rounded-xl border bg-primary/5 space-y-2">
                                <h4 className="font-bold text-xs uppercase tracking-widest text-primary flex items-center gap-1.5"><Info className="h-4 w-4"/> Dynamic System Checks</h4>
                                {loadingSuggestions ? (
                                    <div className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="animate-spin h-3.5 w-3.5" /> Checking database balances...</div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                        <div className="p-2 border rounded-lg bg-background flex items-center justify-between">
                                            <span className="text-muted-foreground">Unpaid Balance:</span>
                                            <span className={suggestedBalance && suggestedBalance > 0.01 ? "font-bold text-red-500" : "font-bold text-green-600"}>
                                                ZMW {suggestedBalance !== null ? suggestedBalance.toFixed(2) : '0.00'}
                                            </span>
                                        </div>
                                        <div className="p-2 border rounded-lg bg-background flex items-center justify-between">
                                            <span className="text-muted-foreground">Library Loans:</span>
                                            <span className={suggestedBooks && suggestedBooks > 0 ? "font-bold text-red-500" : "font-bold text-green-600"}>
                                                {suggestedBooks || '0'} Books
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Section: Department Breakdown Overrides */}
                            <div className="space-y-4">
                                <h4 className="font-bold text-sm uppercase tracking-wide text-muted-foreground">Department clearance audits</h4>

                                {/* Academic */}
                                <div className="p-3 border rounded-lg space-y-2 bg-muted/20">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                        <Label className="font-semibold text-xs flex items-center gap-1.5"><GraduationCap className="h-4 w-4 text-indigo-500"/> Academic Records</Label>
                                        <Select value={academicStatus} onValueChange={(val: DepartmentStatus) => setAcademicStatus(val)}>
                                            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Pending">Pending</SelectItem>
                                                <SelectItem value="Cleared">Cleared</SelectItem>
                                                <SelectItem value="Rejected">Rejected</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Input 
                                        placeholder="Add notes for academic clearance..." 
                                        className="h-8 text-xs"
                                        value={academicNotes}
                                        onChange={e => setAcademicNotes(e.target.value)}
                                    />
                                </div>

                                {/* Finance */}
                                <div className="p-3 border rounded-lg space-y-2 bg-muted/20">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                        <Label className="font-semibold text-xs flex items-center gap-1.5"><DollarSign className="h-4 w-4 text-emerald-500"/> Finance & Billing</Label>
                                        <div className="flex items-center gap-2">
                                            {suggestedBalance !== null && suggestedBalance <= 0.01 && financeStatus !== 'Cleared' && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-7 text-[10px] text-green-600 font-bold bg-green-50 hover:bg-green-100"
                                                    onClick={() => setFinanceStatus('Cleared')}
                                                >
                                                    Auto-Clear
                                                </Button>
                                            )}
                                            <Select value={financeStatus} onValueChange={(val: DepartmentStatus) => setFinanceStatus(val)}>
                                                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Pending">Pending</SelectItem>
                                                    <SelectItem value="Cleared">Cleared</SelectItem>
                                                    <SelectItem value="Rejected">Rejected</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <Input 
                                        placeholder="Add notes for financial clearance..." 
                                        className="h-8 text-xs"
                                        value={financeNotes}
                                        onChange={e => setFinanceNotes(e.target.value)}
                                    />
                                </div>

                                {/* Library */}
                                <div className="p-3 border rounded-lg space-y-2 bg-muted/20">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                        <Label className="font-semibold text-xs flex items-center gap-1.5"><Library className="h-4 w-4 text-blue-500"/> Library System</Label>
                                        <div className="flex items-center gap-2">
                                            {suggestedBooks === 0 && libraryStatus !== 'Cleared' && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-7 text-[10px] text-green-600 font-bold bg-green-50 hover:bg-green-100"
                                                    onClick={() => setLibraryStatus('Cleared')}
                                                >
                                                    Auto-Clear
                                                </Button>
                                            )}
                                            <Select value={libraryStatus} onValueChange={(val: DepartmentStatus) => setLibraryStatus(val)}>
                                                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Pending">Pending</SelectItem>
                                                    <SelectItem value="Cleared">Cleared</SelectItem>
                                                    <SelectItem value="Rejected">Rejected</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <Input 
                                        placeholder="Add notes for library clearance..." 
                                        className="h-8 text-xs"
                                        value={libraryNotes}
                                        onChange={e => setLibraryNotes(e.target.value)}
                                    />
                                </div>

                                {/* Hostel */}
                                <div className="p-3 border rounded-lg space-y-2 bg-muted/20">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                        <Label className="font-semibold text-xs flex items-center gap-1.5"><Building className="h-4 w-4 text-amber-500"/> Hostel & Housing</Label>
                                        <Select value={hostelStatus} onValueChange={(val: DepartmentStatus) => setHostelStatus(val)}>
                                            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Pending">Pending</SelectItem>
                                                <SelectItem value="Cleared">Cleared</SelectItem>
                                                <SelectItem value="Rejected">Rejected</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Input 
                                        placeholder="Add notes for hostel clearance..." 
                                        className="h-8 text-xs"
                                        value={hostelNotes}
                                        onChange={e => setHostelNotes(e.target.value)}
                                    />
                                </div>

                                {/* Registry */}
                                <div className="p-3 border rounded-lg space-y-2 bg-muted/20">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                        <Label className="font-semibold text-xs flex items-center gap-1.5"><Clock className="h-4 w-4 text-rose-500"/> Document Registry</Label>
                                        <Select value={registryStatus} onValueChange={(val: DepartmentStatus) => setRegistryStatus(val)}>
                                            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Pending">Pending</SelectItem>
                                                <SelectItem value="Cleared">Cleared</SelectItem>
                                                <SelectItem value="Rejected">Rejected</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Input 
                                        placeholder="Add notes for registry documents..." 
                                        className="h-8 text-xs"
                                        value={registryNotes}
                                        onChange={e => setRegistryNotes(e.target.value)}
                                    />
                                </div>
                            </div>

                            <Separator />

                            {/* Overall Clearance Selection */}
                            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div className="space-y-1">
                                    <Label className="font-bold text-sm">Final Clearance Decision</Label>
                                    <p className="text-[10px] text-muted-foreground leading-normal">
                                        Marking overall status as 'Cleared' enables the student to download their Graduation Clearance Certificate.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {academicStatus === 'Cleared' && 
                                     financeStatus === 'Cleared' && 
                                     libraryStatus === 'Cleared' && 
                                     hostelStatus === 'Cleared' && 
                                     registryStatus === 'Cleared' && 
                                     overallStatus !== 'Cleared' && (
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-9 px-2 text-xs text-green-600 font-bold bg-green-50 hover:bg-green-100"
                                            onClick={() => setOverallStatus('Cleared')}
                                        >
                                            Clear Student
                                        </Button>
                                    )}
                                    <Select value={overallStatus} onValueChange={(val: any) => setOverallStatus(val)}>
                                        <SelectTrigger className="w-36 h-9 font-bold text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Pending">Pending Review</SelectItem>
                                            <SelectItem value="Cleared">Fully Cleared</SelectItem>
                                            <SelectItem value="Rejected">Flagged / Rejected</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="border-t pt-4 flex justify-end">
                            <Button 
                                size="sm" 
                                className="font-bold" 
                                disabled={updating} 
                                onClick={handleSaveClearance}
                            >
                                {updating ? <Loader2 className="animate-spin mr-1.5 h-4 w-4" /> : <Save className="mr-1.5 h-4 w-4" />}
                                Save Review Updates
                            </Button>
                        </CardFooter>
                    </Card>
                ) : (
                    <Card className="h-full border border-dashed flex items-center justify-center min-h-[300px]">
                        <p className="text-muted-foreground text-sm italic">Select a student clearance file from the registry audit list to start reviewing details.</p>
                    </Card>
                )}
            </div>
        </div>
    );
}
