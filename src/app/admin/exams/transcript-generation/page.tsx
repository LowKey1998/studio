'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Download, FileText } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';

type Student = {
    uid: string;
    id: string; // STU-001
    name: string;
    programmeName?: string;
};

type Programme = {
    id: string;
    name: string;
};

export default function TranscriptGenerationPage() {
    const [students, setStudents] = React.useState<Student[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');

    React.useEffect(() => {
        const fetchStudents = async () => {
            setLoading(true);
            try {
                const [usersSnap, programmesSnap] = await Promise.all([
                    get(ref(db, 'users')),
                    get(ref(db, 'programmes')),
                ]);

                if (!usersSnap.exists()) {
                    setStudents([]);
                    setLoading(false);
                    return;
                }
                
                const users = usersSnap.val();
                const programmes = programmesSnap.exists() ? programmesSnap.val() : {};

                const studentList: Student[] = Object.keys(users)
                    .filter(uid => users[uid].role === 'Student')
                    .map(uid => ({
                        uid,
                        id: users[uid].id,
                        name: users[uid].name,
                        programmeName: programmes[users[uid].programmeId]?.name || 'N/A',
                    }));
                
                setStudents(studentList.sort((a,b) => a.name.localeCompare(b.name)));
            } catch (error) {
                console.error("Error fetching students:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStudents();
    }, []);

    const filteredStudents = students.filter(student => 
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Placeholder function for transcript generation
    const handleGenerateTranscript = (studentId: string) => {
        alert(`Generating transcript for student ${studentId}... (feature coming soon)`);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Transcript Generation</CardTitle>
                <CardDescription>Generate official academic transcripts for students.</CardDescription>
                 <div className="relative pt-2">
                    <Search className="absolute left-2.5 top-4.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search by student name or ID..." 
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
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
                        ) : filteredStudents.map(student => (
                            <TableRow key={student.uid}>
                                <TableCell>{student.id}</TableCell>
                                <TableCell className="font-medium">{student.name}</TableCell>
                                <TableCell>{student.programmeName}</TableCell>
                                <TableCell className="text-right">
                                    <Button 
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleGenerateTranscript(student.id)}
                                    >
                                        <FileText className="mr-2 h-4 w-4" />
                                        Generate Transcript
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
