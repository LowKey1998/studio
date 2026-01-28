
'use client';
import * as React from 'react';
import { format, isSameDay, parseISO } from 'date-fns';
import { Calendar as CalendarIcon, PlusCircle, Loader2, Download, Trash2, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { ref, update, push, get, set, onValue, remove } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';

type SpiritualEvent = {
  id: string;
  title: string;
  date: string;
  location?: string;
};

export default function SpiritualEventsPage() {
  const [events, setEvents] = React.useState<SpiritualEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [formLoading, setFormLoading] = React.useState(false);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [newEvent, setNewEvent] = React.useState<{title: string, date: Date | undefined, location: string}>({ title: '', date: undefined, location: '' });
  const [selectedDay, setSelectedDay] = React.useState<Date | undefined>();
  const [popoverOpen, setPopoverOpen] = React.useState(false);

  const { toast } = useToast();
  
  React.useEffect(() => {
    const eventsRef = ref(db, 'spiritualEvents');
    const unsub = onValue(eventsRef, (snapshot) => {
        const eventsList: SpiritualEvent[] = [];
        if (snapshot.exists()) {
            Object.entries(snapshot.val()).forEach(([id, event]) => {
                eventsList.push({ id, ...(event as any) });
            });
        }
        setEvents(eventsList);
        setLoading(false);
    });
    return () => unsub();
  }, []);
  
  const resetForm = () => {
    setNewEvent({ title: '', date: undefined, location: '' });
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title || !newEvent.date) { toast({ variant: 'destructive', title: 'Title and Date are required' }); return; }
    setFormLoading(true);
    try {
      const newEventRef = push(ref(db, 'spiritualEvents'));
      await set(newEventRef, { 
          title: newEvent.title, 
          date: format(newEvent.date, 'yyyy-MM-dd'),
          location: newEvent.location,
      });
      toast({ title: 'Event Added Successfully' });
      resetForm(); setIsDialogOpen(false); setPopoverOpen(false);
    } catch (error: any) { toast({ variant: 'destructive', title: 'Failed to add event' }); } 
    finally { setFormLoading(false); }
  };
  
  const handleDateSelect = (day: Date | undefined) => {
    if (!day) return;
    const eventsOnDay = events.filter(event => isSameDay(parseISO(event.date), day));
    if (eventsOnDay.length > 0) {
      setSelectedDay(day); setPopoverOpen(true);
    } else {
      setNewEvent({ title: '', date: day, location: '' }); setIsDialogOpen(true);
    }
  };

  const handleAddFromPopover = (date: Date) => { setNewEvent({ title: '', date, location: '' }); setIsDialogOpen(true); setPopoverOpen(false); }
  
  const eventDates = React.useMemo(() => events.map(event => parseISO(event.date)), [events]);
  const eventsOnSelectedDay = selectedDay ? events.filter(event => isSameDay(parseISO(event.date), selectedDay)) : [];

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="font-headline text-2xl">Spiritual Events Calendar</CardTitle>
            <CardDescription>Manage and view important spiritual life events.</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(isOpen) => { setIsDialogOpen(isOpen); if(!isOpen) resetForm(); }}>
              <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" /> Add Event</Button></DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <form onSubmit={handleAddEvent}>
                  <DialogHeader><DialogTitle className="font-headline">Add New Spiritual Event</DialogTitle></DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-1">
                        <Label>Title</Label>
                        <Input placeholder="e.g., Weekly Service" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} disabled={formLoading} />
                    </div>
                    <div className="space-y-1">
                        <Label>Date</Label>
                        <Popover><PopoverTrigger asChild><Button variant={'outline'} className={cn('w-full justify-start text-left font-normal', !newEvent.date && 'text-muted-foreground')} disabled={formLoading}><CalendarIcon className="mr-2 h-4 w-4" />{newEvent.date ? format(newEvent.date, 'PPP') : <span>Pick a date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={newEvent.date} onSelect={(date) => setNewEvent({...newEvent, date: date})} initialFocus /></PopoverContent></Popover>
                    </div>
                    <div className="space-y-1">
                        <Label>Location</Label>
                        <Input placeholder="e.g., University Chapel" value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} disabled={formLoading} />
                    </div>
                  </div>
                  <DialogFooter className="pt-4"><DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose><Button type="submit" disabled={formLoading}>{formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Add Event'}</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 md:flex-row">
          <div className="flex justify-center rounded-md border p-4">
            {loading ? <Skeleton className="h-[250px] w-[280px]" /> : (<Popover open={popoverOpen} onOpenChange={setPopoverOpen}><PopoverTrigger asChild><div><Calendar mode="single" selected={selectedDay} onSelect={handleDateSelect} modifiers={{ highlighted: eventDates }} modifiersClassNames={{highlighted: 'bg-primary/20 text-primary rounded-full'}} className="p-0"/></div></PopoverTrigger>{selectedDay && (<PopoverContent className="w-80"><div className="grid gap-4"><div className="space-y-2"><h4 className="font-medium leading-none">Events on {format(selectedDay, 'PPP')}</h4><div className="space-y-1">{eventsOnSelectedDay.length > 0 ? (eventsOnSelectedDay.map(event => (<div key={event.id}><p className="text-sm font-semibold">{event.title}</p><p className="text-xs text-muted-foreground">{event.location}</p></div>))) : (<p className="text-sm text-muted-foreground">No events for this day.</p>)}</div></div><Button onClick={() => handleAddFromPopover(selectedDay)}><Plus className="mr-2 h-4 w-4" /> Add Another Event</Button></div></PopoverContent>)}</Popover>)}
          </div>
          <div className="flex-1 space-y-4">
             <h3 className="font-headline text-lg font-semibold">Upcoming Events</h3>
            <div className="max-h-[200px] space-y-3 overflow-y-auto pr-2">
              {loading ? Array.from({ length: 4 }).map((_, i) => (<div key={i} className="flex items-center gap-4 rounded-md border p-3"><Skeleton className="h-5 w-24" /><Skeleton className="h-4 w-full" /></div>)) : events.length > 0 ? [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(event => (<div key={event.id} className="flex items-center gap-4 rounded-md border p-3"><div className="w-24 font-medium">{format(parseISO(event.date), 'MMM dd, yyyy')}</div><div className="flex-1 text-muted-foreground">{event.title}</div></div>)) : (<div className="text-center text-sm text-muted-foreground py-10"><p>No upcoming events.</p></div>)}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
