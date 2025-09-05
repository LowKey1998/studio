'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Download, Loader2, Info, UserPlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, push, set, runTransaction, get, query, orderByChild, equalTo } from 'firebase/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { sendEmail } from '@/ai/flows/send-email-flow';
import { format } from 'date-fns';

type StudentImport = {
    // These match the structure of your Excel file for direct mapping
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

export default function BulkImportPage() {
    const [studentsToImport, setStudentsToImport] = React.useState<StudentImport[]>([]);
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [idSettings, setIdSettings] = React.useState<any>(null);

    const { toast } = useToast();
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        const fetchData = async () => {
            const settingsSnap = await get(ref(db, 'settings/idPrefixes'));
            if (settingsSnap.exists()) setIdSettings(settingsSnap.val());
        };
        fetchData();
    }, []);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        setStudentsToImport([]); // Clear previous preview
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json<StudentImport>(worksheet);
                
                const validStudents = json.filter(student => student.first_name && student.last_name && student.student_email);

                setStudentsToImport(validStudents);
                if (validStudents.length > 0) {
                     toast({ variant: 'success', title: 'File Processed', description: `${validStudents.length} valid student records found and ready for review.` });
                } else {
                     toast({ variant: 'destructive', title: 'No Valid Records', description: 'Could not find any valid student records in the file. Ensure columns like first_name, last_name, and student_email are present.' });
                }
            } catch (error) {
                console.error(error);
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
            const fullName = [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ');
            const email = student.student_email;
            
            if (!email) {
                errors.push(`Skipped record (no email): ${fullName}`);
                continue;
            }

            try {
                const password = Math.random().toString(36).slice(-8); // Generate random password
                
                // Use reg_no if provided, otherwise generate new ID
                const providedId = student.Student_number || student.reg_no;
                let newId = '';

                if (providedId) {
                     newId = providedId;
                     const userQuery = query(ref(db, 'users'), orderByChild('id'), equalTo(newId));
                     const snapshot = await get(userQuery);
                     if(snapshot.exists()){
                         errors.push(`Skipped ${fullName}: Student ID ${newId} already exists.`);
                         continue;
                     }
                } else {
                    const counterRef = ref(db, 'userCounters/student');
                    await runTransaction(counterRef, (currentCount) => (currentCount || 0) + 1);
                    const newCount = (await get(counterRef)).val();
                    const basePrefix = idSettings?.student || 'STU';
                    let datePart = '';
                    const now = new Date();
                    if(idSettings?.includeYear) datePart += format(now, 'yy');
                    if(idSettings?.includeMonth) datePart += format(now, 'MM');
                    newId = `${basePrefix}${datePart}${String(newCount).padStart(3, '0')}`;
                }
                
                const userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
                const authUser = userCredential.user;

                const newUser = {
                    id: newId,
                    name: fullName,
                    email: email,
                    phoneNumber: student.student_phone,
                    role: 'Student',
                    status: 'active',
                    dob: student.date_of_birth,
                    gender: student.gender,
                    nationality: student.nationality,
                    disability: student.disability,
                    address: student.address,
                    guardian: {
                        name: student.guardian_names,
                        relationship: student.guardian_relationship,
                        email: student.guardian_email,
                        contact: student.guardian_phone,
                    },
                };
                await set(ref(db, `users/${authUser.uid}`), newUser);

                 // Send Welcome Email
                const welcomeEmailBody = `
                    <h2>Welcome to ${idSettings?.name || 'Edutrack360'}!</h2>
                    <p>An account has been created for you. You can now access the student portal using the credentials below.</p>
                    <ul>
                        <li><strong>Portal Link:</strong> <a href="${window.location.origin}/login">Portal Login</a></li>
                        <li><strong>User ID:</strong> ${newId}</li>
                        <li><strong>Password:</strong> ${password}</li>
                    </ul>
                    <p>We recommend you log in and change your password at your earliest convenience.</p>
                `;
                await sendEmail({ to: [email], subject: `Welcome to ${idSettings?.name || 'Edutrack360'}!`, body: welcomeEmailBody });

                successCount++;
            } catch (error: any) {
                errors.push(`Failed for ${fullName}: ${error.message}`);
            }
        }
        
        await deleteApp(tempApp);
        toast({ variant: 'success', title: 'Import Complete', description: `${successCount} students imported successfully.` });
        if(errors.length > 0) {
             toast({ variant: 'destructive', duration: 10000, title: 'Import Errors Occurred', description: (<ul>{errors.map((e, i)=><li key={i}>{e}</li>)}</ul>) });
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
                        Your Excel file must have columns: `first_name`, `last_name`, and `student_email`. All other columns are optional.
                        A random password will be generated and emailed to the student. If a `Student_number` or `reg_no` is provided and doesn't exist, it will be used; otherwise, a new ID is generated.
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
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4"/>}
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
                                        <TableHead>Name</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Phone</TableHead>
                                        <TableHead>Student Number</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {studentsToImport.map((student, index) => (
                                        <TableRow key={index}>
                                            <TableCell>{[student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ')}</TableCell>
                                            <TableCell>{student.student_email}</TableCell>
                                            <TableCell>{student.student_phone || 'N/A'}</TableCell>
                                            <TableCell>{student.Student_number || student.reg_no || '(Auto-generate)'}</TableCell>
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
