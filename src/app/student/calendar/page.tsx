
'use client';
import * as React from 'react';
import { format, parseISO, isSameDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Download, Info, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getZambianPublicHolidays } from '@/lib/holidays';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';


type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  semester?: string;
  isPublicHoliday?: boolean;
  attachmentUrl?: string;
  attachmentName?: string;
};

export default function StudentCalendarPage() {
  const [allUserEvents, setAllUserEvents] = React.useState<CalendarEvent[]>([]);
  const [enrolledSemesters, setEnrolledSemesters] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedDay, setSelectedDay] = React.useState<Date | undefined>();
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);
  const [semesterFilter, setSemesterFilter] = React.useState('all');


  const { toast } = useToast();
  
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    if (!currentUser) return;

    const fetchEventsAndRegistrations = async () => {
      setLoading(true);
      try {
        const registrationsRef = ref(db, `registrations/${currentUser.uid}`);
        const eventsRef = ref(db, 'calendarEvents');
        const holidaysPromise = getZambianPublicHolidays(new Date().getFullYear());
        
        const [registrationsSnapshot, eventsSnapshot, holidays] = await Promise.all([
            get(registrationsRef), 
            get(eventsRef), 
            holidaysPromise
        ]);
        
        // Get student's enrolled semesters
        const semesters: string[] = [];
        if(registrationsSnapshot.exists()) {
            const regs = registrationsSnapshot.val();
            for(const semesterName in regs) {
                if(regs[semesterName].status === 'Completed' || regs[semesterName].status === 'Pending Payment') {
                    semesters.push(semesterName);
                }
            }
        }
        setEnrolledSemesters(semesters);

        // Get all calendar events
        const eventsList: CalendarEvent[] = [];
        if (eventsSnapshot.exists()) {
            Object.entries(eventsSnapshot.val()).forEach(([id, event]) => {
                eventsList.push({ id, ...(event as any) });
            });
        }
        holidays.forEach(holiday => {
            eventsList.push({ id: holiday.name, title: holiday.name, date: holiday.date, isPublicHoliday: true });
        });
        
        const filteredForUser = eventsList.filter(event => {
            if (event.isPublicHoliday) return true;
            if (event.semester && semesters.includes(event.semester)) return true;
            if (!event.semester || event.semester === 'General') return true;
            return false;
        });
        
        setAllUserEvents(filteredForUser);

      } catch (error) {
        console.error('Error fetching calendar data:', error);
        toast({
          variant: 'destructive',
          title: 'Failed to load events',
          description: 'Could not fetch calendar data.',
        });
      } finally {
        setLoading(false);
      }
    };
    fetchEventsAndRegistrations();
  }, [currentUser, toast]);

  const handleDownloadPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text('Academic Calendar', 14, 22);
    
    const tableColumn = ["Date", "Event"];
    const tableRows = filteredEvents
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(event => [
        format(parseISO(event.date), 'MMM dd, yyyy'),
        event.title
      ]);

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 30,
    });

    doc.save('academic-calendar.pdf');
  };
  
  const handleDateSelect = (day: Date | undefined) => {
    if (!day) return;
    
    const eventsOnDay = allUserEvents.filter(event => isSameDay(parseISO(event.date), day));
    
    if (eventsOnDay.length > 0) {
      setSelectedDay(day);
      setPopoverOpen(true);
    } else {
        setSelectedDay(day);
        setPopoverOpen(false);
    }
  };

  const filteredEvents = React.useMemo(() => {
    return allUserEvents
        .filter(event => {
            if (semesterFilter === 'all') return true;
            if (semesterFilter === 'general' && (!event.semester || event.semester === 'General')) return true;
            return event.semester === semesterFilter;
        })
        .filter(event => event.title.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [allUserEvents, searchTerm, semesterFilter]);
  
  const eventDates = React.useMemo(() => {
    return allUserEvents
        .filter(e => !e.isPublicHoliday)
        .map(event => parseISO(event.date));
  }, [allUserEvents]);

  const holidayDates = React.useMemo(() => {
    return allUserEvents
        .filter(e => e.isPublicHoliday)
        .map(event => parseISO(event.date));
  }, [allUserEvents]);

  const eventsOnSelectedDay = selectedDay ? allUserEvents.filter(event => isSameDay(parseISO(event.date), selectedDay)) : [];

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="font-headline text-2xl">Academic Calendar</CardTitle>
              <CardDescription>View important school dates and deadlines for your enrolled semesters.</CardDescription>
            </div>
            <Button variant="outline" onClick={handleDownloadPdf} disabled={loading || allUserEvents.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Download PDF
            </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 md:flex-row">
          <div className="flex justify-center rounded-md border p-4">
             {loading ? (
                <div className="flex items-center justify-center p-10">
                    <Skeleton className="h-[250px] w-[280px]" />
                </div>
            ) : (
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <div>
                      <Calendar
                        mode="single"
                        selected={selectedDay}
                        onSelect={handleDateSelect}
                        modifiers={{ highlighted: eventDates, holiday: holidayDates }}
                        modifiersClassNames={{
                          highlighted: 'bg-primary/20 text-primary rounded-full',
                          holiday: 'bg-destructive/20 text-destructive rounded-full',
                        }}
                        className="p-0"
                      />
                    </div>
                  </PopoverTrigger>
                  {selectedDay && (
                    <PopoverContent className="w-80">
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <h4 className="font-medium leading-none">Events on {format(selectedDay, 'PPP')}</h4>
                          <div className="space-y-1">
                            {eventsOnSelectedDay.length > 0 ? eventsOnSelectedDay.map(event => (
                              <p key={event.id} className={cn("text-sm", event.isPublicHoliday ? "text-destructive font-semibold" : "text-muted-foreground")}>{event.title}</p>
                            )) : (
                                <p className="text-sm text-muted-foreground">No events for this day.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  )}
                </Popover>
            )}
          </div>
          <div className="flex-1 space-y-4">
            <h3 className="font-headline text-lg font-semibold">Events for Your Semesters</h3>
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search events..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                 <div>
                    <Select value={semesterFilter} onValueChange={setSemesterFilter}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All My Semesters</SelectItem>
                            <SelectItem value="general">General</SelectItem>
                            {enrolledSemesters.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="max-h-[200px] space-y-3 overflow-y-auto pr-2">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 rounded-md border p-3">
                        <Skeleton className="h-5 w-24" /><Skeleton className="h-4 w-full" />
                    </div>
                ))
              ) : filteredEvents.length > 0 ? (
                [...filteredEvents]
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map(event => (
                    <div key={event.id} className="flex items-center gap-4 rounded-md border p-3">
                      <div className={cn("w-24 font-medium", event.isPublicHoliday && "text-destructive")}>{format(parseISO(event.date), 'MMM dd, yyyy')}</div>
                      <div className={cn("flex-1", event.isPublicHoliday ? "text-destructive font-semibold" : "text-muted-foreground")}>{event.title}</div>
                      {event.attachmentUrl && (<Button asChild size="sm" variant="outline"><a href={event.attachmentUrl} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4"/></a></Button>)}
                    </div>
                  ))
              ) : (
                <div className="text-center text-sm text-muted-foreground py-10">
                    <Info className="mx-auto h-8 w-8 text-muted-foreground/50" />
                    <p className="mt-2">No events found for the selected filters.</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
