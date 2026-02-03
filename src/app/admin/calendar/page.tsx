'use client';
import * as React from 'react';
import { add, format, isSameDay, parseISO } from 'date-fns';
import { Calendar as CalendarIcon, PlusCircle, Loader2, Download, Trash2, Plus, Info, ListChecks, CheckCircle2, Search, Eye, EyeOff, Upload, Pencil } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { db, storage } from '@/lib/firebase';
import { ref as dbRef, update, push, get, set, onValue, remove } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getZambianPublicHolidays } from '@/lib/holidays';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  semester?: string;
  isPublicHoliday?: boolean;
  attachmentUrl?: string;
  attachmentName?: string;
};

type Semester = {
    id: string;
    name: string;
    paymentPlanIds?: Record<string, boolean>;
};

type NewEvent = {
    title: string;
    date: Date | undefined;
    file: File | null;
    semester: string;
}

type PaymentPlan = {
    id: string;
    name: string;
    installments: number;
}

type RequiredDeadline = {
    title: string;
    existingEvent: CalendarEvent | null;
};

const getOrdinalSuffix = (i: number) => {
    if (i === 1) return '1st';
    if (i === 2) return '2nd';
    if (i === 3) return '3rd';
    return `${i}th`;
}

export default function AdminCalendarPage() {
  const [events, setEvents] = React.useState<CalendarEvent[]>([]);
  const [semesters, setSemesters] = React.useState<Semester[]>([]);
  const [paymentPlans, setPaymentPlans] = React.useState<PaymentPlan[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [formLoading, setFormLoading] = React.useState(false);
  const [deadlineLoading, setDeadlineLoading] = React.useState(false);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [newEvents, setNewEvents] = React.useState<NewEvent[]>([{ title: '', date: undefined, file: null, semester: '' }]);
  const [showAllEvents, setShowAllEvents] = React.useState(false);
  const [selectedDay, setSelectedDay] = React.useState<Date | undefined>();
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [deadlineSemester, setDeadlineSemester] = React.useState('');
  const [requiredDeadlines, setRequiredDeadlines] = React.useState<RequiredDeadline[]>([]);
  const [deadlineDates, setDeadlineDates] = React.useState<Record<string, Date | undefined>>({});
  const [editingDeadlineId, setEditingDeadlineId] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');


  const { toast } = useToast();
  
  React.useEffect(() => {
    const fetchEventsAndSemesters = async () => {
      setLoading(true);
      
      const eventsRef = dbRef(db, 'calendarEvents');
      const holidaysPromise = getZambianPublicHolidays(new Date().getFullYear());
      
      const [eventsSnapshot, semestersSnapshot, holidays, paymentPlansSnap] = await Promise.all([
          get(eventsRef),
          get(dbRef(db, 'semesters')),
          holidaysPromise,
          get(dbRef(db, 'settings/paymentPlans')),
      ]);

      const semestersList: Semester[] = [];
      if (semestersSnapshot.exists()) {
        const data = semestersSnapshot.val();
        Object.keys(data).forEach(key => semestersList.push({ id: key, ...data[key] }));
        if (semestersList.length > 0) {
            const latestSemester = semestersList.sort((a,b) => b.name.localeCompare(a.name))[0];
            setDeadlineSemester(latestSemester.name);
        }
      }
      setSemesters(semestersList);
      
      if(paymentPlansSnap.exists()){
          setPaymentPlans(Object.values(paymentPlansSnap.val()));
      }

      const eventsList: CalendarEvent[] = [];
      if (eventsSnapshot.exists()) {
          Object.entries(eventsSnapshot.val()).forEach(([id, event]) => {
              eventsList.push({ id, ...(event as any) });
          });
      }
      holidays.forEach(holiday => {
          eventsList.push({ id: holiday.name, title: holiday.name, date: holiday.date, isPublicHoliday: true });
      });

      setEvents(eventsList);
      setLoading(false);
      
      onValue(eventsRef, (snapshot) => {
          const newEventsList: CalendarEvent[] = [];
           if (snapshot.exists()) {
                Object.entries(snapshot.val()).forEach(([id, event]) => {
                    newEventsList.push({ id, ...(event as any) });
                });
            }
          setEvents(prevEvents => [...prevEvents.filter(e => e.isPublicHoliday), ...newEventsList]);
      });
    };

    fetchEventsAndSemesters();
  }, []);
  
  const checkDeadlines = React.useCallback(() => {
    if (!deadlineSemester) return;
    setDeadlineLoading(true);
    const selectedSemesterData = semesters.find(s => s.name === deadlineSemester);
    if (!selectedSemesterData) {
        setRequiredDeadlines([]);
        setDeadlineLoading(false);
        return;
    }

    const linkedPlanIds = Object.keys(selectedSemesterData.paymentPlanIds || {});
    const linkedPlans = paymentPlans.filter(p => linkedPlanIds.includes(p.id));

    const required: string[] = [];
    linkedPlans.forEach(plan => {
         for (let i = 1; i <= plan.installments; i++) {
            required.push(`${plan.name} (${getOrdinalSuffix(i)} Installment) Deadline - ${deadlineSemester}`);
        }
    })
    
    const requiredWithStatus = required.map(title => {
        const existing = events.find(e => e.title.trim() === title.trim()) || null;
        return { title, existingEvent: existing };
    });
    
    setRequiredDeadlines(requiredWithStatus);
    setDeadlineLoading(false);
  }, [deadlineSemester, events, paymentPlans, semesters]);


  React.useEffect(() => {
    checkDeadlines();
  }, [events, deadlineSemester, checkDeadlines]);
  
  const resetForm = () => {
    setNewEvents([{ title: '', date: undefined, file: null, semester: '' }]);
  };

  const handleAddEventField = () => {
    setNewEvents([...newEvents, { title: '', date: undefined, file: null, semester: '' }]);
  };

  const handleRemoveEventField = (index: number) => {
    const updatedEvents = newEvents.filter((_, i) => i !== index);
    setNewEvents(updatedEvents);
  };
  
  const handleEventChange = (index: number, field: keyof NewEvent, value: any) => {
    const updatedEvents = [...newEvents];
    updatedEvents[index] = { ...updatedEvents[index], [field]: value };
    setNewEvents(updatedEvents);
  };
  

  const handleAddMultipleEvents = async (e: React.FormEvent) => {
    e.preventDefault();
    const validEvents = newEvents.filter(event => event.title && event.date);
    if (validEvents.length === 0) { toast({ variant: 'destructive', title: 'No Valid Events' }); return; }
    setFormLoading(true);
    try {
      const updates: { [key: string]: any } = {};
      for (const event of validEvents) {
          const newEventRef = push(dbRef(db, 'calendarEvents'));
          let attachmentUrl, attachmentName;
          if (event.file) {
              const fileStorageRef = storageRef(storage, `calendarAttachments/${newEventRef.key}/${event.file.name}`);
              const snapshot = await uploadBytes(fileStorageRef, event.file);
              attachmentUrl = await getDownloadURL(snapshot.ref);
              attachmentName = event.file.name;
          }
          updates[`/calendarEvents/${newEventRef.key!}`] = { 
              title: event.title, 
              date: format(event.date!, 'yyyy-MM-dd'),
              semester: event.semester || 'General',
              attachmentUrl,
              attachmentName,
          };
      }
      await update(dbRef(db), updates);
      toast({ title: 'Events Added Successfully' });
      resetForm(); setIsDialogOpen(false); setPopoverOpen(false);
    } catch (error: any) { toast({ variant: 'destructive', title: 'Failed to add events' }); } 
    finally { setFormLoading(false); }
  };
  
  const handleSaveDeadline = async (title: string, eventId?: string | null) => {
    const date = deadlineDates[title];
    if (!date) { toast({ variant: 'destructive', title: 'Date required' }); return; }
    setFormLoading(true);
    try {
        if(eventId) { // Editing existing event
            const eventRef = dbRef(db, `calendarEvents/${eventId}`);
            await update(eventRef, { date: format(date, 'yyyy-MM-dd') });
            toast({ title: "Deadline Updated" });
        } else { // Creating new event
            const newEventRef = push(dbRef(db, 'calendarEvents'));
            await set(newEventRef, { title, date: format(date, 'yyyy-MM-dd'), semester: deadlineSemester });
            toast({ title: `${title.replace(` - ${deadlineSemester}`, '')} Added` });
        }
        
        setDeadlineDates(prev => {
            const newDates = { ...prev };
            delete newDates[title];
            return newDates;
        });
        setEditingDeadlineId(null);
    } catch (error: any) { 
        toast({ variant: 'destructive', title: 'Failed to save deadline' }); 
    } finally { 
        setFormLoading(false); 
    }
  }

  const handleDeleteEvent = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this event?")) return;
    try {
      await remove(dbRef(db, `calendarEvents/${id}`));
      toast({ title: "Event deleted" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Deletion failed", description: e.message });
    }
  }

  const handleDateSelect = (day: Date | undefined) => {
    if (!day) return;
    const eventsOnDay = events.filter(event => isSameDay(parseISO(event.date), day));
    if (eventsOnDay.length > 0) {
      setSelectedDay(day); setPopoverOpen(true);
    } else {
      setNewEvents([{ title: '', date: day, file: null, semester: '' }]); setIsDialogOpen(true);
    }
  };

  const handleAddFromPopover = (date: Date) => { setNewEvents([{ title: '', date, file: null, semester: '' }]); setIsDialogOpen(true); setPopoverOpen(false); }

  const handleDownloadPdf = async () => {
    const { default: jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text('Academic Calendar', 14, 22);
    const tableColumn = ["Date", "Event"];
    const tableRows = filteredEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(event => [format(parseISO(event.date), 'MMM dd, yyyy'), event.title]);
    (doc as any).autoTable({ head: [tableColumn], body: tableRows, startY: 30 });
    doc.save('academic-calendar.pdf');
  };

  const filteredEvents = React.useMemo(() => {
    return events
      .filter(event => {
        if (showAllEvents) return true;
        if (event.isPublicHoliday) return true;
        if (event.semester && event.semester === deadlineSemester) return true;
        if (!event.semester || event.semester === 'General') return true;
        return false;
      })
      .filter(event => event.title.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [events, showAllEvents, searchTerm, deadlineSemester]);

  const eventDates = React.useMemo(() => {
    return filteredEvents
        .filter(e => !e.isPublicHoliday)
        .map(event => parseISO(event.date));
  }, [filteredEvents]);

  const holidayDates = React.useMemo(() => {
    return filteredEvents
        .filter(e => e.isPublicHoliday)
        .map(event => parseISO(event.date));
  }, [filteredEvents]);

  const eventsOnSelectedDay = selectedDay ? filteredEvents.filter(event => isSameDay(parseISO(event.date), selectedDay)) : [];

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="font-headline text-2xl">Academic Calendar</CardTitle>
            <CardDescription>Manage and view important school dates and deadlines.</CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={handleDownloadPdf} disabled={loading || filteredEvents.length === 0}><Download className="mr-2 h-4 w-4" /> Download PDF</Button>
            <Dialog open={isDialogOpen} onOpenChange={(isOpen) => { setIsDialogOpen(isOpen); if(!isOpen) resetForm(); }}>
              <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" /> Add Custom Event(s)</Button></DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <form onSubmit={handleAddMultipleEvents}>
                  <DialogHeader><DialogTitle className="font-headline">Add New Calendar Events</DialogTitle><DialogDescription>These events will be visible to all students and staff.</DialogDescription></DialogHeader>
                  <div className="grid max-h-[60vh] gap-4 overflow-y-auto py-4 pr-4">
                    {newEvents.map((event, index) => (
                        <div key={index} className="flex flex-col items-end gap-2 border p-3 rounded-md">
                             <div className="w-full space-y-1">
                                <Label htmlFor={`title-${index}`} className="text-xs">Title</Label>
                                <Input id={`title-${index}`} placeholder="e.g., Final Tuition Due" value={event.title} onChange={e => handleEventChange(index, 'title', e.target.value)} disabled={formLoading} />
                            </div>
                            <div className='w-full grid grid-cols-2 gap-2'>
                                <div className="space-y-1"><Label htmlFor={`date-${index}`} className="text-xs">Date</Label><Popover><PopoverTrigger asChild><Button id={`date-${index}`} variant={'outline'} className={cn('w-full justify-start text-left font-normal', !event.date && 'text-muted-foreground')} disabled={formLoading}><CalendarIcon className="mr-2 h-4 w-4" />{event.date ? format(event.date, 'PPP') : <span>Pick a date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={event.date} onSelect={(date) => handleEventChange(index, 'date', date)} initialFocus /></PopoverContent></Popover></div>
                                <div className="space-y-1">
                                    <Label htmlFor={`semester-${index}`} className="text-xs">Semester (Optional)</Label>
                                    <Select value={event.semester} onValueChange={value => handleEventChange(index, 'semester', value)}>
                                        <SelectTrigger><SelectValue placeholder="General" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="General">General</SelectItem>
                                            {semesters.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="w-full space-y-1">
                                <Label htmlFor={`file-${index}`} className="text-xs">Attachment (Optional)</Label>
                                <Input id={`file-${index}`} type="file" onChange={(e) => handleEventChange(index, 'file', e.target.files?.[0] || null)} disabled={formLoading} />
                            </div>
                            <Button type="button" variant="destructive" size="icon" onClick={() => handleRemoveEventField(index)} disabled={formLoading || newEvents.length === 1} className="h-8 w-8 shrink-0"><Trash2 className="h-4 w-4" /><span className="sr-only">Remove event</span></Button>
                        </div>
                    ))}
                    <Button type="button" variant="outline" onClick={handleAddEventField} disabled={formLoading}><Plus className="mr-2 h-4 w-4" /> Add Another</Button>
                  </div>
                  <DialogFooter className="pt-4"><DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose><Button type="submit" disabled={formLoading}>{formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Add Events'}</Button></form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 md:flex-row">
          <div className="flex justify-center rounded-md border p-4">
            {loading ? <Skeleton className="h-[250px] w-[280px]" /> : (<Popover open={popoverOpen} onOpenChange={setPopoverOpen}><PopoverTrigger asChild><div><Calendar mode="single" selected={selectedDay} onSelect={handleDateSelect} modifiers={{ highlighted: eventDates, holiday: holidayDates }} modifiersClassNames={{highlighted: 'bg-primary/20 text-primary rounded-full', holiday: 'bg-destructive/20 text-destructive rounded-full'}} className="p-0"/></div></PopoverTrigger>{selectedDay && (<PopoverContent className="w-80"><div className="grid gap-4"><div className="space-y-2"><h4 className="font-medium leading-none">Events on {format(selectedDay, 'PPP')}</h4><div className="space-y-1">{eventsOnSelectedDay.length > 0 ? (eventsOnSelectedDay.map(event => (<p key={event.id} className={cn("text-sm", event.isPublicHoliday ? "text-destructive font-semibold" : "text-muted-foreground")}>{event.title}</p>))) : (<p className="text-sm text-muted-foreground">No events for this day.</p>)}</div></div><Button onClick={() => handleAddFromPopover(selectedDay)}><Plus className="mr-2 h-4 w-4" /> Add Another Event</Button></div></PopoverContent>)}</Popover>)}
          </div>
          <div className="flex-1 space-y-4">
             <div className="flex items-center justify-between"><h3 className="font-headline text-lg font-semibold">{showAllEvents ? 'All Events' : `Events for ${deadlineSemester}`}</h3><div className="flex items-center space-x-2"><Switch id="show-all" checked={showAllEvents} onCheckedChange={setShowAllEvents} /><Label htmlFor="show-all">{showAllEvents ? <Eye className="h-4 w-4"/> : <EyeOff className="h-4 w-4"/>}</Label></div></div>
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search events..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className="max-h-[200px] space-y-3 overflow-y-auto pr-2">
              {loading ? Array.from({ length: 4 }).map((_, i) => (<div key={i} className="flex items-center gap-4 rounded-md border p-3"><Skeleton className="h-5 w-24" /><Skeleton className="h-4 w-full" /></div>)) : filteredEvents.length > 0 ? [...filteredEvents].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(event => (
                <div key={event.id} className="flex items-center gap-4 rounded-md border p-3">
                  <div className={cn("w-24 font-medium", event.isPublicHoliday && "text-destructive")}>{format(parseISO(event.date), 'MMM dd, yyyy')}</div>
                  <div className={cn("flex-1", event.isPublicHoliday ? "text-destructive font-semibold" : "text-muted-foreground")}>{event.title}</div>
                  <div className="flex gap-1">
                    {event.attachmentUrl && (<Button asChild size="sm" variant="outline" className="h-8 w-8 p-0"><a href={event.attachmentUrl} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4"/></a></Button>)}
                    {!event.isPublicHoliday && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteEvent(event.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>)) : (<div className="text-center text-sm text-muted-foreground py-10"><Info className="mx-auto h-8 w-8 text-muted-foreground/50" /><p className="mt-2">No events found for the current filters.</p></div>)}
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="shadow-lg">
        <CardHeader>
            <CardTitle className="font-headline text-2xl">Manage Payment Deadlines</CardTitle>
            <CardDescription>Quickly set and edit mandatory payment plan deadlines for any semester.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
             <div className="flex items-center gap-4">
                <Label htmlFor="semester-name" className="font-semibold">Semester:</Label>
                <Select value={deadlineSemester} onValueChange={setDeadlineSemester}>
                    <SelectTrigger className="max-w-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {semesters.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            {deadlineLoading ? <Loader2 className="h-6 w-6 animate-spin"/> : requiredDeadlines.length > 0 ? (
                <div className="space-y-4 rounded-md border p-4">
                    <h4 className="font-medium">Deadlines for {deadlineSemester}:</h4>
                    {requiredDeadlines.map(({title, existingEvent}) => {
                        const isEditingThis = editingDeadlineId === (existingEvent?.id || title);
                        const displayDate = deadlineDates[title] || (existingEvent ? parseISO(existingEvent.date) : undefined);
                        return (
                        <div key={title} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="font-medium">{title.replace(` - ${deadlineSemester}`, '')}</p>
                            <div className="flex gap-2 items-center">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button 
                                            variant="outline"
                                            disabled={!isEditingThis && !!existingEvent}
                                            className="w-full justify-start text-left font-normal sm:w-[240px]">
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {displayDate ? format(displayDate, 'PPP') : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={displayDate} onSelect={(date) => setDeadlineDates(prev => ({...prev, [title]: date}))} initialFocus />
                                    </PopoverContent>
                                </Popover>
                                
                                {existingEvent ? (
                                    isEditingThis ? (
                                        <>
                                            <Button size="sm" onClick={() => handleSaveDeadline(title, existingEvent.id)} disabled={formLoading}>{formLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : "Save"}</Button>
                                            <Button size="sm" variant="ghost" onClick={() => setEditingDeadlineId(null)}>Cancel</Button>
                                        </>
                                    ) : (
                                         <Button variant="ghost" size="icon" onClick={() => setEditingDeadlineId(existingEvent.id)}><Pencil className="h-4 w-4"/></Button>
                                    )
                                ) : (
                                     <Button onClick={() => handleSaveDeadline(title)} disabled={formLoading || !deadlineDates[title]}>
                                        {formLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : "Add"}
                                    </Button>
                                )}
                            </div>
                        </div>
                    )})}
                </div>
            ) : (
                <Alert variant="default" className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-700" />
                    <AlertTitle className="text-green-800">All Set!</AlertTitle>
                    <AlertDescription className="text-green-700">All mandatory payment deadlines for {deadlineSemester} have been set, or no payment plans are linked to this semester.</AlertDescription>
                </Alert>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
