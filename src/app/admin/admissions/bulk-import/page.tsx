
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, Info, UserPlus, FileUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase';
import { ref, push, set, runTransaction, get, query, orderByChild, equalTo } from 'firebase/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { sendEmail } from '@/ai/flows/send-email-flow';
import { format } from 'date-fns';

type StudentImportRecord = {
    last_name?: string;
    first_name?: string;
    middle_name?: string;
    date_of_birth?: string;
    reg_no?: string;
    gender?: string;
    student_email?: string;
    student_phone?: string;
    nationality?: string;
    disability?: string;
    Student_number?: string;
    guardian_names?: string;
    guardian_relationship?: string;
    guardian_email?: string;
    guardian_phone?: string;
    address?: string;
};

type ProcessedStudent = {
    id: string;
    name: string;
    email: string;
    phoneNumber?: string;
    role: 'Student';
    status: 'active';
    dob?: string;
    gender?: string;
    nationality?: string;
    address?: string;
    disability?: string;
    guardian: {
        name?: string;
        relationship?: string;
        email?: string;
        contact?: string;
    };
    intakeId?: string;
    intakeName?: string;
};

type Intake = {
    id: string;
    name: string;
};


export default function BulkImportPage() {
    const [studentsToImport, setStudentsToImport] = React.useState<ProcessedStudent[]>([]);
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [idSettings, setIdSettings] = React.useState<any>(null);
    const [allIntakes, setAllIntakes] = React.useState<Intake[]>([]);
    
    const { toast } = useToast();
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        const fetchData = async () => {
            const settingsSnap = await get(ref(db, 'settings/idPrefixes'));
            if (settingsSnap.exists()) setIdSettings(settingsSnap.val());

            const intakesSnap = await get(ref(db, 'intakes'));
            if (intakesSnap.exists()) {
                setAllIntakes(Object.keys(intakesSnap.val()).map(id => ({ id, ...intakesSnap.val()[id] })));
            }
        };
        fetchData();
    }, []);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        setStudentsToImport([]);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                
                const allProcessedStudents: ProcessedStudent[] = [];
                let invalidSheetNames: string[] = [];

                workbook.SheetNames.forEach(sheetName => {
                    const intake = allIntakes.find(i => i.name.trim().toLowerCase() === sheetName.trim().toLowerCase());
                    if (!intake) {
                        invalidSheetNames.push(sheetName);
                        return;
                    }

                    const worksheet = workbook.Sheets[sheetName];
                    const json: StudentImportRecord[] = XLSX.utils.sheet_to_json(worksheet, { raw: false });

                    const studentsFromSheet = json.map(row => ({
                        id: (row.Student_number || row.reg_no || '').trim(),
                        name: [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' '),
                        email: row.student_email || '',
                        phoneNumber: row.student_phone,
                        role: 'Student' as const,
                        status: 'active' as const,
                        dob: row.date_of_birth,
                        gender: row.gender,
                        nationality: row.nationality,
                        address: row.address,
                        disability: row.disability,
                        guardian: {
                            name: row.guardian_names,
                            relationship: row.guardian_relationship,
                            email: row.guardian_email,
                            contact: row.guardian_phone,
                        },
                        intakeId: intake.id,
                        intakeName: intake.name,
                    })).filter(s => s.name && s.email && s.id);
                    
                    allProcessedStudents.push(...studentsFromSheet);
                });

                setStudentsToImport(allProcessedStudents);

                if (allProcessedStudents.length > 0) {
                     toast({ variant: 'success', title: 'File Processed', description: `${allProcessedStudents.length} valid student records found. Please review before importing.` });
                } else {
                     toast({ variant: 'destructive', title: 'No Valid Records', description: 'Could not find any valid student records. Ensure sheets are named after existing intakes and columns are correctly formatted.' });
                }

                if (invalidSheetNames.length > 0) {
                    toast({ variant: 'destructive', title: 'Unmatched Sheets', description: `The following sheets did not match any existing intakes: ${invalidSheetNames.join(', ')}` });
                }
            } catch (error) {
                console.error(error);
                toast({ variant: 'destructive', title: 'Error processing file', description: 'Please ensure it is a valid Excel file.'});
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
                const password = Math.random().toString(36).slice(-8); // Generate random password
                
                const userQuery = query(ref(db, 'users'), orderByChild('id'), equalTo(student.id));
                const snapshot = await get(userQuery);
                if(snapshot.exists()){
                     errors.push(`Skipped ${student.name}: Student ID ${student.id} already exists.`);
                     continue;
                }
                
                const userCredential = await createUserWithEmailAndPassword(tempAuth, student.email, password);
                const authUser = userCredential.user;

                const { role, status, intakeName, ...dbStudentData } = student;
                
                const newUser = {
                    ...dbStudentData,
                    role: 'Student',
                    status: 'active'
                };
                
                await set(ref(db, `users/${authUser.uid}`), newUser);

                const welcomeEmailBody = `
                    <h2>Welcome to ${idSettings?.name || 'the Institution'}!</h2>
                    <p>An account has been created for you. You can now access the student portal using the credentials below.</p>
                    <ul>
                        <li><strong>Portal Link:</strong> <a href="${window.location.origin}/login">Portal Login</a></li>
                        <li><strong>User ID:</strong> ${student.id}</li>
                        <li><strong>Password:</strong> ${password}</li>
                    </ul>
                    <p>We recommend you log in and change your password at your earliest convenience.</p>
                    <p>Regards,<br/>The Administration</p>
                `;
                await sendEmail({ to: [student.email], subject: `Welcome to ${idSettings?.name || 'the Institution'}!`, body: welcomeEmailBody });

                successCount++;
            } catch (error: any) {
                errors.push(`Failed for ${student.name} (${student.email}): ${error.code || error.message}`);
            }
        }
        
        await deleteApp(tempApp);
        toast({ variant: 'success', title: 'Import Complete', description: `${successCount} students imported successfully.` });
        if(errors.length > 0) {
             toast({ variant: 'destructive', duration: 10000, title: 'Import Errors Occurred', description: (<ul className="list-disc pl-5 mt-2">{errors.slice(0, 5).map((e, i)=><li key={i}>{e}</li>)}{errors.length > 5 && <li>and {errors.length-5} more...</li>}</ul>) });
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
                <CardDescription>Add new students in bulk by uploading an Excel file (.xlsx, .xls).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Instructions</AlertTitle>
                    <AlertDescription>
                        Create a separate sheet for each intake and name the sheet exactly as the intake is named in the system (e.g., "2024JAN"). The file must contain columns for at least `first_name`, `last_name`, `student_email`, and either `reg_no` or `Student_number`. A random password will be generated and emailed to each student.
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
                            className="max-w-xs"
                        />
                        <Button onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileUp className="mr-2 h-4"/>}
                            {isProcessing ? 'Processing...' : 'Select File'}
                        </Button>
                    </div>
                </div>
                 {studentsToImport.length > 0 && (
                    <div className="space-y-4 pt-4">
                        <h3 className="font-semibold">Preview Data ({studentsToImport.length} Records)</h3>
                        <div className="max-h-96 overflow-y-auto border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Student ID</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Intake</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {studentsToImport.map((student, index) => (
                                        <TableRow key={index} className={!student.intakeId ? 'bg-destructive/10' : ''}>
                                            <TableCell>{student.id}</TableCell>
                                            <TableCell>{student.name}</TableCell>
                                            <TableCell>{student.email}</TableCell>
                                            <TableCell>
                                                {student.intakeName || <span className="text-destructive font-semibold">Not Found!</span>}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                 )}
            </CardContent>
            {studentsToImport.length > 0 && (
                <CardFooter>
                     <Button onClick={handleImport} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UserPlus className="mr-2 h-4"/>}
                        Confirm & Import {studentsToImport.length} Students
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
}
