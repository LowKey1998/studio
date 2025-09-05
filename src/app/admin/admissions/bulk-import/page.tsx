'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, Info, UserPlus, FileUp, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase';
import { ref, push, set, get, query, orderByChild, equalTo } from 'firebase/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { sendEmail } from '@/ai/flows/send-email-flow';
import { format } from 'date-fns';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

type StudentImportRecord = {
    last_name?: string;
    first_name?: string;
    middle_name?: string;
    date_of_birth?: string | Date;
    reg_no?: string;
    gender?: string;
    student_email?: string;
    student_phone?: string;
    nationality?: string;
    disability?: string;
    Student_number?: string;
    'Student number'?: string;
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
    guardian?: {
        name?: string;
        relationship?: string;
        email?: string;
        contact?: string;
    };
    intakeId?: string;
    intakeName?: string;
    imported?: boolean; // To track import status
};

type Intake = {
    id: string;
    name: string;
};


export default function BulkImportPage() {
    const [studentsToImport, setStudentsToImport] = React.useState<ProcessedStudent[]>([]);
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [singleRowSaving, setSingleRowSaving] = React.useState<string | null>(null);
    const [idSettings, setIdSettings] = React.useState<any>(null);
    const [allIntakes, setAllIntakes] = React.useState<Intake[]>([]);
    
    const [workbook, setWorkbook] = React.useState<XLSX.WorkBook | null>(null);
    const [sheetNames, setSheetNames] = React.useState<string[]>([]);
    const [sheetToIntakeMap, setSheetToIntakeMap] = React.useState<Record<string, string>>({});

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

    const resetFileState = () => {
        setWorkbook(null);
        setSheetNames([]);
        setSheetToIntakeMap({});
        setStudentsToImport([]);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        resetFileState();
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const wb = XLSX.read(data, { type: 'array', cellDates: true });
                setWorkbook(wb);
                setSheetNames(wb.SheetNames);
                const initialMap: Record<string, string> = {};
                wb.SheetNames.forEach(name => { initialMap[name] = '' });
                setSheetToIntakeMap(initialMap);
            } catch (error) {
                console.error(error);
                toast({ variant: 'destructive', title: 'Error processing file', description: 'Please ensure it is a valid Excel file.'});
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleProcessSheets = () => {
        if (!workbook) return;
        setIsProcessing(true);
        try {
             const allProcessedStudents: ProcessedStudent[] = [];
             let invalidSheetMappings = false;

             sheetNames.forEach(sheetName => {
                const intakeId = sheetToIntakeMap[sheetName];
                if (!intakeId) return; 

                const intake = allIntakes.find(i => i.id === intakeId);
                if (!intake) {
                    invalidSheetMappings = true;
                    return;
                }

                const worksheet = workbook.Sheets[sheetName];
                const json: StudentImportRecord[] = XLSX.utils.sheet_to_json(worksheet, { raw: false });

                const studentsFromSheet = json.map(row => {
                    const dobValue = row.date_of_birth;
                    let formattedDob = '';
                    if (dobValue) {
                        try {
                            const dateObj = new Date(dobValue);
                            if (!isNaN(dateObj.getTime())) {
                                formattedDob = dateObj.toISOString().split('T')[0];
                            }
                        } catch (e) {
                             console.warn("Invalid date found in sheet:", dobValue);
                        }
                    }

                    return {
                        id: (row.Student_number || row['Student number'] || row.reg_no || '').toString().trim(),
                        name: [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' '),
                        email: (row.student_email || '').toString().trim(),
                        phoneNumber: (row.student_phone || '').toString().trim(),
                        role: 'Student' as const,
                        status: 'active' as const,
                        dob: formattedDob,
                        gender: row.gender ?? '',
                        nationality: row.nationality ?? '',
                        address: row.address ?? '',
                        disability: row.disability ?? '',
                        guardian: {
                            name: row.guardian_names ?? '',
                            relationship: row.guardian_relationship ?? '',
                            email: row.guardian_email ?? '',
                            contact: row.guardian_phone ?? '',
                        },
                        intakeId: intake.id,
                        intakeName: intake.name,
                        imported: false
                    }
                }).filter(s => s.name && s.email && s.id);
                
                allProcessedStudents.push(...studentsFromSheet);
            });
            
            if (invalidSheetMappings) {
                toast({ variant: 'destructive', title: 'Invalid Mapping', description: 'One or more sheets were mapped to a non-existent intake and were skipped.' });
            }

            setStudentsToImport(allProcessedStudents);
            if (allProcessedStudents.length > 0) {
                 toast({ variant: 'success', title: 'Data Processed', description: `${allProcessedStudents.length} valid student records found. Please review before importing.` });
            } else {
                 toast({ variant: 'destructive', title: 'No Valid Records', description: 'Could not find any valid student records. Ensure sheets are mapped and columns are correctly formatted.' });
            }

        } catch (error) {
             console.error(error);
             toast({ variant: 'destructive', title: 'Error processing sheets', description: 'Something went wrong while reading the data.'});
        } finally {
            setIsProcessing(false);
        }
    };
    
    const importStudent = async (student: ProcessedStudent) => {
        const tempAppName = `temp-bulk-import-single-${Date.now()}`;
        const firebaseConfig = { apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID };
        const tempApp = initializeApp(firebaseConfig, tempAppName);
        const tempAuth = getAuth(tempApp);

        try {
            const userQuery = query(ref(db, 'users'), orderByChild('id'), equalTo(student.id));
            const snapshot = await get(userQuery);
            if (snapshot.exists()) {
                throw new Error(`Student ID ${student.id} already exists.`);
            }

            const password = Math.random().toString(36).slice(-8);
            try {
                const userCredential = await createUserWithEmailAndPassword(tempAuth, student.email, password);
                const authUser = userCredential.user;

                const { intakeName, ...dbStudentData } = student;
                const newUser = { ...dbStudentData, role: 'Student', status: 'active' };
                delete newUser.imported;

                await set(ref(db, `users/${authUser.uid}`), newUser);

                const welcomeEmailBody = `<h2>Welcome!</h2><p>An account has been created. Use User ID: ${student.id} and Password: ${password} to log in.</p>`;
                await sendEmail({ to: [student.email], subject: `Welcome to ${idSettings?.name || 'the Institution'}!`, body: welcomeEmailBody });

            } catch (error: any) {
                 if (error.code === 'auth/email-already-in-use') {
                    const userQueryByEmail = query(ref(db, 'users'), orderByChild('email'), equalTo(student.email));
                    const userSnap = await get(userQueryByEmail);
                    if (userSnap.exists()) {
                        throw new Error(`Email ${student.email} is already in use by another student.`);
                    }
                    // This case is tricky without backend functions. For now, we will log it as an error.
                    throw new Error(`Email ${student.email} is already in use by an auth user but has no database record. Manual intervention required.`);
                }
                throw error;
            }
        } finally {
            await deleteApp(tempApp);
        }
    }
    
    const handleImportSingleRow = async (student: ProcessedStudent, index: number) => {
        setSingleRowSaving(student.id);
        try {
            await importStudent(student);
            toast({ variant: 'success', title: 'Student Imported', description: `${student.name} imported successfully.` });
            setStudentsToImport(prev => prev.map((s, i) => i === index ? {...s, imported: true} : s));
        } catch (error: any) {
            toast({ variant: 'destructive', title: `Import Failed for ${student.name}`, description: error.message });
        } finally {
            setSingleRowSaving(null);
        }
    };


    const handleImportAllRemaining = async () => {
        const remainingStudents = studentsToImport.filter(s => !s.imported);
        if (remainingStudents.length === 0) return;
        setIsSaving(true);
        let successCount = 0;
        const errors: string[] = [];
        
        for (const [index, student] of studentsToImport.entries()) {
             if (student.imported) continue;
            try {
                await importStudent(student);
                successCount++;
                setStudentsToImport(prev => prev.map((s, i) => i === index ? {...s, imported: true} : s));
            } catch (error: any) {
                errors.push(`Failed for ${student.name} (${student.email}): ${error.code || error.message}`);
            }
        }
        
        toast({ variant: 'success', title: 'Import Complete', description: `${successCount} students imported successfully.` });
        if(errors.length > 0) {
             toast({ variant: 'destructive', duration: 10000, title: 'Import Errors Occurred', description: (<ul className="list-disc pl-5 mt-2">{errors.slice(0, 5).map((e, i)=><li key={i}>{e}</li>)}{errors.length > 5 && <li>and {errors.length-5} more...</li>}</ul>) });
        }
        
        setIsSaving(false);
    };

    const unimportedCount = studentsToImport.filter(s => !s.imported).length;

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
                        1. Ensure your Excel file has one sheet per intake.<br/>
                        2. Required columns: `first_name`, `last_name`, `student_email`, and (`Student_number` or `reg_no`).<br/>
                        3. Map each sheet to the correct intake, then click "Process & Preview".<br/>
                        4. Confirm the preview is correct, then import students individually or all at once.
                    </AlertDescription>
                </Alert>
                <div>
                    <h3 className="font-semibold">Step 1: Upload File</h3>
                    <div className="flex gap-2">
                        <Input 
                            type="file" 
                            accept=".xlsx, .xls"
                            onChange={handleFileChange}
                            ref={fileInputRef}
                            className="max-w-xs"
                        />
                    </div>
                </div>

                {sheetNames.length > 0 && (
                    <div className="space-y-4">
                        <Separator />
                        <h3 className="font-semibold">Step 2: Map Sheets to Intakes</h3>
                        <div className="space-y-2 max-w-md">
                        {sheetNames.map(name => (
                            <div key={name} className="flex items-center gap-4">
                                <Label className="w-1/3 truncate">{name}</Label>
                                <Select value={sheetToIntakeMap[name]} onValueChange={(value) => setSheetToIntakeMap(prev => ({...prev, [name]: value}))}>
                                    <SelectTrigger><SelectValue placeholder="Select an intake..."/></SelectTrigger>
                                    <SelectContent>{allIntakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        ))}
                        </div>
                        <Button onClick={handleProcessSheets} disabled={isProcessing}>
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                            Process & Preview Data
                        </Button>
                    </div>
                )}

                 {studentsToImport.length > 0 && (
                    <div className="space-y-4 pt-4">
                        <Separator />
                        <h3 className="font-semibold">Step 3: Preview Data ({studentsToImport.length} Records)</h3>
                        <div className="max-h-96 overflow-x-auto border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Student ID</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Intake</TableHead>
                                        <TableHead>Phone</TableHead>
                                        <TableHead>DOB</TableHead>
                                        <TableHead>Gender</TableHead>
                                        <TableHead>Guardian</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {studentsToImport.map((student, index) => (
                                        <TableRow key={index} className={student.imported ? 'bg-green-100/50' : ''}>
                                            <TableCell>{student.id}</TableCell>
                                            <TableCell>{student.name}</TableCell>
                                            <TableCell>{student.email}</TableCell>
                                            <TableCell>{student.intakeName}</TableCell>
                                            <TableCell>{student.phoneNumber}</TableCell>
                                            <TableCell>{student.dob}</TableCell>
                                            <TableCell>{student.gender}</TableCell>
                                            <TableCell>{student.guardian?.name}</TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    disabled={student.imported || !!singleRowSaving}
                                                    onClick={() => handleImportSingleRow(student, index)}
                                                >
                                                    {singleRowSaving === student.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : student.imported ? <Check className="mr-2 h-4 w-4"/> : null}
                                                    {student.imported ? 'Imported' : 'Import'}
                                                </Button>
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
                     <Button onClick={handleImportAllRemaining} disabled={isSaving || unimportedCount === 0}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UserPlus className="mr-2 h-4"/>}
                        Confirm & Import {unimportedCount} Remaining Students
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
}
