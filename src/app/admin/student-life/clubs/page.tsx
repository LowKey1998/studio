
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2, Users } from 'lucide-react';
import { db } from '@/lib/firebase';
import { ref, onValue, set, push, remove } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Club = {
    id: string;
    name: string;
    description: string;
    members?: Record<string, boolean>; // studentId -> true
};

export default function ClubsPage() {
    const [clubs, setClubs] = React.useState<Club[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [name, setName] = React.useState('');
    const [description, setDescription] = React.useState('');
    const { toast } = useToast();

    React.useEffect(() => {
        const clubsRef = ref(db, 'clubs');
        const unsub = onValue(clubsRef, (snapshot) => {
            const data = snapshot.val() || {};
            setClubs(Object.keys(data).map(id => ({ id, ...data[id] })));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleSaveClub = async () => {
        if (!name) return;
        await set(push(ref(db, 'clubs')), { name, description });
        toast({ title: 'Club Created' });
        setName('');
        setDescription('');
        setIsDialogOpen(false);
    };
    
    const handleDeleteClub = async (id: string) => {
        await remove(ref(db, `clubs/${id}`));
        toast({ title: 'Club Deleted' });
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Clubs & Associations</CardTitle>
                    <CardDescription>Manage student clubs, memberships, and activities.</CardDescription>
                </div>
                 <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/> New Club</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Create New Club</DialogTitle></DialogHeader>
                        <div className="space-y-4">
                            <Input placeholder="Club Name" value={name} onChange={e => setName(e.target.value)} />
                            <Input placeholder="Short Description" value={description} onChange={e => setDescription(e.target.value)} />
                        </div>
                        <DialogFooter><Button onClick={handleSaveClub}>Save Club</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-40"/>) :
                 clubs.map(club => (
                    <Card key={club.id}>
                        <CardHeader><CardTitle>{club.name}</CardTitle><CardDescription>{club.description}</CardDescription></CardHeader>
                        <CardFooter className="flex justify-between">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4"/>{Object.keys(club.members || {}).length} Members</div>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteClub(club.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                        </CardFooter>
                    </Card>
                 ))
                }
                </div>
            </CardContent>
        </Card>
    );
}
