'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { db, auth } from '@/lib/firebase';
import { ref, onValue, set, push, runTransaction } from 'firebase/database';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Preceptor = {
    uid: string;
    id: string;
    name: string;
    email: string;
    phone?: string;
};

export default function PreceptorManagementPage() {
    const [preceptors, setPreceptors] = React.useState<Preceptor[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [formLoading, setFormLoading] = React.useState(false);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    
    // Form state
    const [name, setName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [phone, setPhone] = React.useState('');
    const [password, setPassword] = React.useState('');

    const { toast } = useToast();

    React.useEffect(() => {
        const usersRef = ref(db, 'users');
        const unsubscribe = onValue(usersRef, (snapshot) => {
            const usersData = snapshot.val() || {};
            const preceptorsList: Preceptor[] = [];
            for (const uid in usersData) {
                const user = usersData[uid];
                if (user.role === 'Staff' && user.subRoles?.includes('Preceptor')) {
                    preceptorsList.push({
                        uid,
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        phone: user.phoneNumber,
                    });
                }
            }
            setPreceptors(preceptorsList);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const resetForm = () => {
        setName(''); setEmail(''); setPhone(''); setPassword('');
    };

    const handleAddPreceptor = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !email || !password) {
            toast({ variant: 'destructive', title: 'Missing required fields.' });
            return;
        }
        setFormLoading(true);

        try {
            const counterRef = ref(db, `userCounters/staff`);
            let newId = '';
            await runTransaction(counterRef, (currentCount) => {
                const count = (currentCount || 0) + 1;
                newId = `STF-${String(count).padStart(3, '0')}`;
                return count;
            });

            // Note: This creates a user but doesn't handle secondary auth instances well.
            // For a production app, an admin SDK backend function would be safer.
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await set(ref(db, `users/${user.uid}`), {
                id: newId,
                name,
                email,
                phoneNumber: phone,
                role: 'Staff',
                subRoles: ['Preceptor'],
                status: 'active'
            });
            
            await set(ref(db, `userRoles/${user.uid}`), { role: 'staff' });
            
            toast({ title: 'Preceptor Added', description: `${name} can now log in with their credentials.` });
            resetForm();
            setIsDialogOpen(false);
        } catch (error: any) {
            console.error("Error creating preceptor:", error);
            toast({ variant: 'destructive', title: 'Creation Failed', description: error.message });
        } finally {
            setFormLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Preceptor Management</CardTitle>
                    <CardDescription>Manage preceptor accounts, including creating logins and assigning them to students.</CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/> Add Preceptor</Button></DialogTrigger>
                    <DialogContent><form onSubmit={handleAddPreceptor}>
                        <DialogHeader><DialogTitle>New Preceptor</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                           <div className="space-y-1"><Label>Full Name</Label><Input value={name} onChange={e => setName(e.target.value)} required/></div>
                           <div className="space-y-1"><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required/></div>
                           <div className="space-y-1"><Label>Phone (Optional)</Label><Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} /></div>
                           <div className="space-y-1"><Label>Initial Password</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required/></div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
                            <Button type="submit" disabled={formLoading}>{formLoading && <Loader2 className="mr-2 animate-spin"/>} Add Preceptor</Button>
                        </DialogFooter>
                    </form></DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Phone</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-24"/></TableCell></TableRow>
                        : preceptors.map(p => (
                            <TableRow key={p.uid}>
                                <TableCell>{p.id}</TableCell>
                                <TableCell>{p.name}</TableCell>
                                <TableCell>{p.email}</TableCell>
                                <TableCell>{p.phone || 'N/A'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
