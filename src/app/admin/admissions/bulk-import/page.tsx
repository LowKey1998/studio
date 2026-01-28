
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, Info, UserPlus, FileUp, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { findOrCreateUser, type FindOrCreateUserInput } from '@/ai/flows/find-or-create-user';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

type ProcessedStudent = Omit<FindOrCreateUserInput, 'password'> & {
    intakeName?: string;
    imported?: boolean;
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
                const json: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false });

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
                        name: [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ') || '',
                        email: (row.student_email || '').toString().trim(),
                        phoneNumber: (row.student_phone || '').toString().trim(),
                        role: 'Student' as const,
                        dob: formattedDob,
                        gender: row.gender || '',
                        nationality: row.nationality || '',
                        address: row.address || '',
                        disability: row.disability || '',
                        guardian: {
                            name: row.guardian_names || '',
                            relationship: row.guardian_relationship || '',
                            email: row.guardian_email || '',
                            contact: row.guardian_phone || '',
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
        const password = Math.random().toString(36).slice(-8);
        const { intakeName, imported, ...studentData } = student;
        
        await findOrCreateUser({
            ...studentData,
            password,
        });
    };
    
    
    const handleImportSingleRow = async (student: ProcessedStudent, index: number) => {
        setSingleRowSaving(student.id);
        try {
            await importStudent(student);
            toast({ variant: 'success', title: 'Student Imported', description: `${student.name} imported successfully.` });
            setStudentsToImport(prev => prev.map((s, i) => i === index ? {...s, imported: true} : s));
        } catch (error: any) {
            toast({ variant: 'destructive', duration: 10000, title: `Import Failed for ${student.name}`, description: error.message });
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
        
        for (const student of remainingStudents) {
            try {
                await importStudent(student);
                successCount++;
                setStudentsToImport(prev => prev.map(s => s.id === student.id ? {...s, imported: true} : s));
            } catch (error: any) {
                errors.push(`Failed for ${student.name} (${student.email}): ${error.message}`);
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
                        1. Ensure your Excel file has one sheet per intake, with the sheet named after the intake (e.g., "2024JAN").<br/>
                        2. Required columns: `first_name`, `last_name`, `student_email`, and (`Student_number`, `Student number` or `reg_no`).<br/>
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
                                        <TableHead>Phone</TableHead>
                                        <TableHead>DOB</TableHead>
                                        <TableHead>Gender</TableHead>
                                        <TableHead>Intake</TableHead>
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
                                            <TableCell>{student.phoneNumber}</TableCell>
                                            <TableCell>{student.dob}</TableCell>
                                            <TableCell>{student.gender}</TableCell>
                                            <TableCell>{student.intakeName}</TableCell>
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
