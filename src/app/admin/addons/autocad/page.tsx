
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Construction, PlusCircle, Trash2, KeyRound, Monitor } from 'lucide-react';
import { db } from '@/lib/firebase';
import { ref, onValue, push, set, remove } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

type License = { id: string; key: string; assignedTo: string; expiryDate: string; };

export default function AutoCADPage() {
    const [licenses, setLicenses] = React.useState<License[]>([]);
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();

    React.useEffect(() => {
        const licenseRef = ref(db, 'addons/autocad/licenses');
        const unsub = onValue(licenseRef, (snap) => {
            setLicenses(snap.exists() ? Object.keys(snap.val()).map(id => ({ id, ...snap.val()[id] })) : []);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleAddDummyLicense = async () => {
        await push(ref(db, 'addons/autocad/licenses'), {
            key: `ACAD-${Math.random().toString(36).substring(7).toUpperCase()}`,
            assignedTo: 'Lab 1',
            expiryDate: '2025-12-31'
        });
        toast({ title: 'License Added' });
    };

    const handleDelete = async (id: string) => {
        await remove(ref(db, `addons/autocad/licenses/${id}`));
        toast({ title: 'License removed' });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="font-headline text-2xl">AutoCAD License Tracking</CardTitle>
                        <CardDescription>Manage software licenses for engineering and design departments.</CardDescription>
                    </div>
                    <Button onClick={handleAddDummyLicense}><PlusCircle className="mr-2 h-4 w-4"/> Add License</Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>License Key</TableHead>
                                <TableHead>Assigned To</TableHead>
                                <TableHead>Expiry Date</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-24 w-full"/></TableCell></TableRow> :
                             licenses.map(l => (
                                <TableRow key={l.id}>
                                    <TableCell className="font-mono">{l.key}</TableCell>
                                    <TableCell>{l.assignedTo}</TableCell>
                                    <TableCell>{l.expiryDate}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(l.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                    </TableCell>
                                </TableRow>
                             ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
