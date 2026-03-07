
"use client";

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Printer, GraduationCap, UserCheck, PlusCircle, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, get, update } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';

type Student = {
    uid: string;
    id: string;
    name: string;
    email: string;
    programmeId?: string;
    programmeName?: string;
    intakeId?: string;
    scholarshipId?: string;
    scholarshipName?: string;
    scholarshipPercentage?: number;
};

type ScholarshipType = { id: string; name: string; percentage: number; donor?: string; };
type Intake = { id: string; name: string; };

export default function ScholarshipAssignmentsPage() {
    const [students, setStudents] = React.useState<Student[]>([]);
    const [scholarships, setScholarships] = React.useState<ScholarshipType[]>([]);
    const [programmes, setProgrammes] = React.useState<any[]>([]);
    const [intakes, setIntakes] = React.useState<Intake[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [actionLoading, setActionLoading] = React.useState<string | null>(null);
    
    const [searchTerm, setSearchTerm] = React.useState('');
    const [programmeFilter, setProgrammeFilter] = React.useState('all');
    const [intakeFilter, setIntakeFilter] = React.useState('all');
    const [scholarshipFilter, setScholarshipFilter] = React.useState('all');

    const { toast } = useToast();

    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [usersSnap, progSnap, scholSnap, intakesSnap] = await Promise.all([
                get(ref(db, 'users')),
                get(ref(db, 'programmes')),
                get(ref(db, 'scholarships')),
                get(ref(db, 'intakes'))
            ]);

            const progs = progSnap.val() || {};
            const schols = scholSnap.val() || {};
            const ints = intakesSnap.val() || {};
            
            setProgrammes(Object.entries(progs).map(([id, d]:[string, any]) => ({ id, ...d })));
            setScholarships(Object.entries(schols).map(([id, d]:[string, any]) => ({ id, ...d })));
            setIntakes(Object.entries(ints).map(([id, d]: [string, any]) => ({ id, ...d })).sort((a,b) => b.name.localeCompare(a.name)));

            if (usersSnap.exists()) {
                const usersData = usersSnap.val();
                const list = Object.keys(usersData)
                    .filter(uid => usersData[uid].role === 'Student')
                    .map(uid => {
                        const student = usersData[uid];
                        const sId = student.scholarshipId;
                        return {
                            uid,
                            ...student,
                            programmeName: progs[student.programmeId]?.name || 'N/A',
                            scholarshipName: sId ? schols[sId]?.name : null,
                            scholarshipPercentage: sId ? schols[sId]?.percentage : 0
                        };
                    });
                setStudents(list);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAssign = async (studentUid: string, scholId: string) => {
        if (!scholId) return;
        setActionLoading(studentUid);
        try {
            const scholarship = scholarships.find(s => s.id === scholId);
            const updates: Record<string, any> = {
                [`users/${studentUid}/scholarshipId`]: scholId === 'none' ? null : scholId
            };
            
            const regsSnap = await get(ref(db, `registrations/${studentUid}`));
            if (regsSnap.exists()) {
                const regs = regsSnap.val();
                Object.keys(regs).forEach(sid => {
                    if (regs[sid].status !== 'Archived') {
                        const invId = regs[sid].invoiceId;
                        const hasSchol = scholId !== 'none';
                        const perc = hasSchol ? scholarship?.percentage : 0;

                        if (invId) {
                            updates[`invoices/${studentUid}/${invId}/applyScholarship`] = hasSchol;
                            updates[`invoices/${studentUid}/${invId}/scholarshipId`] = hasSchol ? scholId : null;
                            updates[`invoices/${studentUid}/${invId}/scholarshipPercentage`] = perc;
                        }
                        updates[`registrations/${studentUid}/${sid}/applyScholarship`] = hasSchol;
                        updates[`registrations/${studentUid}/${sid}/scholarshipId`] = hasSchol ? scholId : null;
                        updates[`registrations/${studentUid}/${sid}/scholarshipPercentage`] = perc;
                    }
                });
            }

            await update(ref(db), updates);
            toast({ title: scholId === 'none' ? 'Scholarship Removed' : 'Scholarship Assigned' });
            
            setStudents(prev => prev.map(s => s.uid === studentUid ? { 
                ...s, 
                scholarshipId: scholId === 'none' ? undefined : scholId,
                scholarshipName: scholId === 'none' ? undefined : scholarship?.name,
                scholarshipPercentage: scholId === 'none' ? 0 : scholarship?.percentage
            } : s));
        } catch (e) {
            toast({ variant: 'destructive', title: 'Action Failed' });
        } finally {
            setActionLoading(null);
        }
    };

    const handlePrint = () => {
        const doc = new jsPDF();
        const head = [["ID", "Name", "Programme", "Scholarship", "Waiver %"]];
        const body = filteredStudents.map(s => [s.id, s.name, s.programmeName || 'N/A', s.scholarshipName || 'None', s.scholarshipPercentage ? `${s.scholarshipPercentage}%` : '-']);
        doc.text("Scholarship Recipient List", 14, 22);
        autoTable(doc, { head, body, startY: 30 });
        doc.save(`Scholarships_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    const filteredStudents = React.useMemo(() => {
        return students.filter(s => {
            const searchMatch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.id.toLowerCase().includes(searchTerm.toLowerCase());
            const progMatch = programmeFilter === 'all' || s.programmeId === programmeFilter;
            const intakeMatch = intakeFilter === 'all' || s.intakeId === intakeFilter;
            const scholMatch = scholarshipFilter === 'all' ? true : (scholarshipFilter === 'active' ? !!s.scholarshipId : !s.scholarshipId);
            return searchMatch && progMatch && intakeMatch && scholMatch;
        });
    }, [students, searchTerm, programmeFilter, intakeFilter, scholarshipFilter]);

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary rounded-lg shadow-md"><GraduationCap className="h-6 w-6 text-white" /></div>
                            <div>
                                <CardTitle className="font-headline text-2xl">Scholarship Center</CardTitle>
                                <CardDescription>Assign financial aid and manage tuition waivers for students.</CardDescription>
                            </div>
                        </div>
                        <Button variant="outline" onClick={handlePrint} disabled={filteredStudents.length === 0}><Printer className="mr-2 h-4 w-4"/> Print Recipient List</Button>
                    </div>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase">Search Student</Label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Name or ID..." className="pl-8 h-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase">Intake</Label>
                            <Select value={intakeFilter} onValueChange={setIntakeFilter}>
                                <SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Intakes</SelectItem>
                                    {intakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase">Programme</Label>
                            <Select value={programmeFilter} onValueChange={setProgrammeFilter}>
                                <SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Programmes</SelectItem>
                                    {programmes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase">Status</Label>
                            <Select value={scholarshipFilter} onValueChange={setScholarshipFilter}>
                                <SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Students</SelectItem>
                                    <SelectItem value="active">Recipients Only</SelectItem>
                                    <SelectItem value="none">No Scholarship</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border shadow-sm">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Student</TableHead>
                                    <TableHead>Programme</TableHead>
                                    <TableHead>Current Scholarship</TableHead>
                                    <TableHead className="text-right">Manage Waiver</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? Array.from({length: 5}).map((_, i) => <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-10 w-full"/></TableCell></TableRow>) :
                                filteredStudents.map(student => (
                                    <TableRow key={student.uid}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm">{student.name}</span>
                                                <span className="text-[10px] text-muted-foreground uppercase">{student.id}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs">{student.programmeName}</TableCell>
                                        <TableCell>
                                            {student.scholarshipId ? (
                                                <Badge className="bg-blue-600 hover:bg-blue-700 gap-1.5 h-6">
                                                    <UserCheck className="h-3 w-3"/>
                                                    {student.scholarshipName} ({student.scholarshipPercentage}%)
                                                </Badge>
                                            ) : <span className="text-xs text-muted-foreground italic">None assigned</span>}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Select value={student.scholarshipId || 'none'} onValueChange={val => handleAssign(student.uid, val)} disabled={actionLoading === student.uid}>
                                                    <SelectTrigger className="w-[200px] h-8 text-[10px] font-bold uppercase">
                                                        <SelectValue placeholder="Assign scholarship..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none" className="text-destructive font-bold">Remove Scholarship</SelectItem>
                                                        <Separator className="my-1" />
                                                        {scholarships.map(s => (
                                                            <SelectItem key={s.id} value={s.id}>{s.name} ({s.percentage}%)</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {actionLoading === student.uid && <Loader2 className="h-4 w-4 animate-spin text-primary"/>}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
