'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Download, GraduationCap, FileCheck, Loader2, Settings2, Image as LucideImage, Users, Info } from 'lucide-react';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { useTheme } from '@/components/theme-provider';
import placeholderImages from '@/app/lib/placeholder-images.json';

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
    const [selectedSemesterId, setSelectedSemesterId] = React.useState('all');
    const [selectedCourseId, setSelectedCourseId] = React.useState('all');

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
                const [usersSnap, programmesSnap, coursesSnap, semestersSnap] = await Promise.all([
                    get(ref(db, 'users')),
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
            const bgUrl = placeholderImages.certificates.background.url;
            
            // Using document.createElement('img') to avoid "Illegal constructor" error
            const img = document.createElement('img');
            img.crossOrigin = "anonymous";
            img.src = bgUrl;

            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });

            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');

            if (!ctx) throw new Error("Could not initialize canvas context.");

            ctx.drawImage(img, 0, 0);
            ctx.textAlign = 'center';
            ctx.fillStyle = 'black';

            ctx.font = 'bold 40px sans-serif';
            ctx.fillText(institutionName.toUpperCase(), canvas.width / 2, 220);

            ctx.font = 'bold 64px sans-serif';
            ctx.fillText('CERTIFICATE OF ACHIEVEMENT', canvas.width / 2, 350);

            ctx.font = 'italic 32px serif';
            ctx.fillText('This is to certify that', canvas.width / 2, 450);

            ctx.font = 'bold italic 80px serif';
            ctx.fillStyle = '#2980b9';
            ctx.fillText(activeStudent.name, canvas.width / 2, 550);

            ctx.fillStyle = 'black';
            ctx.font = '32px sans-serif';
            ctx.fillText('has successfully completed the requirements for', canvas.width / 2, 650);

            ctx.font = 'bold 48px sans-serif';
            ctx.fillText(metaInfo.trainingTitle.toUpperCase(), canvas.width / 2, 730);

            ctx.font = '28px sans-serif';
            ctx.textAlign = 'left';
            const leftX = 150;
            const rightX = canvas.width - 150;
            const startY = 880;

            ctx.fillText(`Duration: ${metaInfo.duration}`, leftX, startY);
            ctx.fillText(`CPD Hours: ${metaInfo.cpdHours}`, leftX, startY + 50);
            ctx.fillText(`Venue: ${metaInfo.venue}`, leftX, startY + 100);

            ctx.textAlign = 'right';
            ctx.fillText(`Date Issued: ${format(new Date(), 'PPP')}`, rightX, startY);
            ctx.fillText(`Certificate No: SM-${activeStudent.id}-${Date.now().toString().slice(-4)}`, rightX, startY + 50);

            ctx.textAlign = 'center';
            ctx.font = '24px sans-serif';
            const sigY = 1250;
            const sigLX = 350;
            const sigRX = canvas.width - 350;

            ctx.fillText('__________________________', sigLX, sigY);
            ctx.fillText(metaInfo.facilitator, sigLX, sigY + 40);
            ctx.fillText('Trainer / Facilitator', sigLX, sigY + 80);

            ctx.fillText('__________________________', sigRX, sigY);
            ctx.fillText(metaInfo.representative, sigRX, sigY + 40);
            ctx.fillText('Institution Representative', sigRX, sigY + 80);

            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const pdfWidth = doc.internal.pageSize.getWidth();
            const pdfHeight = doc.internal.pageSize.getHeight();

            doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            doc.save(`Certificate_${activeStudent.id}.pdf`);

            toast({ title: 'Certificate Generated', description: `Download started for ${activeStudent.name}` });
            setIsMetaOpen(false);
        } catch (e: any) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Generation Failed', description: e.message || "Error rendering certificate." });
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
                    <CardDescription>Select a student and a course to generate an official completion certificate using the institutional background template.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="students">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="students"><Users className="h-4 w-4 mr-2"/> Student List</TabsTrigger>
                            <TabsTrigger value="template"><Settings2 className="h-4 w-4 mr-2"/> Template Configuration</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="students" className="space-y-4 pt-4">
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
                                            <SelectItem value="all">Use Programme Name</SelectItem>
                                            {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="rounded-md border">
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
                            </div>
                        </TabsContent>

                        <TabsContent value="template" className="space-y-6 pt-4">
                            <Alert>
                                <Info className="h-4 w-4" />
                                <AlertTitle>Template Management</AlertTitle>
                                <AlertDescription>
                                    To update the certificate background, please edit the URL in <code className="bg-muted px-1 rounded">src/app/lib/placeholder-images.json</code> under the <code className="bg-muted px-1 rounded">certificates.background</code> key.
                                </AlertDescription>
                            </Alert>
                            <Card className="bg-muted/20">
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2"><LucideImage className="h-4 w-4"/>Current Background Preview</CardTitle>
                                </CardHeader>
                                <CardContent className="flex justify-center">
                                    <img 
                                        src={placeholderImages.certificates.background.url} 
                                        alt="Certificate Background" 
                                        className="max-w-md w-full border shadow-sm rounded-lg"
                                    />
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
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
