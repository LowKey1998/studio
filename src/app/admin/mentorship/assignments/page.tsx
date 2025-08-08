
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { db } from '@/lib/firebase';
import { ref, onValue, update } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

type Student = {
    uid: string;
    id: string; // STU-001
    name: string;
    advisorId?: string;
    advisorName?: string;
};

type Advisor = {
    uid: string;
    name: string;
};

export default function AdvisorAssignmentsPage() {
    const [students, setStudents] = React.useState<Student[]>([]);
    const [advisors, setAdvisors] = React.useState<Advisor[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const { toast } = useToast();

    React.useEffect(() => {
        const usersRef = ref(db, 'users');
        const unsubscribe = onValue(usersRef, (snapshot) => {
            const usersData = snapshot.val() || {};
            const studentsList: Student[] = [];
            const advisorsList: Advisor[] = [];
            const advisorMap = new Map<string, string>();

            for (const uid in usersData) {
                const user = usersData[uid];
                if (user.role === 'Staff') { // Assuming all staff can be advisors for now
                    advisorsList.push({ uid, name: user.name });
                    advisorMap.set(uid, user.name);
                }
            }

            for (const uid in usersData) {
                const user = usersData[uid];
                if (user.role === 'Student') {
                    studentsList.push({
                        uid,
                        id: user.id,
                        name: user.name,
                        advisorId: user.advisorId,
                        advisorName: user.advisorId ? advisorMap.get(user.advisorId) : undefined
                    });
                }
            }
            
            setStudents(studentsList.sort((a, b) => a.name.localeCompare(b.name)));
            setAdvisors(advisorsList);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleAssignAdvisor = async (studentUid: string, advisorUid: string) => {
        try {
            await update(ref(db, `users/${studentUid}`), { advisorId: advisorUid });
            toast({ title: "Advisor Assigned", description: "The student's advisor has been updated." });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: "Assignment Failed" });
        }
    };

    const filteredStudents = students.filter(student =>
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Advisor Assignments</CardTitle>
                <CardDescription>Assign academic advisors to students.</CardDescription>
                <div className="relative pt-2">
                    <Search className="absolute left-2.5 top-4.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search students by name or ID..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Student ID</TableHead>
                            <TableHead>Student Name</TableHead>
                            <TableHead>Assigned Advisor</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            Array.from({length: 5}).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={3}><Skeleton className="h-8 w-full" /></TableCell>
                                </TableRow>
                            ))
                        ) : filteredStudents.map(student => (
                            <TableRow key={student.uid}>
                                <TableCell>{student.id}</TableCell>
                                <TableCell>{student.name}</TableCell>
                                <TableCell>
                                    <Select
                                        value={student.advisorId}
                                        onValueChange={(value) => handleAssignAdvisor(student.uid, value)}
                                    >
                                        <SelectTrigger className="w-[280px]">
                                            <SelectValue placeholder="Assign an advisor..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {advisors.map(adv => (
                                                <SelectItem key={adv.uid} value={adv.uid}>{adv.name}</SelectItem>
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
