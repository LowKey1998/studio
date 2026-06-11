'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, get, set, remove, push, update } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { format, parseISO } from 'date-fns';
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';
import { calculateBilling } from '@/lib/billing-utils';
import { Loader2, ArrowLeft, Info, Play, RotateCcw, CheckCircle, AlertCircle, FileText, CheckSquare, Square, Trash, ChevronDown, ChevronUp } from 'lucide-react';
import NextLink from 'next/link';

type PreviewStudent = {
    studentUid: string;
    studentName: string;
    studentId: string;
    programmeId: string;
    intakeId: string;
    semesterId: string;
    semesterName: string;
    courses: string[];
    billingBreakdown: any;
};

type BatchRegistration = {
    studentUid: string;
    studentName: string;
    studentId: string;
    semesterId: string;
    semesterName: string;
    invoiceId: string;
    status: 'active' | 'undone';
};

type AutoRegistrationBatch = {
    batchId: string;
    timestamp: number;
    registeredCount: number;
    status: 'active' | 'undone' | 'partially_undone';
    registrations: BatchRegistration[];
};

export default function AdminAutoRegistrationsPage() {
    const [loading, setLoading] = React.useState(true);
    const [scanning, setScanning] = React.useState(false);
    const [executing, setExecuting] = React.useState(false);
    const [undoing, setUndoing] = React.useState<string | null>(null);

    const [previewList, setPreviewList] = React.useState<PreviewStudent[]>([]);
    const [selectedStudents, setSelectedStudents] = React.useState<Record<string, boolean>>({});
    const [batches, setBatches] = React.useState<AutoRegistrationBatch[]>([]);
    const [expandedBatches, setExpandedBatches] = React.useState<Record<string, boolean>>({});
    const [selectedLogRegs, setSelectedLogRegs] = React.useState<Record<string, Record<string, boolean>>>({});

    const { toast } = useToast();

    // Fetch batches and historical logs
    const fetchBatches = React.useCallback(async () => {
        try {
            const snap = await get(ref(db, 'adminAutoRegistrations'));
            if (snap.exists()) {
                const data = snap.val();
                const list: AutoRegistrationBatch[] = Object.entries(data).map(([id, val]: [string, any]) => ({
                    batchId: id,
                    ...val,
                    registrations: val.registrations || []
                }));
                // Sort by timestamp desc
                setBatches(list.sort((a, b) => b.timestamp - a.timestamp));
            } else {
                setBatches([]);
            }
        } catch (err) {
            console.error("Error fetching batches:", err);
        }
    }, []);

    React.useEffect(() => {
        const loadInitData = async () => {
            setLoading(true);
            await fetchBatches();
            setLoading(false);
        };
        loadInitData();
    }, [fetchBatches]);

    // Scan students for auto-registration potential
    const handleScan = async () => {
        setScanning(true);
        setPreviewList([]);
        setSelectedStudents({});
        try {
            const [calendarSnap, semestersSnap, intakesSnap, coursesSnap, registrationsSnap, coursePathsSnap, usersSnap] = await Promise.all([
                get(ref(db, 'settings/academicCalendar')),
                get(ref(db, 'semesters')),
                get(ref(db, 'intakes')),
                get(ref(db, 'courses')),
                get(ref(db, 'registrations')),
                get(ref(db, 'coursePaths')),
                get(ref(db, 'users'))
            ]);

            if (!calendarSnap.exists() || !semestersSnap.exists() || !usersSnap.exists()) {
                toast({ variant: 'destructive', title: 'Data Missing', description: 'Academic settings or semesters data is empty.' });
                setScanning(false);
                return;
            }

            const calendarSettings = calendarSnap.val();
            const semesters = semestersSnap.val();
            const users = usersSnap.val();
            const registrations = registrationsSnap.val() || {};
            const coursePaths = coursePathsSnap.val() || {};
            const courses = coursesSnap.val() || {};

            const studentsList = Object.entries(users)
                .filter(([_, u]: [string, any]) => u.role === 'Student' && u.intakeId && u.programmeId)
                .map(([uid, u]: [string, any]) => ({ uid, ...u }));

            const foundCandidates: PreviewStudent[] = [];

            for (const student of studentsList) {
                const intake = intakesSnap.val()?.[student.intakeId];
                if (!intake) continue;

                const intakeDateStr = parseIntakeDate(intake.name);
                if (!intakeDateStr) continue;

                // Calculate academic standing (current year/semester)
                const standing = calculateAcademicState(
                    intakeDateStr,
                    new Date(),
                    calendarSettings.standardCycles,
                    Object.values(calendarSettings.anomalies || {})
                );

                // Find active semester matching academic standing
                const targetSemesterEntry = Object.entries(semesters).find(([_, s]: [string, any]) => 
                    s.intakeId === student.intakeId &&
                    s.year === standing.year &&
                    s.semesterInYear === standing.semester
                );

                if (!targetSemesterEntry) continue;
                const [semId, semData] = targetSemesterEntry as [string, any];

                // Check if fees are set up/finalized for this semester
                if (!semData.isFeesSet) continue;

                // Check if student is already registered to this semester
                const studentRegs = registrations[student.uid] || {};
                if (studentRegs[semId]) continue; // Already registered

                // Find courses mapped to this program and semester phase
                const path = Object.values(coursePaths).find((p: any) => 
                    p.intakeId === student.intakeId && 
                    p.programmeId === student.programmeId
                ) as any;

                const selectedCourseIds: string[] = (path?.semesters?.[semId]?.courses) || [];

                // Calculate billing invoice breakdown
                const breakdown = calculateBilling({
                    policy: semData.billingPolicy || 'course',
                    semesterTuition: semData.tuitionFee || 0,
                    courses: selectedCourseIds.map(cid => ({ id: cid, cost: courses[cid]?.cost || 0 })),
                    mandatoryFees: Object.values(semData.mandatoryFees || {}),
                    optionalFees: [],
                    applyScholarship: false,
                    scholarshipPercentage: 0,
                    lateFee: 0
                });

                foundCandidates.push({
                    studentUid: student.uid,
                    studentName: student.name,
                    studentId: student.id || 'N/A',
                    programmeId: student.programmeId,
                    intakeId: student.intakeId,
                    semesterId: semId,
                    semesterName: semData.name,
                    courses: selectedCourseIds,
                    billingBreakdown: breakdown
                });
            }

            setPreviewList(foundCandidates);

            // Auto-select all candidates by default
            const initialSelected: Record<string, boolean> = {};
            foundCandidates.forEach(cand => {
                initialSelected[cand.studentUid] = true;
            });
            setSelectedStudents(initialSelected);

            if (foundCandidates.length === 0) {
                toast({ title: 'Scan Complete', description: 'All students are already registered for their current standings.' });
            } else {
                toast({ title: 'Scan Complete', description: `Found ${foundCandidates.length} students who require registration.` });
            }

        } catch (err: any) {
            console.error("Scanning failed:", err);
            toast({ variant: 'destructive', title: 'Scan Failed', description: err.message });
        } finally {
            setScanning(false);
        }
    };

    // Execute bulk auto-registration
    const handleExecuteAutoRegistration = async () => {
        const studentsToRegister = previewList.filter(s => selectedStudents[s.studentUid]);
        if (studentsToRegister.length === 0) {
            toast({ variant: 'destructive', title: 'No Selection', description: 'Please select at least one student.' });
            return;
        }

        setExecuting(true);
        try {
            const batchId = `auto-batch-${Date.now()}`;
            const timestamp = Date.now();
            const updates: Record<string, any> = {};
            const batchRegistrations: BatchRegistration[] = [];

            for (const item of studentsToRegister) {
                const invoiceRef = push(ref(db, `invoices/${item.studentUid}`));
                const invoiceId = invoiceRef.key!;

                // Invoice Data
                const invoiceData = {
                    invoiceId,
                    totalTuition: item.billingBreakdown.baseTuition,
                    totalMandatoryFees: item.billingBreakdown.totalMandatoryFees,
                    totalOptionalFees: item.billingBreakdown.totalOptionalFees,
                    lateFee: item.billingBreakdown.lateFee,
                    paymentPlan: 'full',
                    dateCreated: new Date().toISOString(),
                    semester: item.semesterName,
                    semesterId: item.semesterId,
                    courses: item.courses,
                    optionalFees: [],
                    applyScholarship: false,
                    source: 'auto-registration'
                };

                // Registration Data
                const registrationData = {
                    courses: item.courses,
                    optionalFees: [],
                    invoiceId,
                    status: 'Completed', // Admin auto-registration directly registers them
                    paymentPlan: 'full',
                    programmeId: item.programmeId,
                    registrationDate: new Date().toISOString(),
                    applyScholarship: false,
                    semesterName: item.semesterName,
                    source: 'auto-registration'
                };

                updates[`invoices/${item.studentUid}/${invoiceId}`] = invoiceData;
                updates[`registrations/${item.studentUid}/${item.semesterId}`] = registrationData;

                batchRegistrations.push({
                    studentUid: item.studentUid,
                    studentName: item.studentName,
                    studentId: item.studentId,
                    semesterId: item.semesterId,
                    semesterName: item.semesterName,
                    invoiceId,
                    status: 'active'
                });
            }

            // Batch logging entry
            const batchData: AutoRegistrationBatch = {
                batchId,
                timestamp,
                registeredCount: batchRegistrations.length,
                status: 'active',
                registrations: batchRegistrations
            };

            updates[`adminAutoRegistrations/${batchId}`] = batchData;

            await update(ref(db), updates);

            toast({ variant: 'success', title: 'Registration Complete', description: `Successfully registered ${batchRegistrations.length} students.` });
            setPreviewList([]);
            setSelectedStudents({});
            await fetchBatches();

        } catch (err: any) {
            console.error("Auto registration failed:", err);
            toast({ variant: 'destructive', title: 'Operation Failed', description: err.message });
        } finally {
            setExecuting(false);
        }
    };

    // Helper: Undo registrations from a batch
    const executeUndoList = async (batch: AutoRegistrationBatch, uidsToUndo: string[]) => {
        const batchRef = ref(db, `adminAutoRegistrations/${batch.batchId}`);
        const updates: Record<string, any> = {};

        // Prepare removals and local log updates
        const updatedRegs = batch.registrations.map(reg => {
            if (uidsToUndo.includes(reg.studentUid) && reg.status === 'active') {
                // Remove registrations and invoices
                updates[`registrations/${reg.studentUid}/${reg.semesterId}`] = null;
                updates[`invoices/${reg.studentUid}/${reg.invoiceId}`] = null;
                return { ...reg, status: 'undone' as const };
            }
            return reg;
        });

        // Determine new status
        const activeCount = updatedRegs.filter(r => r.status === 'active').length;
        let newStatus: 'active' | 'undone' | 'partially_undone' = 'active';
        if (activeCount === 0) {
            newStatus = 'undone';
        } else if (activeCount < updatedRegs.length) {
            newStatus = 'partially_undone';
        }

        const updatedBatch = {
            ...batch,
            status: newStatus,
            registrations: updatedRegs
        };

        updates[`adminAutoRegistrations/${batch.batchId}`] = updatedBatch;

        await update(ref(db), updates);
    };

    // Undo single registration
    const handleUndoSingle = async (batch: AutoRegistrationBatch, studentUid: string) => {
        if (!window.confirm("Are you sure you want to undo this student's registration?")) return;
        setUndoing(`${batch.batchId}-${studentUid}`);
        try {
            await executeUndoList(batch, [studentUid]);
            toast({ title: 'Registration Undone', description: 'Student registration and invoice deleted.' });
            await fetchBatches();
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Undo Failed', description: err.message });
        } finally {
            setUndoing(null);
        }
    };

    // Undo selected registrations in a log batch
    const handleUndoSelectedLogs = async (batch: AutoRegistrationBatch) => {
        const selectedMap = selectedLogRegs[batch.batchId] || {};
        const uidsToUndo = Object.keys(selectedMap).filter(uid => selectedMap[uid]);

        if (uidsToUndo.length === 0) {
            toast({ variant: 'destructive', title: 'No Selection', description: 'Please select at least one student to undo.' });
            return;
        }

        if (!window.confirm(`Are you sure you want to undo registration for the ${uidsToUndo.length} selected students?`)) return;
        setUndoing(`${batch.batchId}-selected`);

        try {
            await executeUndoList(batch, uidsToUndo);
            toast({ title: 'Operation Successful', description: `Undid ${uidsToUndo.length} registrations.` });
            
            // Clear selection
            setSelectedLogRegs(prev => {
                const next = { ...prev };
                delete next[batch.batchId];
                return next;
            });

            await fetchBatches();
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Undo Failed', description: err.message });
        } finally {
            setUndoing(null);
        }
    };

    // Undo entire batch
    const handleUndoBatch = async (batch: AutoRegistrationBatch) => {
        const activeUids = batch.registrations.filter(r => r.status === 'active').map(r => r.studentUid);
        if (activeUids.length === 0) return;

        if (!window.confirm(`Are you sure you want to undo the entire batch? This will undo all ${activeUids.length} registrations.`)) return;
        setUndoing(batch.batchId);
        try {
            await executeUndoList(batch, activeUids);
            toast({ title: 'Batch Undone', description: 'Entire registration batch reversed successfully.' });
            await fetchBatches();
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Undo Failed', description: err.message });
        } finally {
            setUndoing(null);
        }
    };

    // Toggle expanding details of a batch
    const toggleBatchExpand = (batchId: string) => {
        setExpandedBatches(prev => ({
            ...prev,
            [batchId]: !prev[batchId]
        }));
    };

    // Toggle selection of student logs inside batch details
    const toggleLogRegSelect = (batchId: string, studentUid: string) => {
        setSelectedLogRegs(prev => {
            const batchSel = prev[batchId] || {};
            const nextBatchSel = { ...batchSel, [studentUid]: !batchSel[studentUid] };
            return { ...prev, [batchId]: nextBatchSel };
        });
    };

    // Toggle select all student logs inside batch details
    const toggleLogRegSelectAll = (batch: AutoRegistrationBatch) => {
        const batchId = batch.batchId;
        const currentSel = selectedLogRegs[batchId] || {};
        const activeRegs = batch.registrations.filter(r => r.status === 'active');
        const allSelected = activeRegs.every(r => currentSel[r.studentUid]);

        const nextBatchSel: Record<string, boolean> = {};
        if (!allSelected) {
            activeRegs.forEach(r => {
                nextBatchSel[r.studentUid] = true;
            });
        }

        setSelectedLogRegs(prev => ({
            ...prev,
            [batchId]: nextBatchSel
        }));
    };

    const toggleSelectAllPreview = () => {
        const allSelected = previewList.every(cand => selectedStudents[cand.studentUid]);
        const next: Record<string, boolean> = {};
        if (!allSelected) {
            previewList.forEach(cand => {
                next[cand.studentUid] = true;
            });
        }
        setSelectedStudents(next);
    };

    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-12 w-1/3" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    return (
        <main className="p-4 lg:p-6 space-y-6">
            {/* Header/Breadcrumbs */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <NextLink href="/admin/dashboard" className="hover:text-blue-600 transition-colors">EduTrack360</NextLink>
                    <span>/</span>
                    <NextLink href="/admin/settings" className="hover:text-blue-600 transition-colors">Settings</NextLink>
                    <span>/</span>
                    <span className="text-gray-800 font-medium">Auto-Registrations</span>
                </div>
                <Button variant="ghost" asChild className="font-bold gap-2">
                    <NextLink href="/admin/settings"><ArrowLeft className="h-4 w-4"/> Back to Settings</NextLink>
                </Button>
            </div>

            {/* Run Auto-Registration Card */}
            <Card className="shadow-lg border-t-4 border-t-primary">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold font-headline flex items-center gap-2">
                        <Play className="h-6 w-6 text-primary" /> Admin-Initiated Auto-Registration
                    </CardTitle>
                    <CardDescription>
                        Scans all students currently unregistered for their current standing's semester and automatically registers them, generating billing invoices. (Requires target semesters to have finalized fees).
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Button onClick={handleScan} disabled={scanning || executing} className="font-bold">
                            {scanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Play className="mr-2 h-4 w-4"/>}
                            Scan for Unregistered Students
                        </Button>
                    </div>

                    {previewList.length > 0 && (
                        <div className="border rounded-lg p-4 space-y-4 bg-muted/5 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center justify-between border-b pb-2">
                                <h3 className="font-bold text-sm text-primary uppercase">Scan Results: {previewList.length} Unregistered Candidates Found</h3>
                                <Badge variant="secondary">Previewing Operations</Badge>
                            </div>

                            <div className="border rounded-md overflow-hidden bg-background">
                                <Table>
                                    <TableHeader className="bg-muted/50 font-bold text-xs">
                                        <TableRow>
                                            <TableHead className="w-12 text-center">
                                                <Checkbox
                                                    checked={previewList.every(cand => selectedStudents[cand.studentUid])}
                                                    onCheckedChange={toggleSelectAllPreview}
                                                />
                                            </TableHead>
                                            <TableHead>Student ID</TableHead>
                                            <TableHead>Student Name</TableHead>
                                            <TableHead>Target Semester</TableHead>
                                            <TableHead className="text-right">Tuition Cost (ZMW)</TableHead>
                                            <TableHead className="text-right">Mandatory Fees (ZMW)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody className="text-xs">
                                        {previewList.map((cand) => (
                                            <TableRow key={cand.studentUid} className={selectedStudents[cand.studentUid] ? 'bg-primary/5' : ''}>
                                                <TableCell className="text-center">
                                                    <Checkbox
                                                        checked={!!selectedStudents[cand.studentUid]}
                                                        onCheckedChange={() => setSelectedStudents(prev => ({
                                                            ...prev,
                                                            [cand.studentUid]: !prev[cand.studentUid]
                                                        }))}
                                                    />
                                                </TableCell>
                                                <TableCell className="font-mono uppercase font-semibold">{cand.studentId}</TableCell>
                                                <TableCell className="font-semibold">{cand.studentName}</TableCell>
                                                <TableCell className="text-muted-foreground">{cand.semesterName}</TableCell>
                                                <TableCell className="text-right font-semibold">ZMW {cand.billingBreakdown.baseTuition.toFixed(2)}</TableCell>
                                                <TableCell className="text-right font-semibold">ZMW {cand.billingBreakdown.totalMandatoryFees.toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="ghost" onClick={() => setPreviewList([])} disabled={executing} className="font-bold">Cancel</Button>
                                <Button onClick={handleExecuteAutoRegistration} disabled={executing} className="font-bold bg-green-600 hover:bg-green-700 text-white shadow-md">
                                    {executing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4"/>}
                                    Confirm and Register ({previewList.filter(s => selectedStudents[s.studentUid]).length}) Students
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Historical Batches and Log Table */}
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="text-lg font-bold font-headline flex items-center gap-2">
                        <FileText className="h-5 w-5 text-muted-foreground" /> Auto-Registration History
                    </CardTitle>
                    <CardDescription>View, manage, and selectively reverse previous administrative auto-registrations.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {batches.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/10">
                            <Info className="mx-auto h-8 w-8 text-muted-foreground opacity-30 mb-2" />
                            <p className="text-sm text-muted-foreground italic">No historical auto-registrations logged.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {batches.map((batch) => {
                                const isExpanded = !!expandedBatches[batch.batchId];
                                const activeRegs = batch.registrations.filter(r => r.status === 'active');
                                const totalRegs = batch.registrations.length;
                                const isUndoAllDisabled = activeRegs.length === 0 || undoing !== null;

                                const batchSel = selectedLogRegs[batch.batchId] || {};
                                const selectedInBatchCount = Object.keys(batchSel).filter(uid => batchSel[uid]).length;

                                return (
                                    <div key={batch.batchId} className="border rounded-lg overflow-hidden bg-card shadow-sm transition-all duration-200">
                                        {/* Batch Row Header */}
                                        <div className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-muted/10 gap-4 border-b">
                                            <div className="flex items-center gap-4 cursor-pointer" onClick={() => toggleBatchExpand(batch.batchId)}>
                                                <button className="text-muted-foreground hover:text-foreground">
                                                    {isExpanded ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
                                                </button>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-sm font-mono text-primary">{batch.batchId}</span>
                                                        <Badge variant={
                                                            batch.status === 'undone' ? 'destructive' :
                                                            batch.status === 'partially_undone' ? 'secondary' : 'default'
                                                        } className="text-[9px] uppercase tracking-wider h-5 font-bold">
                                                            {batch.status}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        Executed on {format(new Date(batch.timestamp), 'PPP')} at {format(new Date(batch.timestamp), 'p')}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge variant="outline" className="font-semibold text-xs h-8 px-3">
                                                    {activeRegs.length} Active / {totalRegs} Total
                                                </Badge>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    disabled={isUndoAllDisabled}
                                                    onClick={() => handleUndoBatch(batch)}
                                                    className="font-bold h-8 flex items-center gap-1.5"
                                                >
                                                    {undoing === batch.batchId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                                                    Undo Batch
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Expanded Details */}
                                        {isExpanded && (
                                            <div className="p-4 bg-background border-t space-y-4 animate-in fade-in duration-200">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-xs font-bold text-muted-foreground uppercase">Roster Detail ({totalRegs} students)</h4>
                                                    {selectedInBatchCount > 0 && (
                                                        <Button
                                                            size="xs"
                                                            variant="destructive"
                                                            disabled={undoing !== null}
                                                            onClick={() => handleUndoSelectedLogs(batch)}
                                                            className="font-bold h-7 px-2.5 text-[10px] uppercase tracking-wider flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white"
                                                        >
                                                            {undoing === `${batch.batchId}-selected` ? <Loader2 className="h-3 w-3 animate-spin"/> : <RotateCcw className="h-3 w-3"/>}
                                                            Undo Selected ({selectedInBatchCount})
                                                        </Button>
                                                    )}
                                                </div>

                                                <div className="border rounded-md overflow-hidden bg-card">
                                                    <Table>
                                                        <TableHeader className="bg-muted/20 font-bold text-[10px] uppercase">
                                                            <TableRow>
                                                                <TableHead className="w-12 text-center">
                                                                    {activeRegs.length > 0 && (
                                                                        <Checkbox
                                                                            checked={activeRegs.every(r => batchSel[r.studentUid])}
                                                                            onCheckedChange={() => toggleLogRegSelectAll(batch)}
                                                                        />
                                                                    )}
                                                                </TableHead>
                                                                <TableHead>Student ID</TableHead>
                                                                <TableHead>Student Name</TableHead>
                                                                <TableHead>Registered Semester</TableHead>
                                                                <TableHead>Invoice ID</TableHead>
                                                                <TableHead className="text-center">Status</TableHead>
                                                                <TableHead className="text-right w-24">Action</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody className="text-xs">
                                                            {batch.registrations.map((reg) => {
                                                                const isRegActive = reg.status === 'active';
                                                                const isSelected = !!batchSel[reg.studentUid];

                                                                return (
                                                                    <TableRow key={reg.studentUid} className={isSelected && isRegActive ? 'bg-primary/5' : ''}>
                                                                        <TableCell className="text-center">
                                                                            {isRegActive ? (
                                                                                <Checkbox
                                                                                    checked={isSelected}
                                                                                    onCheckedChange={() => toggleLogRegSelect(batch.batchId, reg.studentUid)}
                                                                                />
                                                                            ) : (
                                                                                <div className="h-4 w-4" />
                                                                            )}
                                                                        </TableCell>
                                                                        <TableCell className="font-mono uppercase font-semibold text-[11px]">{reg.studentId}</TableCell>
                                                                        <TableCell className="font-semibold">{reg.studentName}</TableCell>
                                                                        <TableCell className="text-muted-foreground">{reg.semesterName}</TableCell>
                                                                        <TableCell className="font-mono text-[10px] text-muted-foreground uppercase">{reg.invoiceId}</TableCell>
                                                                        <TableCell className="text-center">
                                                                            <Badge variant={isRegActive ? 'outline' : 'destructive'} className="text-[8px] uppercase tracking-wide px-1.5 h-4.5 font-bold">
                                                                                {reg.status}
                                                                            </Badge>
                                                                        </TableCell>
                                                                        <TableCell className="text-right">
                                                                            {isRegActive ? (
                                                                                <Button
                                                                                    size="xs"
                                                                                    variant="ghost"
                                                                                    disabled={undoing !== null}
                                                                                    onClick={() => handleUndoSingle(batch, reg.studentUid)}
                                                                                    className="h-7 w-16 text-[10px] font-bold text-destructive hover:bg-destructive/10"
                                                                                >
                                                                                    {undoing === `${batch.batchId}-${reg.studentUid}` ? (
                                                                                        <Loader2 className="h-3 w-3 animate-spin"/>
                                                                                    ) : (
                                                                                        'Undo'
                                                                                    )}
                                                                                </Button>
                                                                            ) : (
                                                                                <span className="text-[10px] text-muted-foreground italic pr-2">Reversed</span>
                                                                            )}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                );
                                                            })}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}
