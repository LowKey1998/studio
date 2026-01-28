
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2, CalendarIcon } from 'lucide-react';
import { db } from '@/lib/firebase';
import { ref, onValue, set, push, remove } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, parseISO, isSameDay } from 'date-fns';

type StudentEvent = {
    id: string;
    title: string;
    description: string;
    date: string;
};

export default function StudentEventsPage() {
    const [events, setEvents] = React.useState<StudentEvent[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [title, setTitle] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [date, setDate] = React.useState<Date | undefined>();
    const [selectedDay, setSelectedDay] = React.useState<Date | undefined>(new Date());
    const { toast } = useToast();
    
    React.useEffect(() => {
        const eventsRef = ref(db, 'studentEvents');
        const unsub = onValue(eventsRef, (snapshot) => {
            const data = snapshot.val() || {};
            setEvents(Object.keys(data).map(id => ({ id, ...data[id] })));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleSaveEvent = async () => {
        if (!title || !date) return;
        await set(push(ref(db, 'studentEvents')), { title, description, date: format(date, 'yyyy-MM-dd') });
        toast({ title: 'Event Created' });
        setTitle(''); setDescription(''); setDate(undefined); setIsDialogOpen(false);
    };
    
    const handleDeleteEvent = async (id: string) => {
        await remove(ref(db, `studentEvents/${id}`));
        toast({ title: 'Event Deleted' });
    }

    const eventDates = events.map(e => parseISO(e.date));

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Event Calendar</CardTitle>
                    <CardDescription>Manage and publish student life events.</CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/> New Event</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Create New Student Event</DialogTitle></DialogHeader>
                        <div className="space-y-4">
                            <Input placeholder="Event Title" value={title} onChange={e => setTitle(e.target.value)} />
                            <Textarea placeholder="Event Description" value={description} onChange={e => setDescription(e.target.value)} />
                            <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full"><CalendarIcon className="mr-2 h-4"/>{date ? format(date, 'PPP') : "Select Date"}</Button></PopoverTrigger><PopoverContent><Calendar mode="single" selected={date} onSelect={setDate} /></PopoverContent></Popover>
                        </div>
                        <DialogFooter><Button onClick={handleSaveEvent}>Save Event</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent className="flex flex-col md:flex-row gap-6">
                 <div className="flex justify-center"><Calendar mode="single" selected={selectedDay} onSelect={setSelectedDay} modifiers={{highlighted: eventDates}} modifiersClassNames={{highlighted: "bg-primary text-primary-foreground"}} className="rounded-md border"/></div>
                 <div className="flex-1 space-y-4">
                    <h3 className="font-semibold">Events for {selectedDay ? format(selectedDay, 'PPP') : 'selected date'}:</h3>
                    {loading ? <Skeleton className="h-24"/> : 
                     events.filter(e => isSameDay(parseISO(e.date), selectedDay || new Date())).map(e => (
                        <Card key={e.id}><CardHeader className="flex-row items-start justify-between"><div><CardTitle className="text-base">{e.title}</CardTitle><CardDescription>{e.description}</CardDescription></div><Button size="icon" variant="ghost" onClick={() => handleDeleteEvent(e.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button></CardHeader></Card>
                     ))
                    }
                </div>
            </CardContent>
        </Card>
    );
}
