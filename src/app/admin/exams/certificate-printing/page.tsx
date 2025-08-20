
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Download, GraduationCap } from 'lucide-react';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type GraduatingStudent = {
    uid: string;
    id: string; // STU-001
    name: string;
    programmeName: string;
};

export default function CertificatePrintingPage() {
    const [students, setStudents] = React.useState<GraduatingStudent[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const { toast } = useToast();

    React.useEffect(() => {
        const fetchGraduatingStudents = async () => {
            setLoading(true);
            try {
                const [usersSnap, regsSnap, programmesSnap] = await Promise.all([
                    get(ref(db, 'users')),
                    get(ref(db, 'registrations')),
                    get(ref(db, 'programmes'))
                ]);

                if (!usersSnap.exists() || !regsSnap.exists() || !programmesSnap.exists()) {
                    setStudents([]);
                    setLoading(false);
                    return;
                }

                const users = usersSnap.val();
                const registrations = regsSnap.val();
                const programmes = programmesSnap.val();
                const graduating: GraduatingStudent[] = [];

                for (const userId in registrations) {
                    const userRegs = registrations[userId];
                    const lastSemesterId = Object.keys(userRegs).sort().pop();
                    if (lastSemesterId && userRegs[lastSemesterId].status === 'Completed') {
                        const user = users[userId];
                        if (user && user.role === 'Student') {
                            graduating.push({
                                uid: userId,
                                id: user.id,
                                name: user.name,
                                programmeName: programmes[user.programmeId]?.name || 'N/A',
                            });
                        }
                    }
                }
                setStudents(graduating);
            } catch (e) {
                console.error(e);
                toast({ variant: 'destructive', title: 'Failed to load students' });
            } finally {
                setLoading(false);
            }
        };

        fetchGraduatingStudents();
    }, [toast]);
    
    const handleGenerateCertificate = (studentName: string) => {
        toast({
            title: "Feature Coming Soon",
            description: `Certificate generation for ${studentName} is not yet implemented.`
        })
    }
    
    const filteredStudents = students.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.programmeName.toLowerCase().includes(searchTerm.toLowerCase())
    );


    return (
        <Card>
            <CardHeader>
                <CardTitle>Certificate Printing</CardTitle>
                <CardDescription>Generate and print official certificates for graduating students.</CardDescription>
                 <div className="relative pt-2">
                    <Search className="absolute left-2.5 top-4.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        id="student-search" 
                        placeholder="Search by student name, ID, or programme..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                </div>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Student ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Programme</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                             Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell>
                                </TableRow>
                            ))
                        ) : filteredStudents.length > 0 ? (
                            filteredStudents.map(student => (
                                <TableRow key={student.uid}>
                                    <TableCell>{student.id}</TableCell>
                                    <TableCell className="font-medium">{student.name}</TableCell>
                                    <TableCell>{student.programmeName}</TableCell>
                                    <TableCell className="text-right">
                                        <Button 
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleGenerateCertificate(student.name)}
                                        >
                                            <Download className="mr-2 h-4 w-4" />
                                            Generate Certificate
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4}>
                                     <div className="py-16 text-center text-muted-foreground">
                                        <GraduationCap className="mx-auto h-12 w-12" />
                                        <h3 className="mt-4 text-lg font-semibold">No Graduating Students</h3>
                                        <p className="mt-2 text-sm">There are no students currently marked as having completed their final semester.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
