
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Building, PlusCircle, Trash2, MapPin, Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { ref, onValue, push, set, remove } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';

type Campus = { id: string; name: string; location: string; code: string; };

export default function MultiCampusPage() {
    const [campuses, setCampuses] = React.useState<Campus[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const { toast } = useToast();

    // Dialog state
    const [isOpen, setIsOpen] = React.useState(false);
    const [name, setName] = React.useState('');
    const [location, setLocation] = React.useState('');
    const [code, setCode] = React.useState('');

    React.useEffect(() => {
        const campusRef = ref(db, 'settings/campuses');
        const unsub = onValue(campusRef, (snap) => {
            setCampuses(snap.exists() ? Object.keys(snap.val()).map(id => ({ id, ...snap.val()[id] })) : []);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleSave = async () => {
        if (!name || !code) return;
        setSaving(true);
        try {
            await push(ref(db, 'settings/campuses'), { name, location, code });
            toast({ title: 'Campus Added' });
            setIsOpen(false);
            setName(''); setLocation(''); setCode('');
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        await remove(ref(db, `settings/campuses/${id}`));
        toast({ title: 'Campus removed' });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="font-headline text-2xl">Campus Management</CardTitle>
                        <CardDescription>Configure and manage multiple campus locations.</CardDescription>
                    </div>
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/> Add Campus</Button></DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Register New Campus</DialogTitle></DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-1"><Label>Campus Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
                                <div className="space-y-1"><Label>Campus Code</Label><Input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g., LSK-MAIN" /></div>
                                <div className="space-y-1"><Label>Location</Label><Input value={location} onChange={e => setLocation(e.target.value)} /></div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="animate-spin"/> : 'Register'}</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {loading ? Array.from({length: 2}).map((_, i) => <Skeleton key={i} className="h-32"/>) :
                         campuses.map(c => (
                            <Card key={c.id}>
                                <CardHeader className="flex flex-row justify-between items-start">
                                    <div>
                                        <CardTitle className="text-lg">{c.name}</CardTitle>
                                        <CardDescription>{c.code}</CardDescription>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                </CardHeader>
                                <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <MapPin className="h-4 w-4"/> {c.location}
                                </CardContent>
                            </Card>
                         ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
