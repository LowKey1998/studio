'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Download, Loader2, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase';
import { ref, push, serverTimestamp, set, runTransaction, get, query, orderByChild, equalTo } from 'firebase/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { sendEmail } from '@/ai/flows/send-email-flow';
import { format } from 'date-fns';

type StudentImport = {
    name: string;
    email: string;
    password?: string;
    phoneNumber?: string;
    programmeName?: string;
    intakeName?: string;
    year?: number;
    semesterInYear?: number;
    dob?: string;
    gender?: string;
    nationalId?: string;
};

type Programme = { id: string; name: string; };
type Intake = { id: string; name: string; };
type Semester = { id: string; name: string; year: number; semesterInYear: number; intakeId: string; };


export default function BulkImportPage() {
    const [studentsToImport, setStudentsToImport] = React.useState<StudentImport[]>([]);
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [idSettings, setIdSettings] = React.useState<any>(null);
    const [allProgrammes, setAllProgrammes] = React.useState<Programme[]>([]);
    const [allIntakes, setAllIntakes] = React.useState<Intake[]>([]);
    const [allSemesters, setAllSemesters] = React.useState<Semester[]>([]);

    const { toast } = useToast();
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        const fetchData = async () => {
            const [settingsSnap, programmesSnap, intakesSnap, semestersSnap] = await Promise.all([
                get(ref(db, 'settings/idPrefixes')),
                get(ref(db, 'programmes')),
                get(ref(db, 'intakes')),
                get(ref(db, 'semesters')),
            ]);
            if (settingsSnap.exists()) setIdSettings(settingsSnap.val());
            if (programmesSnap.exists()) setAllProgrammes(Object.keys(programmesSnap.val()).map(id => ({ id, ...programmesSnap.val()[id] })));
            if (intakesSnap.exists()) setAllIntakes(Object.keys(intakesSnap.val()).map(id => ({ id, ...intakesSnap.val()[id] })));
            if (semestersSnap.exists()) setAllSemesters(Object.keys(semestersSnap.val()).map(id => ({ id, ...semestersSnap.val()[id] })));
        };
        fetchData();
    }, []);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);
                
                const newStudents: StudentImport[] = json.map((row: any) => ({
                    name: row.name || row.Name || '',
                    email: row.email || row.Email || '',
                    password: row.password || row.Password || 'password123',
                    phoneNumber: row.phoneNumber || row.Phone || '',
                    programmeName: row.programmeName || row['Programme Name'] || '',
                    intakeName: row.intakeName || row['Intake Name'] || '',
                    year: Number(row.year) || undefined,
                    semesterInYear: Number(row.semesterInYear) || undefined,
                    dob: row.dob || '',
                    gender: row.gender || '',
                    nationalId: row.nationalId || '',
                })).filter(student => student.name && student.email && student.programmeName && student.intakeName && student.year && student.semesterInYear);

                setStudentsToImport(newStudents);
                 toast({ variant: 'success', title: 'File Processed', description: `${newStudents.length} valid student records found in the file.` });
            } catch (error) {
                toast({ variant: 'destructive', title: 'Error processing file', description: 'Please ensure it is a valid Excel file with the correct columns.'});
            } finally {
                setIsProcessing(false);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleImport = async () => {
        if (studentsToImport.length === 0) return;
        setIsSaving(true);
        let successCount = 0;
        const errors: string[] = [];

        const tempAppName = `temp-bulk-import-${Date.now()}`;
        const firebaseConfig = { apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID };
        const tempApp = initializeApp(firebaseConfig, tempAppName);
        const tempAuth = getAuth(tempApp);

        for (const student of studentsToImport) {
            try {
                const programme = allProgrammes.find(p => p.name.toLowerCase() === student.programmeName?.toLowerCase());
                const intake = allIntakes.find(i => i.name.toLowerCase() === student.intakeName?.toLowerCase());
                
                if (!programme || !intake) {
                    errors.push(`Skipped ${student.name}: Invalid programme or intake name.`);
                    continue;
                }
                
                const semester = allSemesters.find(s => s.intakeId === intake.id && s.year === student.year && s.semesterInYear === student.semesterInYear);
                if (!semester) {
                    errors.push(`Skipped ${student.name}: No matching semester found for the given intake, year, and semester number.`);
                    continue;
                }

                // Generate ID
                const prefixes = idSettings || { student: 'STU' };
                const counterRef = ref(db, `userCounters/student`);
                let newId = '';
                await runTransaction(counterRef, (currentCount) => {
                    const count = (currentCount || 0) + 1;
                    const basePrefix = prefixes.student;
                    let datePart = '';
                    const now = new Date();
                    if(idSettings.includeYear) datePart += format(now, 'yy');
                    if(idSettings.includeMonth) datePart += format(now, 'MM');
                    newId = `${basePrefix}${datePart}${String(count).padStart(3, '0')}`;
                    return count;
                });
                
                // Create Auth User
                const userCredential = await createUserWithEmailAndPassword(tempAuth, student.email, student.password || 'password123');
                const authUser = userCredential.user;

                // Create DB User
                const newUser = {
                    id: newId,
                    name: student.name,
                    email: student.email,
                    phoneNumber: student.phoneNumber,
                    role: 'Student',
                    status: 'active',
                    programmeId: programme.id,
                    intakeId: intake.id,
                    year: student.year,
                    semesterId: semester.id,
                    dob: student.dob,
                    gender: student.gender,
                    nationalId: student.nationalId,
                };
                await set(ref(db, `users/${authUser.uid}`), newUser);

                 // Send Welcome Email
                const welcomeEmailBody = `
                    <h2>Welcome to ${idSettings.name || 'Edutrack360'}!</h2>
                    <p>An account has been created for you. You can now access the student portal using the credentials below.</p>
                    <ul>
                        <li><strong>Portal Link:</strong> <a href="${window.location.origin}/login">Portal Login</a></li>
                        <li><strong>User ID:</strong> ${newId}</li>
                        <li><strong>Password:</strong> ${student.password || 'password123'}</li>
                    </ul>
                    <p>We recommend you log in and change your password at your earliest convenience.</p>
                `;
                await sendEmail({ to: [student.email], subject: `Welcome to ${idSettings.name || 'Edutrack360'}!`, body: welcomeEmailBody });

                successCount++;
            } catch (error: any) {
                errors.push(`Failed for ${student.name}: ${error.message}`);
            }
        }
        
        await deleteApp(tempApp);
        toast({ variant: 'success', title: 'Import Complete', description: `${successCount} students imported successfully.` });
        if(errors.length > 0) {
            toast({ variant: 'destructive', title: 'Import Errors', description: (<ul>{errors.map((e, i)=><li key={i}>{e}</li>)}</ul>) });
        }

        setStudentsToImport([]);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        setIsSaving(false);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Bulk Import Students</CardTitle>
                <CardDescription>Import new students in bulk using an Excel file (.xlsx, .xls).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Instructions</AlertTitle>
                    <AlertDescription>
                        Your Excel file must have columns: `name`, `email`, `password`, `programmeName`, `intakeName`, `year`, `semesterInYear`. Other optional columns: `phoneNumber`, `dob`, `gender`, `nationalId`. Ensure programme and intake names match exactly what is in the system.
                    </AlertDescription>
                </Alert>
                <div>
                    <h3 className="font-semibold">Upload File</h3>
                    <p className="text-sm text-muted-foreground mb-2">Select an Excel file from your computer.</p>
                    <div className="flex gap-2">
                        <Input 
                            type="file" 
                            accept=".xlsx, .xls"
                            onChange={handleFileChange}
                            ref={fileInputRef}
                        />
                        <Button onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4"/>}
                            {isProcessing ? 'Processing...' : 'Select File'}
                        </Button>
                    </div>
                </div>
                 {studentsToImport.length > 0 && (
                    <div className="space-y-4">
                        <h3 className="font-semibold">Preview Data</h3>
                        <div className="max-h-96 overflow-y-auto border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Programme</TableHead>
                                        <TableHead>Intake</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {studentsToImport.map((student, index) => (
                                        <TableRow key={index}>
                                            <TableCell>{student.name}</TableCell>
                                            <TableCell>{student.email}</TableCell>
                                            <TableCell>{student.programmeName}</TableCell>
                                            <TableCell>{student.intakeName}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                 )}
            </CardContent>
            <CardFooter>
                 <Button onClick={handleImport} disabled={isSaving || studentsToImport.length === 0}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4"/>}
                    Import {studentsToImport.length > 0 ? studentsToImport.length : ''} Students
                </Button>
            </CardFooter>
        </Card>
    );
}
