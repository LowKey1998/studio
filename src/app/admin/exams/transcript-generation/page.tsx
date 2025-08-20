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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Student = {
    uid: string;
    id: string; // STU-001
    name: string;
    programmeName?: string;
    programmeId?: string;
    year?: number;
};

type Programme = {
    id: string;
    name: string;
};

export default function TranscriptGenerationPage() {
    const [students, setStudents] = React.useState<Student[]>([]);
    const [programmes, setProgrammes] = React.useState<Programme[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [yearFilter, setYearFilter] = React.useState('all');
    const [programmeFilter, setProgrammeFilter] = React.useState('all');


    React.useEffect(() => {
        const fetchStudentsAndProgrammes = async () => {
            setLoading(true);
            try {
                const [usersSnap, programmesSnap] = await Promise.all([
                    get(ref(db, 'users')),
                    get(ref(db, 'programmes')),
                ]);

                const programmesData = programmesSnap.exists() ? programmesSnap.val() : {};
                const programmesList: Programme[] = Object.keys(programmesData).map(id => ({ id, name: programmesData[id].name }));
                setProgrammes(programmesList);

                if (!usersSnap.exists()) {
                    setStudents([]);
                    setLoading(false);
                    return;
                }
                
                const users = usersSnap.val();

                const studentList: Student[] = Object.keys(users)
                    .filter(uid => users[uid].role === 'Student')
                    .map(uid => ({
                        uid,
                        id: users[uid].id,
                        name: users[uid].name,
                        programmeId: users[uid].programmeId,
                        programmeName: programmesData[users[uid].programmeId]?.name || 'N/A',
                        year: users[uid].year,
                    }));
                
                setStudents(studentList.sort((a,b) => a.name.localeCompare(b.name)));
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStudentsAndProgrammes();
    }, []);

    const filteredStudents = students.filter(student => {
        const searchMatch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            student.id.toLowerCase().includes(searchTerm.toLowerCase());
        const yearMatch = yearFilter === 'all' || student.year?.toString() === yearFilter;
        const programmeMatch = programmeFilter === 'all' || student.programmeId === programmeFilter;

        return searchMatch && yearMatch && programmeMatch;
    });

    // Placeholder function for transcript generation
    const handleGenerateTranscript = (studentId: string) => {
        alert(`Generating transcript for student ${studentId}... (feature coming soon)`);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Transcript Generation</CardTitle>
                <CardDescription>Generate official academic transcripts for students.</CardDescription>
                 <div className="grid md:grid-cols-3 gap-4 pt-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search by student name or ID..." 
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                     <Select value={yearFilter} onValueChange={setYearFilter}>
                        <SelectTrigger><SelectValue placeholder="Filter by year..."/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Years</SelectItem>
                            <SelectItem value="1">Year 1</SelectItem>
                            <SelectItem value="2">Year 2</SelectItem>
                            <SelectItem value="3">Year 3</SelectItem>
                            <SelectItem value="4">Year 4</SelectItem>
                             {/* Add more years if needed */}
                        </SelectContent>
                    </Select>
                     <Select value={programmeFilter} onValueChange={setProgrammeFilter}>
                        <SelectTrigger><SelectValue placeholder="Filter by programme..."/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Programmes</SelectItem>
                            {programmes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
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
                         {!loading && filteredStudents.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">No students found matching filters.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
