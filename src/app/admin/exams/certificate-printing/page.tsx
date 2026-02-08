
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Download, GraduationCap, FileCheck, Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { useTheme } from '@/components/theme-provider';

type Student = {
    uid: string;
    id: string;
    name: string;
    programmeId: string;
    programmeName: string;
};

type Course = {
    id: string;
    name: string;
    code: string;
};

type Semester = {
    id: string;
    name: string;
};

export default function CertificatePrintingPage() {
    const [students, setStudents] = React.useState<Student[]>([]);
    const [courses, setCourses] = React.useState<Course[]>([]);
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [generating, setGenerating] = React.useState<string | null>(null);
    
    // Filters
    const [searchTerm, setSearchTerm] = React.useState('');
    const [selectedSemesterId, setSelectedSemesterId] = React.useState('');
    const [selectedCourseId, setSelectedCourseId] = React.useState('');

    // Certificate Meta Info (Modal)
    const [isMetaOpen, setIsMetaOpen] = React.useState(false);
    const [activeStudent, setActiveStudent] = React.useState<Student | null>(null);
    const [metaInfo, setMetaInfo] = React.useState({
        duration: '2 Days',
        cpdHours: '18 Hours',
        venue: 'Main Campus',
        facilitator: 'Dr. John Doe',
        representative: 'Dean of Academics',
        trainingTitle: ''
    });

    const { toast } = useToast();
    const { institutionName } = useTheme();

    React.useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [usersSnap, regsSnap, programmesSnap, coursesSnap, semestersSnap] = await Promise.all([
                    get(ref(db, 'users')),
                    get(ref(db, 'registrations')),
                    get(ref(db, 'programmes')),
                    get(ref(db, 'courses')),
                    get(ref(db, 'semesters'))
                ]);

                const progs = programmesSnap.val() || {};
                const users = usersSnap.val() || {};
                const courseData = coursesSnap.val() || {};
                
                setCourses(Object.keys(courseData).map(id => ({ id, ...courseData[id] })));
                setSemesters(Object.keys(semestersSnap.val() || {}).map(id => ({ id, ...semestersSnap.val()[id] })));

                const studentList: Student[] = [];
                for (const uid in users) {
                    if (users[uid].role === 'Student') {
                        studentList.push({
                            uid,
                            id: users[uid].id,
                            name: users[uid].name,
                            programmeId: users[uid].programmeId,
                            programmeName: progs[users[uid].programmeId]?.name || 'N/A',
                        });
                    }
                }
                setStudents(studentList.sort((a,b) => a.name.localeCompare(b.name)));
            } catch (e) {
                console.error(e);
                toast({ variant: 'destructive', title: 'Failed to load data' });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [toast]);

    const handleOpenMeta = (student: Student) => {
        setActiveStudent(student);
        const courseName = courses.find(c => c.id === selectedCourseId)?.name || student.programmeName;
        setMetaInfo(prev => ({ ...prev, trainingTitle: courseName }));
        setIsMetaOpen(true);
    };

    const handleGeneratePDF = async () => {
        if (!activeStudent) return;
        setGenerating(activeStudent.uid);
        
        try {
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const width = doc.internal.pageSize.getWidth();
            const height = doc.internal.pageSize.getHeight();

            // 1. Draw Ornamental Border (Golden Rectangle Style)
            doc.setDrawColor(184, 134, 11); // Dark Golden Rod
            doc.setLineWidth(1.5);
            doc.rect(5, 5, width - 10, height - 10);
            doc.setLineWidth(0.5);
            doc.rect(7, 7, width - 14, height - 14);

            // 2. Header Content
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.text(institutionName.toUpperCase(), width / 2, 35, { align: 'center' });
            
            doc.setFontSize(18);
            doc.text('CERTIFICATE OF CONTINUING', width / 2, 50, { align: 'center' });
            doc.text('PROFESSIONAL DEVELOPMENT (CPD)', width / 2, 58, { align: 'center' });

            doc.setFont('helvetica', 'italic');
            doc.setFontSize(12);
            doc.text('This is to certify that', width / 2, 75, { align: 'center' });

            // 3. Student Name
            doc.setFont('times', 'bolditalic');
            doc.setFontSize(32);
            doc.setTextColor(41, 128, 185); // Nice Blue
            doc.text(activeStudent.name, width / 2, 95, { align: 'center' });
            
            // Underline name
            doc.setDrawColor(200, 200, 200);
            doc.line(40, 98, width - 40, 98);

            // 4. Achievement Text
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(12);
            doc.text('has successfully completed the training in', width / 2, 115, { align: 'center' });

            // 5. Training Title Banner
            doc.setFillColor(34, 34, 34);
            doc.rect(20, 122, width - 40, 12, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.text(metaInfo.trainingTitle.toUpperCase(), width / 2, 130, { align: 'center' });

            // 6. Conducting Institution
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(11);
            doc.text('conducted by', width / 2, 145, { align: 'center' });
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.text(institutionName, width / 2, 153, { align: 'center' });

            // 7. Details Section (2 Columns)
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            const mid = width / 2;
            const startY = 175;
            
            doc.text(`Duration: ${metaInfo.duration}`, 25, startY);
            doc.text(`CPD Hours: ${metaInfo.cpdHours}`, mid - 20, startY);
            doc.text(`Venue: ${metaInfo.venue}`, width - 60, startY);

            doc.text(`Date: ${format(new Date(), 'PPP')}`, 25, startY + 10);
            doc.text(`Certificate No: SM-${activeStudent.id}-${Date.now().toString().slice(-4)}`, 25, startY + 20);

            // 8. Signature Section
            const sigY = 240;
            doc.line(25, sigY, 85, sigY);
            doc.line(width - 85, sigY, width - 25, sigY);

            doc.setFontSize(9);
            doc.text('Trainer / Facilitator', 55, sigY + 5, { align: 'center' });
            doc.text(metaInfo.facilitator, 55, sigY + 10, { align: 'center' });

            doc.text('Institution Representative', width - 55, sigY + 5, { align: 'center' });
            doc.text(metaInfo.representative, width - 55, sigY + 10, { align: 'center' });

            // 9. Seal Placeholder
            doc.setDrawColor(184, 134, 11);
            doc.setLineWidth(0.2);
            doc.circle(mid, sigY - 5, 15);
            doc.setFontSize(6);
            doc.text('OFFICIAL SEAL', mid, sigY - 5, { align: 'center' });

            doc.save(`Certificate_${activeStudent.id}.pdf`);
            toast({ title: 'Certificate Generated', description: `Download started for ${activeStudent.name}` });
            setIsMetaOpen(false);
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Generation Failed' });
        } finally {
            setGenerating(null);
        }
    };

    const filteredStudents = students.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <FileCheck className="h-6 w-6 text-primary" />
                        <CardTitle>Certificate Printing</CardTitle>
                    </div>
                    <CardDescription>Select a student and a course to generate an official completion certificate.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <Label>Search Student</Label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Name or ID..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label>Filter Semester (Optional)</Label>
                            <Select value={selectedSemesterId} onValueChange={setSelectedSemesterId}>
                                <SelectTrigger><SelectValue placeholder="Select semester..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Semesters</SelectItem>
                                    {semesters.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>Filter Course (Required for specific title)</Label>
                            <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                                <SelectTrigger><SelectValue placeholder="Select course..." /></SelectTrigger>
                                <SelectContent>
                                    {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

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
                                    <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                                ))
                            ) : filteredStudents.length > 0 ? (
                                filteredStudents.map(student => (
                                    <TableRow key={student.uid}>
                                        <TableCell className="font-mono text-xs">{student.id}</TableCell>
                                        <TableCell className="font-medium">{student.name}</TableCell>
                                        <TableCell className="text-sm">{student.programmeName}</TableCell>
                                        <TableCell className="text-right">
                                            <Button 
                                                variant="outline" 
                                                size="sm"
                                                onClick={() => handleOpenMeta(student)}
                                                disabled={generating === student.uid}
                                            >
                                                {generating === student.uid ? <Loader2 className="animate-spin h-4 w-4" /> : <Download className="mr-2 h-4 w-4" />}
                                                Generate
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">No students found matching your search.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isMetaOpen} onOpenChange={setIsMetaOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Configure Certificate Details</DialogTitle>
                        <DialogDescription>Review and adjust the training details for {activeStudent?.name}.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-1">
                            <Label>Training / Course Title</Label>
                            <Input 
                                value={metaInfo.trainingTitle} 
                                onChange={e => setMetaInfo({...metaInfo, trainingTitle: e.target.value})} 
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Duration</Label>
                                <Input 
                                    value={metaInfo.duration} 
                                    onChange={e => setMetaInfo({...metaInfo, duration: e.target.value})} 
                                />
                            </div>
                            <div className="space-y-1">
                                <Label>CPD Hours</Label>
                                <Input 
                                    value={metaInfo.cpdHours} 
                                    onChange={e => setMetaInfo({...metaInfo, cpdHours: e.target.value})} 
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label>Venue</Label>
                            <Input 
                                value={metaInfo.venue} 
                                onChange={e => setMetaInfo({...metaInfo, venue: e.target.value})} 
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Trainer Name</Label>
                                <Input 
                                    value={metaInfo.facilitator} 
                                    onChange={e => setMetaInfo({...metaInfo, facilitator: e.target.value})} 
                                />
                            </div>
                            <div className="space-y-1">
                                <Label>Rep. Designation</Label>
                                <Input 
                                    value={metaInfo.representative} 
                                    onChange={e => setMetaInfo({...metaInfo, representative: e.target.value})} 
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button onClick={handleGeneratePDF}>Generate PDF</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
