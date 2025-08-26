
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/firebase";
import { ref, get } from 'firebase/database';
import { Search, Printer, User } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

type Student = {
    uid: string;
    id: string;
    name: string;
    email: string;
    programmeId?: string;
    programmeName?: string;
    intakeId?: string;
    intakeName?: string;
    nationalId?: string;
    passport?: string;
};

type Programme = {
    id: string;
    name: string;
};

type Intake = {
    id: string;
    name: string;
};

export default function StudentsListPage() {
    const [students, setStudents] = React.useState<Student[]>([]);
    const [programmes, setProgrammes] = React.useState<Programme[]>([]);
    const [intakes, setIntakes] = React.useState<Intake[]>([]);
    const [loading, setLoading] = React.useState(true);

    // Filter states
    const [searchTerm, setSearchTerm] = React.useState('');
    const [programmeFilter, setProgrammeFilter] = React.useState('all');
    const [intakeFilter, setIntakeFilter] = React.useState('all');

    React.useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [usersSnap, programmesSnap, intakesSnap] = await Promise.all([
                    get(ref(db, 'users')),
                    get(ref(db, 'programmes')),
                    get(ref(db, 'intakes'))
                ]);

                const programmesData = programmesSnap.exists() ? programmesSnap.val() : {};
                const intakesData = intakesSnap.exists() ? intakesSnap.val() : {};

                setProgrammes(Object.keys(programmesData).map(id => ({ id, ...programmesData[id] })));
                setIntakes(Object.keys(intakesData).map(id => ({ id, ...intakesData[id] })));
                
                const usersData = usersSnap.exists() ? usersSnap.val() : {};
                const studentList: Student[] = [];
                for (const uid in usersData) {
                    if (usersData[uid].role === 'Student') {
                        studentList.push({
                            uid,
                            ...usersData[uid],
                            programmeName: programmesData[usersData[uid].programmeId]?.name || 'N/A',
                            intakeName: intakesData[usersData[uid].intakeId]?.name || 'N/A',
                        });
                    }
                }
                setStudents(studentList.sort((a,b) => a.name.localeCompare(b.name)));

            } catch (error) {
                console.error("Failed to fetch data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);
    
    const filteredStudents = React.useMemo(() => {
        const lowerCaseSearch = searchTerm.toLowerCase();
        return students.filter(student => {
            const searchMatch = !searchTerm ||
                student.name.toLowerCase().includes(lowerCaseSearch) ||
                student.id.toLowerCase().includes(lowerCaseSearch) ||
                student.email.toLowerCase().includes(lowerCaseSearch) ||
                student.nationalId?.toLowerCase().includes(lowerCaseSearch) ||
                student.passport?.toLowerCase().includes(lowerCaseSearch);

            const programmeMatch = programmeFilter === 'all' || student.programmeId === programmeFilter;
            const intakeMatch = intakeFilter === 'all' || student.intakeId === intakeFilter;
            
            return searchMatch && programmeMatch && intakeMatch;
        });
    }, [students, searchTerm, programmeFilter, intakeFilter]);
    
    const handlePrint = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Student List Report", 14, 22);
        doc.setFontSize(11);
        doc.text(`Filters: Programme - ${programmes.find(p=>p.id === programmeFilter)?.name || 'All'}, Intake - ${intakes.find(i=>i.id === intakeFilter)?.name || 'All'}`, 14, 30);
        
        const tableColumn = ["ID", "Name", "Email", "Programme", "Intake"];
        const tableRows = filteredStudents.map(s => [
            s.id,
            s.name,
            s.email,
            s.programmeName,
            s.intakeName
        ]);

        (doc as any).autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 35
        });
        
        doc.autoPrint();
        window.open(doc.output('bloburl'));
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><User /> Students List</CardTitle>
                <CardDescription>View, filter, and print lists of all students in the system.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col md:flex-row gap-4 mb-4 p-4 border rounded-lg">
                    <div className="flex-grow">
                        <Label htmlFor="search">Search</Label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="search"
                                placeholder="Search by name, ID, email, national ID, passport..."
                                className="pl-8"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                         <Label htmlFor="programme-filter">Programme</Label>
                         <Select value={programmeFilter} onValueChange={setProgrammeFilter}>
                            <SelectTrigger id="programme-filter"><SelectValue placeholder="Filter by programme..." /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All Programmes</SelectItem>{programmes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <Label htmlFor="intake-filter">Intake</Label>
                        <Select value={intakeFilter} onValueChange={setIntakeFilter}>
                            <SelectTrigger id="intake-filter"><SelectValue placeholder="Filter by intake..." /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All Intakes</SelectItem>{intakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="self-end">
                        <Button onClick={handlePrint} disabled={filteredStudents.length === 0}><Printer className="mr-2 h-4 w-4"/> Print Report</Button>
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Student ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Programme</TableHead>
                            <TableHead>Intake</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                             Array.from({ length: 10 }).map((_, i) => (
                                <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                            ))
                        ) : filteredStudents.map(student => (
                            <TableRow key={student.uid}>
                                <TableCell>{student.id}</TableCell>
                                <TableCell className="font-medium">{student.name}</TableCell>
                                <TableCell>{student.email}</TableCell>
                                <TableCell>{student.programmeName}</TableCell>
                                <TableCell>{student.intakeName}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
            <CardFooter>
                <div className="text-xs text-muted-foreground">
                    Showing <strong>{filteredStudents.length}</strong> of <strong>{students.length}</strong> students.
                </div>
            </CardFooter>
        </Card>
    );
}

