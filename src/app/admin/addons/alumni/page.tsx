
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Users2, PartyPopper, Handshake, PlusCircle, Search, Mail, Loader2, Trash2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { ref, onValue, push, set, remove } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { format } from 'date-fns';

type Alumni = { id: string; name: string; email: string; yearGraduated: number; company?: string; };
type AlumniEvent = { id: string; title: string; date: string; description: string; };

export default function AlumniPage() {
    const [alumni, setAlumni] = React.useState<Alumni[]>([]);
    const [events, setEvents] = React.useState<AlumniEvent[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState('');
    const { toast } = useToast();

    // Event Dialog State
    const [isEventDialogOpen, setIsEventDialogOpen] = React.useState(false);
    const [eventTitle, setEventTitle] = React.useState('');
    const [eventDate, setEventDate] = React.useState('');
    const [eventDesc, setEventDesc] = React.useState('');

    React.useEffect(() => {
        const alumniRef = ref(db, 'alumni/directory');
        const eventsRef = ref(db, 'alumni/events');

        const unsubAlumni = onValue(alumniRef, (snap) => {
            setAlumni(snap.exists() ? Object.keys(snap.val()).map(id => ({ id, ...snap.val()[id] })) : []);
        });

        const unsubEvents = onValue(eventsRef, (snap) => {
            setEvents(snap.exists() ? Object.keys(snap.val()).map(id => ({ id, ...snap.val()[id] })) : []);
            setLoading(false);
        });

        return () => { unsubAlumni(); unsubEvents(); };
    }, []);

    const handleCreateEvent = async () => {
        if (!eventTitle || !eventDate) return;
        setSaving(true);
        try {
            await push(ref(db, 'alumni/events'), { title: eventTitle, date: eventDate, description: eventDesc });
            toast({ title: 'Event Posted' });
            setIsEventDialogOpen(false);
            setEventTitle(''); setEventDate(''); setEventDesc('');
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteEvent = async (id: string) => {
        await remove(ref(db, `alumni/events/${id}`));
        toast({ title: 'Event removed' });
    }

    const filteredAlumni = alumni.filter(a => 
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        a.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">EduConnect360-Alumni</CardTitle>
                    <CardDescription>Engage and manage your alumni network with dedicated tools.</CardDescription>
                </CardHeader>
            </Card>

            <Tabs defaultValue="directory">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="directory"><Users2 className="mr-2 h-4 w-4"/> Alumni Directory</TabsTrigger>
                    <TabsTrigger value="events"><PartyPopper className="mr-2 h-4 w-4"/> Alumni Events</TabsTrigger>
                </TabsList>

                <TabsContent value="directory" className="pt-4 space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Search alumni by name or email..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {loading ? Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-32"/>) :
                                 filteredAlumni.map(a => (
                                    <Card key={a.id} className="p-4 flex flex-col justify-between">
                                        <div>
                                            <p className="font-bold">{a.name}</p>
                                            <p className="text-sm text-muted-foreground">Class of {a.yearGraduated}</p>
                                            {a.company && <p className="text-sm italic">{a.company}</p>}
                                        </div>
                                        <Button variant="ghost" size="sm" className="mt-4 self-start"><Mail className="mr-2 h-4 w-4"/> Contact</Button>
                                    </Card>
                                 ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="events" className="pt-4 space-y-4">
                    <div className="flex justify-end">
                        <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
                            <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/> New Event</Button></DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>Create Alumni Event</DialogTitle></DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-1"><Label>Title</Label><Input value={eventTitle} onChange={e => setEventTitle(e.target.value)}/></div>
                                    <div className="space-y-1"><Label>Date</Label><Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)}/></div>
                                    <div className="space-y-1"><Label>Description</Label><Input value={eventDesc} onChange={e => setEventDesc(e.target.value)}/></div>
                                </div>
                                <DialogFooter>
                                    <Button onClick={handleCreateEvent} disabled={saving}>{saving ? <Loader2 className="animate-spin"/> : 'Post Event'}</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                    <div className="grid gap-4">
                        {events.map(event => (
                            <Card key={event.id}>
                                <CardHeader className="flex flex-row items-start justify-between">
                                    <div>
                                        <CardTitle>{event.title}</CardTitle>
                                        <CardDescription>{format(new Date(event.date), 'PPP')}</CardDescription>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteEvent(event.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                </CardHeader>
                                <CardContent><p className="text-sm">{event.description}</p></CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
